import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, type Repository } from 'typeorm';
import { UNCATEGORIZED_CODE } from '../coa/coa-account.entity.js';
import { CoaService } from '../coa/coa.service.js';
import { Pharmacy } from '../pharmacies/pharmacy.entity.js';
import { matchingRules } from './matcher.js';
import { keywordProblem } from './rule-checks.js';
import { Rule, type RuleSource, type RuleView } from './rule.entity.js';
import type {
  CreateRuleInput,
  RuleFieldsInput,
  UpdateRuleInput,
} from './rule.input.js';

export const DUPLICATE_KEYWORD =
  'This list already has an active rule with this keyword.';
export const BALANCE_SHEET_AUTO_APPROVE =
  'Transfers and balance-sheet accounts need a person to confirm each match. Turn off auto-approve.';

/** Gap between priorities, so a rule can later be slotted in between. */
const PRIORITY_STEP = 10;

export interface RuleTestResult {
  /** The rule that would categorize the row, or null when none matches. */
  winner: RuleView | null;
  /** Every matching rule, best first (the winner is the first). */
  matches: RuleView[];
}

@Injectable()
export class RulesService {
  constructor(
    @InjectRepository(Rule)
    private readonly rules: Repository<Rule>,
    @InjectRepository(Pharmacy)
    private readonly pharmacies: Repository<Pharmacy>,
    private readonly coa: CoaService,
  ) {}

  /** Every rule in one list (shared, or one pharmacy's), including retired ones. */
  async list(pharmacyId: number | null): Promise<RuleView[]> {
    if (pharmacyId !== null) await this.requirePharmacy(pharmacyId);
    const rows = await this.inList(pharmacyId);
    return this.views(
      rows.sort(
        (a, b) =>
          a.priority - b.priority ||
          b.keyword.length - a.keyword.length ||
          a.id - b.id,
      ),
    );
  }

  async create(
    input: CreateRuleInput,
    source: RuleSource = 'manual',
  ): Promise<RuleView> {
    if (input.pharmacyId !== null) await this.requirePharmacy(input.pharmacyId);
    const siblings = await this.inList(input.pharmacyId);
    await this.check(input, siblings);
    const rule = this.rules.create({
      pharmacyId: input.pharmacyId,
      ...this.fields(input),
      priority: input.priority ?? nextPriority(siblings),
      source,
      retiredAt: null,
    });
    return this.view(await this.save(rule));
  }

  async update(id: number, input: UpdateRuleInput): Promise<RuleView> {
    const rule = await this.find(id);
    const siblings = await this.inList(rule.pharmacyId);
    await this.check(input, siblings, rule);
    Object.assign(rule, this.fields(input), {
      priority: input.priority ?? rule.priority,
    });
    return this.view(await this.save(rule));
  }

  /** "Delete": the rule stops matching but stays in the history. */
  async retire(id: number): Promise<RuleView> {
    const rule = await this.find(id);
    if (!rule.retiredAt) rule.retiredAt = new Date();
    return this.view(await this.save(rule));
  }

  async restore(id: number): Promise<RuleView> {
    const rule = await this.find(id);
    if (rule.retiredAt) {
      const siblings = await this.inList(rule.pharmacyId);
      if (isTaken(rule.keyword, siblings, rule.id)) {
        throw new ConflictException(DUPLICATE_KEYWORD);
      }
      rule.retiredAt = null;
    }
    return this.view(await this.save(rule));
  }

  /** Which active rule would categorize this description for the pharmacy. */
  async test(
    description: string,
    pharmacyId: number | null,
  ): Promise<RuleTestResult> {
    if (pharmacyId !== null) await this.requirePharmacy(pharmacyId);
    const candidates = [
      ...(pharmacyId !== null ? await this.inList(pharmacyId) : []),
      ...(await this.inList(null)),
    ].filter((rule) => !rule.retiredAt);
    const matches = await this.views(matchingRules(description, candidates));
    return { winner: matches[0] ?? null, matches };
  }

  private async find(id: number): Promise<Rule> {
    const rule = await this.rules.findOneBy({ id });
    if (!rule) throw new NotFoundException('Rule not found.');
    return rule;
  }

  private inList(pharmacyId: number | null): Promise<Rule[]> {
    return this.rules.find({
      where: { pharmacyId: pharmacyId ?? IsNull() },
    });
  }

  private async requirePharmacy(id: number) {
    if (!(await this.pharmacies.existsBy({ id }))) {
      throw new NotFoundException('Pharmacy not found.');
    }
  }

  private fields(input: RuleFieldsInput) {
    return {
      keyword: input.keyword,
      coaCode: input.coaCode,
      tag: input.tag ?? null,
      autoApprove: input.autoApprove,
      sourceNote: input.sourceNote ?? null,
    };
  }

  /** The checks from PRD 8.4 that apply today. */
  private async check(input: RuleFieldsInput, siblings: Rule[], self?: Rule) {
    const problem = keywordProblem(input.keyword);
    if (problem) throw new BadRequestException(problem);

    const accounts = await this.coa.list();
    const account = accounts.find((a) => a.code === input.coaCode);
    if (!account) {
      throw new BadRequestException(`Account ${input.coaCode} does not exist.`);
    }
    if (account.code === UNCATEGORIZED_CODE) {
      throw new BadRequestException(
        'Rows with no rule already go to 9999 · Uncategorized. Pick a real account.',
      );
    }
    // An unchanged account on an existing rule is fine even if it was later closed.
    if (self?.coaCode !== account.code) {
      if (!account.isActive) {
        throw new BadRequestException(`${account.label} is inactive.`);
      }
      if (!account.categorizable) {
        throw new BadRequestException(
          `${account.label} only takes journal entries, not transactions.`,
        );
      }
    }
    if (
      input.autoApprove &&
      ['asset', 'liability', 'equity'].includes(account.type)
    ) {
      throw new BadRequestException(BALANCE_SHEET_AUTO_APPROVE);
    }
    if (!self?.retiredAt && isTaken(input.keyword, siblings, self?.id)) {
      throw new ConflictException(DUPLICATE_KEYWORD);
    }
  }

  private async save(rule: Rule): Promise<Rule> {
    try {
      return await this.rules.save(rule);
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ConflictException(DUPLICATE_KEYWORD);
      }
      throw error;
    }
  }

  private async view(rule: Rule): Promise<RuleView> {
    return (await this.views([rule]))[0];
  }

  private async views(rules: Rule[]): Promise<RuleView[]> {
    const labels = new Map(
      (await this.coa.list()).map((a) => [a.code, a.label]),
    );
    return rules.map((r) => ({
      id: r.id,
      pharmacyId: r.pharmacyId,
      keyword: r.keyword,
      coaCode: r.coaCode,
      account: labels.get(r.coaCode) ?? r.coaCode,
      tag: r.tag,
      priority: r.priority,
      autoApprove: r.autoApprove,
      source: r.source,
      sourceNote: r.sourceNote,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      retiredAt: r.retiredAt,
    }));
  }
}

function nextPriority(rules: Rule[]): number {
  return Math.max(0, ...rules.map((r) => r.priority)) + PRIORITY_STEP;
}

/** True when another active rule in the list has this keyword. */
function isTaken(keyword: string, rules: Rule[], selfId?: number): boolean {
  return rules.some(
    (r) => !r.retiredAt && r.id !== selfId && r.keyword === keyword,
  );
}
