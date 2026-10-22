import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { UNCATEGORIZED_CODE } from '../coa/coa-account.entity.js';
import { CoaService } from '../coa/coa.service.js';
import { Pharmacy } from '../pharmacies/pharmacy.entity.js';
import { PharmacyAccount } from '../pharmacy-accounts/pharmacy-account.entity.js';
import { BankTransaction } from '../transactions/bank-transaction.entity.js';
import { AI_CLEARED } from '../transactions/categorization.service.js';
import { UsersService } from '../users/users.service.js';
import {
  OPEN_STATUSES,
  OwnerQuestion,
  type QuestionStatus,
} from './owner-question.entity.js';
import type { AnswerInput, AskItemInput } from './owner-question.input.js';

/** PRD 7.1: a soft cap; more is allowed, staff just get a warning. */
export const SOFT_CAP_PER_MONTH = 5;

export const NOT_LINKED =
  "Your sign-in isn't linked to a pharmacy yet. Please contact RxBooks.";
export const ALREADY_RESOLVED =
  'This question has already been handled by RxBooks, so the answer can no longer change.';

export interface AskResult {
  asked: number;
  /** Open questions per month after this request, e.g. { "2025-01": 6 }. */
  openByMonth: Record<string, number>;
  /** Months now above the soft cap of 5 open questions. */
  overSoftCap: string[];
}

/** A question as the owner sees it: no account codes, no AI reasons. */
export interface OwnerQuestionCard {
  id: number;
  date: string;
  description: string;
  amount: string;
  /** "Business credit card •••• 7702" */
  account: string;
  /** The starting choice (a category value from the owner list), if any. */
  suggested: string | null;
  note: string | null;
  status: QuestionStatus;
  answer: {
    category: string;
    note: string | null;
    willSendDocument: boolean;
    answeredAt: Date;
  } | null;
}

export interface OwnerCategory {
  /** The value to send back; never shown to the owner. */
  value: string;
  /** Plain-language name, e.g. "Office supplies". */
  label: string;
  group: string;
}

const GROUP_LABELS: Record<string, string> = {
  revenue: 'Money coming in',
  cost_of_goods: 'Stock & drugs',
  expense: 'Running the pharmacy',
  asset: 'Accounts & property',
  liability: 'Cards & loans',
  equity: 'Owner',
};

@Injectable()
export class OwnerQuestionsService {
  constructor(
    @InjectRepository(OwnerQuestion)
    private readonly questions: Repository<OwnerQuestion>,
    @InjectRepository(BankTransaction)
    private readonly transactions: Repository<BankTransaction>,
    @InjectRepository(PharmacyAccount)
    private readonly accounts: Repository<PharmacyAccount>,
    @InjectRepository(Pharmacy)
    private readonly pharmacies: Repository<Pharmacy>,
    private readonly coa: CoaService,
    private readonly users: UsersService,
  ) {}

  // ---- Staff -------------------------------------------------------------

  /**
   * Asks the owner about transactions. Approved rows and rows that already
   * have an open question are refused, so nothing is asked twice.
   */
  async ask(
    pharmacyId: number,
    items: AskItemInput[],
    userId: number,
  ): Promise<AskResult> {
    await this.requirePharmacy(pharmacyId);
    const ids = items.map((i) => i.transactionId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Each transaction can be asked about once.',
      );
    }
    const rows = await this.transactions.find({
      where: { pharmacyId, id: In(ids) },
    });
    if (rows.length !== ids.length) {
      throw new NotFoundException('Some transactions were not found.');
    }
    if (rows.some((r) => r.status === 'approved')) {
      throw new BadRequestException(
        'Approved transactions are final. Take the approval back first to ask the owner.',
      );
    }
    const open = await this.openFor(ids);
    if (open.length > 0) {
      throw new ConflictException(
        `${open.length === 1 ? 'One of these transactions already has' : `${open.length} of these transactions already have`} an open question.`,
      );
    }
    const allowed = new Set((await this.ownerCategories()).map((c) => c.value));
    for (const item of items) {
      if (item.suggestedCode && !allowed.has(item.suggestedCode)) {
        throw new BadRequestException(
          `${item.suggestedCode} can't be offered to the owner. Choose another category.`,
        );
      }
    }

