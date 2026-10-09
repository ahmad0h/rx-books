import { keywordMatches, normalizeText } from './matcher.js';

/**
 * Words that only say how money moved, not who it went to. A keyword made only
 * of these would match almost everything (PRD 8.4).
 */
const PAYMENT_WORDS = [
  'WEB AUTHORIZED',
  'MOBILE BANKING',
  'ELECTRONIC',
  'WITHDRAWAL',
  'DEPOSIT',
  'ZELLE',
  'CHECK',
  'CARDMEMBER',
  'ATM',
  'ACH',
  'POS',
  'PMT',
  'PAYMENT',
  'PURCHASE',
  'TRANSFER',
  'INSTANT',
  'TO',
  'FROM',
];

/** Stores that sell both business and personal things: each row needs a person (PRD 8.4). */
const MIXED_USE_VENDORS = [
  'AMAZON',
  'AMZN',
  'WALMART',
  'WAL-MART',
  'TARGET',
  'COSTCO WHSE',
  'COSTCO WAREHOUSE',
  'SAMS CLUB',
  "SAM'S CLUB",
  'STARBUCKS',
  'CARIBOU COFFEE',
  'DUNKIN',
  'KROGER',
  'ALDI',
  'CUB FOODS',
  'WHOLE FOODS',
  'TRADER JOE',
];

/** Why a keyword can't be used, or null when it's fine. */
export function keywordProblem(keyword: string): string | null {
  const key = normalizeText(keyword);
  if (!/[A-Z]/.test(key)) {
    return 'A keyword needs letters. Numbers alone (like reference or account numbers) change every month.';
  }
  const rest = PAYMENT_WORDS.reduce(
    (text, word) =>
      text.replace(new RegExp(`(^|\\W)${escape(word)}(?=\\W|$)`, 'g'), '$1'),
    key,
  );
  if (!/[A-Z0-9]/.test(rest)) {
    return 'This keyword is only payment words (like ZELLE, CHECK or DEPOSIT). Add the vendor name.';
  }
  const vendor = MIXED_USE_VENDORS.find((name) => keywordMatches(key, name));
  if (vendor) {
    return `${vendor} sells both business and personal items, so it gets no rule. Each purchase is reviewed on its own.`;
  }
  return null;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
