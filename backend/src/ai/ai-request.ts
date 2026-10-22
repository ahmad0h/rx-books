/**
 * Building the AI request and checking its answer. Pure functions, so the
 * same input always gives the same request (which also keeps the prompt cache warm).
 */
import { UNCATEGORIZED_CODE } from '../coa/coa-account.entity.js';
import type { CoaAccountView } from '../coa/coa-account.entity.js';
import {
  SUBTAGS,
  type Subtag,
} from '../transactions/bank-transaction.entity.js';

/** PRD 8.5: about 40 rows per request. */
export const BATCH_SIZE = 40;
const OWNER_DRAW = '2510';
const MAX_RATIONALE = 120;

export interface AiRow {
  id: number;
  date: string;
  description: string;
  memo: string | null;
  amount: string;
  lastFour: string | null;
}

export interface OwnAccountLine {
  coaCode: string;
  coaLabel: string;
  name: string;
  bank: string;
  lastFour: string;
}

export interface Suggestion {
  /** A real account, or 9999 when the AI couldn't place the row. */
  category: string;
  confidence: number;
  rationale: string;
  subtag: Subtag | null;
  subtagNote: string | null;
}

/** Accounts the AI may choose: active ones that take transactions, by code. */
export function allowedAccounts(accounts: CoaAccountView[]): CoaAccountView[] {
  return accounts
    .filter(
      (a) => a.isActive && a.categorizable && a.code !== UNCATEGORIZED_CODE,
    )
    .sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * The cached part: the editable instructions plus the chart of accounts.
 * Same for every pharmacy and every batch.
 */
export function buildSystem(
  instructions: string,
  accounts: CoaAccountView[],
): string {
  const lines = allowedAccounts(accounts).map((a) =>
    a.description ? `${a.label} — ${a.description}` : a.label,
  );
  return [
    instructions.trim(),
    '## Chart of accounts',
    'Choose only from these codes.',
    ...lines,
    `${UNCATEGORIZED_CODE} · Uncategorized — when you can't tell.`,
  ].join('\n');
}

/** The per-request part: this pharmacy's own accounts and the rows to categorize. */
export function buildUser(own: OwnAccountLine[], rows: AiRow[]): string {
  const accounts = own.length
    ? own.map(
        (a) => `- ${a.coaLabel}: ${a.name}, ${a.bank} ending ${a.lastFour}`,
      )
    : ['- (none recorded)'];
  const transactions = rows.map((r) =>
    JSON.stringify({
      id: r.id,
      date: r.date,
      description: r.description,
      memo: r.memo,
      amount: r.amount,
      last_four: r.lastFour,
    }),
  );
  return [
    "The pharmacy's own bank and card accounts:",
    ...accounts,
    '',
    `Categorize these ${rows.length} transactions (one JSON object per line):`,
    ...transactions,
  ].join('\n');
}

/** The exact shape the answer must have (structured outputs). */
export function responseSchema(codes: string[]): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            category: { type: 'string', enum: [...codes, UNCATEGORIZED_CODE] },
            confidence: { type: 'integer' },
            rationale: { type: 'string' },
            subtag: { type: 'string', enum: ['none', ...SUBTAGS] },
            subtag_note: { type: 'string' },
          },
          required: [
            'id',
            'category',
            'confidence',
            'rationale',
            'subtag',
            'subtag_note',
          ],
          additionalProperties: false,
        },
      },
    },
    required: ['suggestions'],
    additionalProperties: false,
  };
}

/**
 * Reads the AI's answer and keeps only valid suggestions for rows that were sent.
 * Anything else is dropped, so those rows simply stay where they were.
 */
export function parseAnswer(
  text: string,
  sentIds: number[],
  codes: string[],
): Map<number, Suggestion> {
  const result = new Map<number, Suggestion>();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return result;
  }
  const items = (data as { suggestions?: unknown })?.suggestions;
  if (!Array.isArray(items)) return result;

  const sent = new Set(sentIds);
  const allowed = new Set([...codes, UNCATEGORIZED_CODE]);
  for (const item of items as Record<string, unknown>[]) {
    const id = item?.id;
    const category = item?.category;
    if (typeof id !== 'number' || !sent.has(id) || result.has(id)) continue;
    if (typeof category !== 'string' || !allowed.has(category)) continue;
    const confidence = Math.round(Number(item.confidence));
    const subtag = SUBTAGS.find((s) => s === item.subtag) ?? null;
    const note =
      typeof item.subtag_note === 'string' ? item.subtag_note.trim() : '';
    const isDraw = category === OWNER_DRAW;
    result.set(id, {
      category,
      confidence: Number.isFinite(confidence)
        ? Math.min(100, Math.max(0, confidence))
        : 0,
      rationale: (typeof item.rationale === 'string'
        ? item.rationale.trim()
        : ''
      ).slice(0, MAX_RATIONALE),
      subtag: isDraw ? subtag : null,
      subtagNote: isDraw && note ? note.slice(0, 300) : null,
    });
  }
  return result;
}

export interface TokenUsage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/** List prices in US$ per million tokens (cache writes at 1.25× input, 5-minute TTL). */
const PRICES: Record<
  string,
  { input: number; output: number; cacheWrite: number; cacheRead: number }
> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  'claude-sonnet-5-5': {
    input: 2,
    output: 10,
    cacheWrite: 2.5,
    cacheRead: 0.2,
  },
  'claude-haiku-5-5': {
    input: 0.1,
    output: 0.5,
    cacheWrite: 0.125,
    cacheRead: 0.01,
  },
};

/** Estimated cost of a run; null when the model's price isn't known here. */
export function estimateCost(model: string, usage: TokenUsage): number | null {
  const price = PRICES[model];
  if (!price) return null;
  return (
    (usage.input * price.input +
      usage.output * price.output +
      usage.cacheWrite * price.cacheWrite +
      usage.cacheRead * price.cacheRead) /
    1_000_000
  );
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}