    const now = new Date();
    await this.questions.save(
      items.map((item) =>
        this.questions.create({
          pharmacyId,
          transactionId: item.transactionId,
          askedBy: userId,
          askedAt: now,
          suggestedCode: item.suggestedCode ?? null,
          staffNote: item.note ?? null,
          status: 'waiting',
          answerCode: null,
          answerUnsure: false,
          answerNote: null,
          willSendDocument: false,
          answeredBy: null,
          answeredAt: null,
          resolvedBy: null,
          resolvedAt: null,
        }),
      ),
    );

    // Count open questions in the months these rows belong to.
    const months = [...new Set(rows.map((r) => r.period))];
    const openNow = (
      await this.questions.find({ where: { pharmacyId } })
    ).filter((q) => OPEN_STATUSES.includes(q.status));
    const periodOf = new Map(
      (
        await this.transactions.find({
          where: { pharmacyId, id: In(openNow.map((q) => q.transactionId)) },
        })
      ).map((t) => [t.id, t.period]),
    );
    const openByMonth: Record<string, number> = {};
    for (const month of months) {
      openByMonth[month] = openNow.filter(
        (q) => periodOf.get(q.transactionId) === month,
      ).length;
    }
    return {
      asked: items.length,
      openByMonth,
      overSoftCap: months.filter((m) => openByMonth[m] > SOFT_CAP_PER_MONTH),
    };
  }

  /** Withdraws an open question. */
  async cancel(pharmacyId: number, id: number, userId: number): Promise<void> {
    const question = await this.find(pharmacyId, id);
    if (!OPEN_STATUSES.includes(question.status)) {
      throw new BadRequestException('Only open questions can be cancelled.');
    }
    Object.assign(question, {
      status: 'cancelled',
      resolvedBy: userId,
      resolvedAt: new Date(),
    });
    await this.questions.save(question);
  }

  /** Takes the owner's answer: the transaction gets that category and is approved. */
  async accept(pharmacyId: number, id: number, userId: number): Promise<void> {
    const question = await this.find(pharmacyId, id);
    if (question.status !== 'answered') {
      throw new BadRequestException(
        question.status === 'waiting'
          ? "The owner hasn't answered yet."
          : 'This question is already closed.',
      );
    }
    if (!question.answerCode) {
      throw new BadRequestException(
        'The owner said "Not sure": choose the category yourself instead.',
      );
    }
    const row = await this.transactions.findOneBy({
      id: question.transactionId,
      pharmacyId,
    });
    if (!row) throw new NotFoundException('Transaction not found.');
    const now = new Date();
    Object.assign(row, {
      coaCode: question.answerCode,
      status: 'approved',
      source: 'owner',
      ruleId: null,
      approvedBy: userId,
      approvedAt: now,
      ...AI_CLEARED,
    });
    await this.transactions.save(row);
    Object.assign(question, {
      status: 'accepted',
      resolvedBy: userId,
      resolvedAt: now,
    });
    await this.questions.save(question);
  }

  // ---- Owner -------------------------------------------------------------

  /** The owner's open questions, oldest transaction first. */
  async ownerQuestions(
    userId: number,
  ): Promise<{ pharmacyName: string; questions: OwnerQuestionCard[] }> {
    const pharmacyId = await this.ownerPharmacy(userId);
    const pharmacy = await this.pharmacies.findOneBy({ id: pharmacyId });
    const open = (await this.questions.find({ where: { pharmacyId } })).filter(
      (q) => OPEN_STATUSES.includes(q.status),
    );
    const rows = new Map(
      (
        await this.transactions.find({
          where: { pharmacyId, id: In(open.map((q) => q.transactionId)) },
        })
      ).map((t) => [t.id, t]),
    );
    const accounts = new Map(
      (await this.accounts.find({ where: { pharmacyId } })).map((a) => [
        a.id,
        `${a.name} •••• ${a.lastFour}`,
      ]),
    );
    const cards = open.flatMap((q): OwnerQuestionCard[] => {
      const t = rows.get(q.transactionId);
      if (!t) return [];
      return [
        {
          id: q.id,
          date: t.date,
          description: t.description,
          amount: t.amount,
          account: accounts.get(t.accountId) ?? '',
          suggested: q.suggestedCode,
          note: q.staffNote,
          status: q.status,
          answer:
            q.status === 'answered' && q.answeredAt
              ? {
                  category: q.answerUnsure
                    ? 'unsure'
                    : (q.answerCode ?? 'unsure'),
                  note: q.answerNote,
                  willSendDocument: q.willSendDocument,
                  answeredAt: q.answeredAt,
                }
              : null,
        },
      ];
    });
    cards.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    return { pharmacyName: pharmacy?.name ?? '', questions: cards };
  }

  /** Categories an owner can pick, by their plain-language names. */
  async ownerCategories(): Promise<OwnerCategory[]> {
    const order = Object.keys(GROUP_LABELS);
    return (await this.coa.list())
      .filter(
        (a) =>
          a.isActive &&
          a.categorizable &&
          a.code !== UNCATEGORIZED_CODE &&
          GROUP_LABELS[a.type] !== undefined,
      )
      .map((a) => ({
        value: a.code,
        label: a.ownerLabel ?? a.name,
        group: GROUP_LABELS[a.type],
        rank: order.indexOf(a.type),
      }))
      .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
      .map(({ value, label, group }) => ({ value, label, group }));
  }

  /** Saves the owner's answer. It can change until RxBooks has handled it. */
  async answer(userId: number, id: number, input: AnswerInput): Promise<void> {
    const pharmacyId = await this.ownerPharmacy(userId);
    const question = await this.questions.findOneBy({ id, pharmacyId });
    if (!question) throw new NotFoundException('Question not found.');
    if (!OPEN_STATUSES.includes(question.status)) {
      throw new ConflictException(ALREADY_RESOLVED);
    }
    const unsure = input.category === 'unsure';
    if (!unsure) {
      const allowed = new Set(
        (await this.ownerCategories()).map((c) => c.value),
      );
      if (!allowed.has(input.category)) {
        throw new BadRequestException('Choose one of the listed categories.');
      }
    }
    Object.assign(question, {
      status: 'answered',
      answerCode: unsure ? null : input.category,
      answerUnsure: unsure,
      answerNote: input.note ?? null,
      willSendDocument: input.willSendDocument,
      answeredBy: userId,
      answeredAt: new Date(),
    });
    await this.questions.save(question);
  }

  // ---- Helpers -----------------------------------------------------------

  private async ownerPharmacy(userId: number): Promise<number> {
    const user = await this.users.findById(userId);
    if (!user?.pharmacyId) throw new ForbiddenException(NOT_LINKED);
    return user.pharmacyId;
  }

  private async find(pharmacyId: number, id: number): Promise<OwnerQuestion> {
    await this.requirePharmacy(pharmacyId);
    const question = await this.questions.findOneBy({ id, pharmacyId });
    if (!question) throw new NotFoundException('Question not found.');
    return question;
  }

  private async openFor(transactionIds: number[]): Promise<OwnerQuestion[]> {
    return (
      await this.questions.find({
        where: { transactionId: In(transactionIds) },
      })
    ).filter((q) => OPEN_STATUSES.includes(q.status));
  }

  private async requirePharmacy(id: number) {
    if (!(await this.pharmacies.existsBy({ id }))) {
      throw new NotFoundException('Pharmacy not found.');
    }
  }
}
