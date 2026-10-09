/**
 * Rule matching, shared by the admin test box and (later) auto-categorization.
 * Pure functions, so the same input always gives the same answer.
 */

export interface MatchableRule {
  id: number;
  pharmacyId: number | null;
  keyword: string;
  priority: number;
  createdAt: Date;
}

/** Upper-case with single spaces, so spacing and case never matter. */
export function normalizeText(text: string): string {
  return text.toUpperCase().replace(/\s+/g, ' ').trim();
}

const WORD_CHAR = /\w/;

/**
 * True when the keyword appears at the start of a word in the description:
 * "ANDA" matches "WITHDRAWAL ANDA PHARMA" but not "ZELLE STANDARD". It can end
 * mid-word, so "PRIME THERAPEUTIC" also matches "PRIME THERAPEUTICS".
 */
export function keywordMatches(description: string, keyword: string): boolean {
  const text = normalizeText(description);
  const key = normalizeText(keyword);
  if (!key) return false;
  for (let at = text.indexOf(key); at !== -1; at = text.indexOf(key, at + 1)) {
    if (at === 0 || !WORD_CHAR.test(text[at - 1])) return true;
  }
  return false;
}

/**
 * Which rule wins: pharmacy rules before shared ones, then lowest priority,
 * then longest keyword, then the oldest, then the lowest id.
 */
export function compareRules(a: MatchableRule, b: MatchableRule): number {
  return (
    Number(a.pharmacyId === null) - Number(b.pharmacyId === null) ||
    a.priority - b.priority ||
    b.keyword.length - a.keyword.length ||
    a.createdAt.getTime() - b.createdAt.getTime() ||
    a.id - b.id
  );
}

/** Every rule that matches, best first. The first one is the winner. */
export function matchingRules<T extends MatchableRule>(
  description: string,
  rules: readonly T[],
): T[] {
  return rules
    .filter((rule) => keywordMatches(description, rule.keyword))
    .sort(compareRules);
}
