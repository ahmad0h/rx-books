import {
  keywordMatches,
  matchingRules,
  normalizeText,
  type MatchableRule,
} from './matcher.js';

describe('keywordMatches', () => {
  // The table from PRD 8.3.
  it.each([
    ['ANDA', 'ANDA PHARMA'],
    ['ANDA', 'WITHDRAWAL ANDA'],
    ['APHA', 'APHA DUES'],
    ['PRIME THERAPEUTIC', 'PRIME THERAPEUTICS'],
    ['OPTUMRX', 'ORIG CO NAME:OPTUMRX'],
    ['mckesson', 'Electronic   Withdrawal McKesson'],
  ])('%s matches "%s"', (keyword, description) => {
    expect(keywordMatches(description, keyword)).toBe(true);
  });

  it.each([
    ['ANDA', 'ZELLE STANDARD PMT'],
    ['APHA', 'ALPHA SUPPLY'],
    ['7134', 'TRN*1*2500607134*'],
    ['PCRX', 'IPCRX.COM'],
  ])('%s does not match "%s"', (keyword, description) => {
    expect(keywordMatches(description, keyword)).toBe(false);
  });

  it('finds a later word-start match after an earlier mid-word one', () => {
    expect(keywordMatches('STANDARD ANDA', 'ANDA')).toBe(true);
  });

  it('normalizes case and spacing', () => {
    expect(normalizeText('  prime   therapeutic ')).toBe('PRIME THERAPEUTIC');
  });
});

describe('matchingRules', () => {
  const day = (d: number) => new Date(Date.UTC(2026, 0, d));
  const rule = (
    id: number,
    keyword: string,
    priority: number,
    pharmacyId: number | null = null,
    created = day(1),
  ): MatchableRule => ({
    id,
    keyword,
    priority,
    pharmacyId,
    createdAt: created,
  });

  const winner = (description: string, rules: MatchableRule[]) =>
    matchingRules(description, rules)[0]?.id ?? null;

  it('puts pharmacy rules before shared rules, whatever their priority', () => {
    const rules = [rule(1, 'MERCHANT SERVICE', 1), rule(2, 'MERCHANT', 900, 7)];
    expect(winner('DEPOSIT MERCHANT SERVICE', rules)).toBe(2);
  });

  it('then lowest priority, then longest keyword, then oldest, then id', () => {
    expect(
      winner('OPTUMRX CREDENTIALING', [
        rule(1, 'OPTUMRX', 230),
        rule(2, 'OPTUMRX CREDENTIALING', 229),
      ]),
    ).toBe(2);
    expect(
      winner('AMERISOURCEBERGEN', [
        rule(1, 'AMERISOURCE', 40),
        rule(2, 'AMERISOURCEBERGEN', 40),
      ]),
    ).toBe(2);
    expect(
      winner('ANDA', [
        rule(1, 'ANDA', 60, null, day(5)),
        rule(2, 'ANDA', 60, null, day(2)),
      ]),
    ).toBe(2);
    expect(winner('ANDA', [rule(9, 'ANDA', 60), rule(3, 'ANDA', 60)])).toBe(3);
  });

  it('gives the same answer in any load order', () => {
    const rules = [
      rule(1, 'ANDA', 60),
      rule(2, 'ANDA PHARMA', 60),
      rule(3, 'WITHDRAWAL', 5, 4),
      rule(4, 'ANDA', 60, null, day(0)),
      rule(5, 'PHARMA', 10),
    ];
    const expected = matchingRules('WITHDRAWAL ANDA PHARMA', rules).map(
      (r) => r.id,
    );
    expect(expected).toEqual([3, 5, 2, 4, 1]);
    for (let i = 0; i < 20; i++) {
      const shuffled = [...rules].sort(() => Math.random() - 0.5);
      expect(
        matchingRules('WITHDRAWAL ANDA PHARMA', shuffled).map((r) => r.id),
      ).toEqual(expected);
    }
  });

  it('returns nothing when no rule matches', () => {
    expect(matchingRules('ZELLE TO JORDAN', [rule(1, 'ANDA', 1)])).toEqual([]);
  });
});
