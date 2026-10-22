import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, type Repository } from 'typeorm';
import { PharmacyAccount } from '../pharmacy-accounts/pharmacy-account.entity.js';
import { Rule } from '../rules/rule.entity.js';
import { BankTransaction } from './bank-transaction.entity.js';
import { categorize } from './engine.js';

/** Wipes an earlier AI answer when something else decides the row. */
export const AI_CLEARED = {
  aiConfidence: null,
  aiRationale: null,
  aiRunId: null,
  subtag: null,
  subtagNote: null,
};

export interface CategorizeResult {
  /** Transactions looked at: everything not yet approved or decided by staff. */
  checked: number;
  approved: number;
  suggested: number;
  uncategorized: number;
}

/** Which transactions to (re)categorize. */
export interface CategorizeScope {
  month?: string;
  accountId?: number;
  uploadId?: number;
}

@Injectable()
export class CategorizationService {
  constructor(
    @InjectRepository(BankTransaction)
    private readonly transactions: Repository<BankTransaction>,
    @InjectRepository(Rule)
    private readonly rules: Repository<Rule>,
    @InjectRepository(PharmacyAccount)
    private readonly accounts: Repository<PharmacyAccount>,
  ) {}

  /**
   * Runs the engine on every transaction in scope that is not approved and
   * not decided by staff. Approved rows and staff decisions are never changed.
   */
  async run(
    pharmacyId: number,
    scope: CategorizeScope,
  ): Promise<CategorizeResult> {
    const rows = (
      await this.transactions.find({
        where: {
          pharmacyId,
          ...(scope.month ? { period: scope.month } : {}),
          ...(scope.accountId ? { accountId: scope.accountId } : {}),
          ...(scope.uploadId ? { uploadId: scope.uploadId } : {}),
        },
      })
    ).filter((t) => t.status !== 'approved' && t.source !== 'staff');
    const result: CategorizeResult = {
      checked: rows.length,
      approved: 0,
      suggested: 0,
      uncategorized: 0,
    };
    if (rows.length === 0) return result;

    const rules = [
      ...(await this.rules.find({ where: { pharmacyId } })),
      ...(await this.rules.find({ where: { pharmacyId: IsNull() } })),
    ].filter((r) => !r.retiredAt);
    const own = await this.accounts.find({ where: { pharmacyId } });

    const changed: BankTransaction[] = [];
    for (const row of rows) {
      const next = categorize(row, own, rules);
      // An AI answer stays unless a rule or one of our own accounts now decides
      // the row: rules always win over AI, but "no match" doesn't erase it.
      if (next.source === null && row.aiRunId !== null) {
        result[row.status] += 1;
        continue;
      }
      const cleared = row.aiRunId !== null;
      if (cleared) Object.assign(row, AI_CLEARED);
      result[next.status] += 1;
      if (
        cleared ||
        next.coaCode !== row.coaCode ||
        next.status !== row.status ||
        next.source !== row.source ||
        next.ruleId !== row.ruleId ||
        next.flag !== row.flag
      ) {
        changed.push(Object.assign(row, next));
      }
    }
    if (changed.length > 0)
      await this.transactions.save(changed, { chunk: 500 });
    return result;
  }

  /** Keywords of the rules that categorized these transactions. */
  async ruleKeywords(ruleIds: number[]): Promise<Map<number, string>> {
    if (ruleIds.length === 0) return new Map();
    const rules = await this.rules.find({ where: { id: In(ruleIds) } });
    return new Map(rules.map((r) => [r.id, r.keyword]));
  }
}
