import { UNCATEGORIZED_CODE } from '../coa/coa-account.entity.js';
import { matchingRules, type MatchableRule } from '../rules/matcher.js';
import type {
  TransactionFlag,
  TransactionSource,
  TransactionStatus,
} from './bank-transaction.entity.js';

export interface EngineRule extends MatchableRule {
  coaCode: string;
  autoApprove: boolean;
}

export interface OwnAccount {
  id: number;
  lastFour: string;
  coaCode: string;
}

export interface EngineInput {
  /** The account the transaction was uploaded to. */
  accountId: number;
  description: string;
  lastFour: string | null;
}

export interface EngineResult {
  coaCode: string;
  status: TransactionStatus;
  source: TransactionSource | null;
  ruleId: number | null;
  flag: TransactionFlag | null;
}

/**
 * Chooses an account for one transaction (PRD 8.1, A.3), first match wins:
 *
 * 1. A masked number that is one of the pharmacy's own accounts → a transfer
 *    to that account. Always "suggested": transfers need a person.
 * 2. Rules: pharmacy rules before shared ones (see matcher). An auto-approve
 *    rule approves; otherwise the account is only suggested.
 * 3. Nothing matched → stays in 9999 · Uncategorized for AI or a person.
 *
 * A masked number that is not one of the pharmacy's accounts is flagged
 * "unknown_account"; a rule may still suggest an account but never approves it.
 */
export function categorize(
  input: EngineInput,
  ownAccounts: readonly OwnAccount[],
  rules: readonly EngineRule[],
): EngineResult {
  let flag: TransactionFlag | null = null;
  if (input.lastFour) {
    const own = ownAccounts.find((a) => a.lastFour === input.lastFour);
    if (own && own.id !== input.accountId) {
      return {
        coaCode: own.coaCode,
        status: 'suggested',
        source: 'own_account',
        ruleId: null,
        flag: null,
      };
    }
    if (!own) flag = 'unknown_account';
  }

  const [rule] = matchingRules(input.description, rules);
  if (rule) {
    return {
      coaCode: rule.coaCode,
      status: rule.autoApprove && !flag ? 'approved' : 'suggested',
      source: 'rule',
      ruleId: rule.id,
      flag,
    };
  }
  return {
    coaCode: UNCATEGORIZED_CODE,
    status: 'uncategorized',
    source: null,
    ruleId: null,
    flag,
  };
}
