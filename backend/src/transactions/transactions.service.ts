import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { UNCATEGORIZED_CODE } from '../coa/coa-account.entity.js';
import { CoaService } from '../coa/coa.service.js';
import { Pharmacy } from '../pharmacies/pharmacy.entity.js';
import { UsersService } from '../users/users.service.js';
import {
  BankTransaction,
  type Subtag,
  type TransactionFlag,
  type TransactionSource,
  type TransactionStatus,
} from './bank-transaction.entity.js';
import { AI_CLEARED, CategorizationService } from './categorization.service.js';
import { centsToDecimal, parseCents } from './money.js';
import { TransactionUpload } from './transaction-upload.entity.js';

export interface TransactionView {
  id: number;
  accountId: number;
  uploadId: number;
  date: string;
  postDate: string | null;
  description: string;
  memo: string | null;
  amount: string;
  typeHint: string | null;
  lastFour: string | null;
  coaCode: string;
  coaLabel: string;
  status: TransactionStatus;
  source: TransactionSource | null;
  ruleId: number | null;
  /** The keyword of the rule that chose the account. */
  ruleKeyword: string | null;
  flag: TransactionFlag | null;
  /** Name of the person who approved it; null for auto-approve rules. */
  approvedBy: string | null;
  approvedAt: Date | null;
  /** The AI's answer, when it was asked about this row. */
  aiConfidence: number | null;
  aiRationale: string | null;
  aiRunId: number | null;
  subtag: Subtag | null;
  subtagNote: string | null;
}

export interface TransactionMonth {
  /** Months that have transactions, newest first ("2025-02"). */
  months: string[];
  /** The month shown: the one asked for, or the newest. Null when there is nothing yet. */
  month: string | null;
  transactions: TransactionView[];
  totals: {
    count: number;
    moneyIn: string;
    moneyOut: string;
    approved: number;
    suggested: number;
    uncategorized: number;
  };
}

