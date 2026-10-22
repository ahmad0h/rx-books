import type { CoaAccountView } from '../coa/coa-account.entity.js';
import type { AccountKind } from './pharmacy-account.entity.js';

/** 1015 is cash kept at the pharmacy, never a bank account (PRD 8.8). */
const CASH_ON_HAND = '1015';

/**
 * Which chart-of-accounts codes an account of this kind may use (PRD 8.8):
 * checking and savings 1000–1099, cards 2010–2099.
 */
export function codeFitsKind(kind: AccountKind, account: CoaAccountView) {
  const code = Number(account.code);
  if (kind === 'credit_card') {
    return account.type === 'liability' && code >= 2010 && code <= 2099;
  }
  return (
    account.type === 'asset' &&
    code >= 1000 &&
    code <= 1099 &&
    account.code !== CASH_ON_HAND
  );
}
