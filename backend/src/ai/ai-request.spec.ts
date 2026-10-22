import type { CoaAccountView } from '../coa/coa-account.entity.js';
import {
  allowedAccounts,
  buildSystem,
  buildUser,
  chunk,
  estimateCost,
  parseAnswer,
  responseSchema,
} from './ai-request.js';

const account = (
  code: string,
  name: string,
  extra: Partial<CoaAccountView> = {},
): CoaAccountView => ({
  code,
  name,
  label: `${code} · ${name}`,
  type: 'expense',
  expenseGroup: null,
  description: null,
  ownerLabel: null,
  categorizable: true,
  contraOf: null,
  isActive: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...extra,
});

const coa = [
  account('6110', 'Rent', { description: 'Store lease.' }),
  account('2510', 'Owner draw / personal', { type: 'equity' }),
  account('1515', 'Accumulated depreciation', { categorizable: false }),
  account('6999', 'Old account', { isActive: false }),
  account('9999', 'Uncategorized — needs review', { type: 'review' }),
];

describe('AI request', () => {
  it('lists only accounts a transaction can go to, in code order', () => {
    expect(allowedAccounts(coa).map((a) => a.code)).toEqual(['2510', '6110']);
    const system = buildSystem('  Be careful.  ', coa);
    expect(system).toBe(
      [
        'Be careful.',
        '## Chart of accounts',
        'Choose only from these codes.',
        '2510 · Owner draw / personal',
        '6110 · Rent — Store lease.',
        "9999 · Uncategorized — when you can't tell.",
      ].join('\n'),
    );
    // The same input always gives the same text, so the prompt cache stays warm.
    expect(buildSystem('  Be careful.  ', [...coa].reverse())).toBe(system);
  });

  it('describes the pharmacy accounts and one JSON line per row', () => {
    const user = buildUser(
      [
        {
          coaCode: '1010',
          coaLabel: '1010 · Cash — checking 1',
          name: 'Main checking',
          bank: 'US Bank',
          lastFour: '4821',
        },
      ],
      [
        {
          id: 7,
          date: '2025-01-20',
          description: 'TRANSFER TO ACCOUNT 000000009911',
          memo: null,
          amount: '-5000.00',
          lastFour: '9911',
        },
      ],
    );
    expect(user).toContain(
      '- 1010 · Cash — checking 1: Main checking, US Bank ending 4821',
    );
    expect(user).toContain('Categorize these 1 transactions');
    expect(user).toContain(
      '{"id":7,"date":"2025-01-20","description":"TRANSFER TO ACCOUNT 000000009911","memo":null,"amount":"-5000.00","last_four":"9911"}',
    );
  });

  it('only allows known codes and subtags in the answer', () => {
    const schema = responseSchema(['2510', '6110']) as {
      properties: {
        suggestions: {
          items: { properties: Record<string, { enum?: string[] }> };
        };
      };
    };
    const item = schema.properties.suggestions.items.properties;
    expect(item.category.enum).toEqual(['2510', '6110', '9999']);
    expect(item.subtag.enum).toEqual([
      'none',
      'personal',
      'distribution',
      'charity',
    ]);
  });

  it('keeps only valid answers for rows that were sent', () => {
    const answer = JSON.stringify({
      suggestions: [
        {
          id: 1,
          category: '6110',
          confidence: 130,
          rationale: 'x'.repeat(200),
          subtag: 'personal',
          subtag_note: 'n',
        },
        {
          id: 2,
          category: '2510',
          confidence: 80,
          rationale: 'Owner transfer',
          subtag: 'distribution',
          subtag_note: 'Profit draw',
        },
        {
          id: 3,
          category: 'ABCD',
          confidence: 50,
          rationale: '',
          subtag: 'none',
          subtag_note: '',
        },
        {
          id: 99,
          category: '6110',
          confidence: 50,
          rationale: '',
          subtag: 'none',
          subtag_note: '',
        },
        {
          id: 2,
          category: '6110',
          confidence: 10,
          rationale: 'duplicate',
          subtag: 'none',
          subtag_note: '',
        },
      ],
    });
    const result = parseAnswer(answer, [1, 2, 3], ['2510', '6110']);
    expect([...result.keys()]).toEqual([1, 2]);
    expect(result.get(1)).toEqual({
      category: '6110',
      confidence: 100,
      rationale: 'x'.repeat(120),
      subtag: null, // subtags belong to 2510 only
      subtagNote: null,
    });
    expect(result.get(2)).toMatchObject({
      subtag: 'distribution',
      subtagNote: 'Profit draw',
    });
    expect(parseAnswer('not json', [1], ['6110']).size).toBe(0);
  });

  it('estimates cost from list prices', () => {
    expect(
      estimateCost('claude-opus-5-5', {
        input: 1_000_000,
        output: 100_000,
        cacheWrite: 0,
        cacheRead: 1_000_000,
      }),
    ).toBeCloseTo(4 + 2 + 0.2);
    expect(
      estimateCost('claude-unknown', {
        input: 1,
        output: 1,
        cacheWrite: 0,
        cacheRead: 0,
      }),
    ).toBeNull();
  });

  it('splits rows into batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