export const CHOOSE_ACCOUNT_FIRST =
  'Rows in 9999 · Uncategorized need an account before they can be approved.';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(BankTransaction)
    private readonly transactions: Repository<BankTransaction>,
    @InjectRepository(TransactionUpload)
    private readonly uploads: Repository<TransactionUpload>,
    @InjectRepository(Pharmacy)
    private readonly pharmacies: Repository<Pharmacy>,
    private readonly coa: CoaService,
    private readonly users: UsersService,
    private readonly categorization: CategorizationService,
  ) {}

  /** One month of a pharmacy's transactions, optionally for one account. */
  async month(
    pharmacyId: number,
    filter: { month?: string; accountId?: number },
  ): Promise<TransactionMonth> {
    await this.requirePharmacy(pharmacyId);
    const uploads = await this.uploads.find({
      where: filter.accountId
        ? { pharmacyId, accountId: filter.accountId }
        : { pharmacyId },
    });
    const months = [
      ...new Set(uploads.flatMap((u) => u.months.split(',').filter(Boolean))),
    ].sort((a, b) => b.localeCompare(a));
    const month = filter.month ?? months[0] ?? null;
    if (!month) {
      return { months, month, transactions: [], totals: totals([]) };
    }

    const rows = await this.transactions.find({
      where: filter.accountId
        ? { pharmacyId, period: month, accountId: filter.accountId }
        : { pharmacyId, period: month },
    });
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    return {
      months,
      month,
      totals: totals(rows),
      transactions: await this.views(rows),
    };
  }

  /**
   * A person chooses the account: the row is approved as a staff decision,
   * which later rule runs never change. 9999 puts it back to uncategorized.
   */
  async setAccount(
    pharmacyId: number,
    id: number,
    coaCode: string,
    userId: number,
  ): Promise<TransactionView> {
    const [row] = await this.inPharmacy(pharmacyId, [id]);
    if (!row) throw new NotFoundException('Transaction not found.');

    if (coaCode === UNCATEGORIZED_CODE) {
      Object.assign(row, {
        coaCode,
        status: 'uncategorized',
        source: null,
        ruleId: null,
        approvedBy: null,
        approvedAt: null,
        ...AI_CLEARED,
      });
    } else {
      const account = (await this.coa.list()).find((a) => a.code === coaCode);
      if (!account) {
        throw new BadRequestException(`Account ${coaCode} does not exist.`);
      }
      if (!account.isActive) {
        throw new BadRequestException(`${account.label} is inactive.`);
      }
      if (!account.categorizable) {
        throw new BadRequestException(
          `${account.label} only takes journal entries, not transactions.`,
        );
      }
      Object.assign(row, {
        coaCode,
        status: 'approved',
        source: 'staff',
        ruleId: null,
        approvedBy: userId,
        approvedAt: new Date(),
        ...AI_CLEARED,
      });
    }
    return (await this.views([await this.transactions.save(row)]))[0];
  }

  /** Approves suggested rows. Rows still in 9999 are left alone and counted. */
  async approve(
    pharmacyId: number,
    ids: number[],
    userId: number,
  ): Promise<{ approved: number; skipped: number }> {
    const rows = await this.inPharmacy(pharmacyId, ids);
    if (rows.length !== new Set(ids).size) {
      throw new NotFoundException('Some transactions were not found.');
    }
    const ready = rows.filter((r) => r.status === 'suggested');
    if (ready.length === 0 && rows.some((r) => r.status === 'uncategorized')) {
      throw new BadRequestException(CHOOSE_ACCOUNT_FIRST);
    }
    const now = new Date();
    for (const row of ready) {
      Object.assign(row, {
        status: 'approved',
        approvedBy: userId,
        approvedAt: now,
      });
    }
    if (ready.length > 0) await this.transactions.save(ready);
    return { approved: ready.length, skipped: rows.length - ready.length };
  }

  /** Takes approval back: the row goes back to "suggested" with the same account. */
  async unapprove(
    pharmacyId: number,
    ids: number[],
  ): Promise<{ unapproved: number }> {
    const rows = await this.inPharmacy(pharmacyId, ids);
    if (rows.length !== new Set(ids).size) {
      throw new NotFoundException('Some transactions were not found.');
    }
    const approved = rows.filter((r) => r.status === 'approved');
    for (const row of approved) {
      Object.assign(row, {
        status: 'suggested',
        approvedBy: null,
        approvedAt: null,
      });
    }
    if (approved.length > 0) await this.transactions.save(approved);
    return { unapproved: approved.length };
  }

  /** Runs the rules again on a month; approved rows and staff decisions stay. */
  async categorize(
    pharmacyId: number,
    scope: { month: string; accountId?: number },
  ) {
    await this.requirePharmacy(pharmacyId);
    return this.categorization.run(pharmacyId, scope);
  }

  private async requirePharmacy(id: number) {
    if (!(await this.pharmacies.existsBy({ id }))) {
      throw new NotFoundException('Pharmacy not found.');
    }
  }

  private async inPharmacy(pharmacyId: number, ids: number[]) {
    await this.requirePharmacy(pharmacyId);
    return this.transactions.find({ where: { pharmacyId, id: In(ids) } });
  }

  private async views(rows: BankTransaction[]): Promise<TransactionView[]> {
    const labels = new Map(
      (await this.coa.list()).map((a) => [a.code, a.label]),
    );
    const keywords = await this.categorization.ruleKeywords([
      ...new Set(rows.flatMap((r) => (r.ruleId ? [r.ruleId] : []))),
    ]);
    const names = new Map<number, string>();
    for (const id of new Set(
      rows.flatMap((r) => (r.approvedBy ? [r.approvedBy] : [])),
    )) {
      names.set(id, (await this.users.findById(id))?.name ?? 'Unknown user');
    }
    return rows.map((t) => ({
      id: t.id,
      accountId: t.accountId,
      uploadId: t.uploadId,
      date: t.date,
      postDate: t.postDate,
      description: t.description,
      memo: t.memo,
      amount: t.amount,
      typeHint: t.typeHint,
      lastFour: t.lastFour,
      coaCode: t.coaCode,
      coaLabel: labels.get(t.coaCode) ?? t.coaCode,
      status: t.status,
      source: t.source,
      ruleId: t.ruleId,
      ruleKeyword: t.ruleId ? (keywords.get(t.ruleId) ?? null) : null,
      flag: t.flag,
      approvedBy: t.approvedBy ? (names.get(t.approvedBy) ?? null) : null,
      approvedAt: t.approvedAt,
      aiConfidence: t.aiConfidence,
      aiRationale: t.aiRationale,
      aiRunId: t.aiRunId,
      subtag: t.subtag,
      subtagNote: t.subtagNote,
    }));
  }
}

function totals(rows: BankTransaction[]): TransactionMonth['totals'] {
  const cents = rows.map((r) => parseCents(r.amount) ?? 0);
  const count = (status: TransactionStatus) =>
    rows.filter((r) => r.status === status).length;
  return {
    count: rows.length,
    moneyIn: centsToDecimal(
      cents.filter((c) => c > 0).reduce((a, b) => a + b, 0),
    ),
    moneyOut: centsToDecimal(
      cents.filter((c) => c < 0).reduce((a, b) => a + b, 0),
    ),
    approved: count('approved'),
    suggested: count('suggested'),
    uncategorized: count('uncategorized'),
  };
}
