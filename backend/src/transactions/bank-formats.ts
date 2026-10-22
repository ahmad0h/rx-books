import type { AccountKind } from '../pharmacy-accounts/pharmacy-account.entity.js';
import { parseCsv } from './csv.js';
import { parseCents, parseUsDate } from './money.js';

/** One row read from a bank file, in the same shape whatever the bank. */
export interface ParsedRow {
  /** Line in the file (the header is line 1). */
  line: number;
  date: string;
  postDate: string | null;
  description: string;
  memo: string | null;
  /** Negative = money out of the pharmacy (or a card purchase). */
  cents: number;
  typeHint: string | null;
  lastFour: string | null;
}

export interface BankFormat {
  id: string;
  label: string;
  /** Account types this file can belong to. */
  kinds: AccountKind[];
  /** Header names, compared without case or surrounding spaces. */
  columns: string[];
  date: string;
  postDate?: string;
  description: string;
  memo?: string;
  amount: string;
  typeHint?: string;
}

/** PRD 11.1: one format per bank. Detected from the header row, not from what was typed. */
export const BANK_FORMATS: BankFormat[] = [
  {
    id: 'chase_card',
    label: 'Chase credit card',
    kinds: ['credit_card'],
    columns: [
      'transaction date',
      'post date',
      'description',
      'category',
      'type',
      'amount',
      'memo',
    ],
    date: 'transaction date',
    postDate: 'post date',
    description: 'description',
    memo: 'memo',
    amount: 'amount',
    typeHint: 'type',
  },
  {
    id: 'usbank_checking',
    label: 'US Bank checking / savings',
    kinds: ['checking', 'savings'],
    columns: ['date', 'transaction', 'name', 'memo', 'amount'],
    date: 'date',
    description: 'name',
    memo: 'memo',
    amount: 'amount',
    typeHint: 'transaction',
  },
];

export const MAX_ROWS = 10_000;
const MAX_TEXT = 500;
const MAX_ERRORS = 20;

/**
 * A masked account number: "********7702", "XXXX1234" or "ACCOUNT 000000009911".
 * Only the last four digits are kept.
 */
const MASKED_NUMBER = /(?:[*Xx]{2,}|\b0{3,})\d*?(\d{4})\b/;

export function lastFourIn(...texts: (string | null)[]): string | null {
  for (const text of texts) {
    const match = text ? MASKED_NUMBER.exec(text) : null;
    if (match) return match[1];
  }
  return null;
}

export type ReadResult =
  | { ok: true; format: BankFormat; rows: ParsedRow[] }
  | { ok: false; errors: string[] };

/** Reads a whole bank file. Any bad row fails the file, so nothing is half-loaded. */
export function readBankFile(text: string): ReadResult {
  const [header, ...body] = parseCsv(text);
  if (!header) return { ok: false, errors: ['The file is empty.'] };

  const names = header.map((h) => h.trim().toLowerCase());
  const format = BANK_FORMATS.find((f) =>
    f.columns.every((c) => names.includes(c)),
  );
  if (!format) {
    return {
      ok: false,
      errors: [
        `This file's columns (${header.join(', ')}) don't match a known bank format. ` +
          `Supported: ${BANK_FORMATS.map((f) => f.label).join(', ')}.`,
      ],
    };
  }
  if (body.length === 0)
    return { ok: false, errors: ['The file has no transactions.'] };
  if (body.length > MAX_ROWS) {
    return {
      ok: false,
      errors: [`The file has more than ${MAX_ROWS} rows. Split it by month.`],
    };
  }

  const at = (name: string) => names.indexOf(name);
  const cell = (cells: string[], name?: string) =>
    name ? (cells[at(name)] ?? '').trim() : '';
  const rows: ParsedRow[] = [];
  const errors: string[] = [];

  body.forEach((cells, index) => {
    const line = index + 2;
    const problems: string[] = [];
    const date = parseUsDate(cell(cells, format.date));
    if (!date)
      problems.push(
        `the date "${cell(cells, format.date)}" is not a valid MM/DD/YYYY date`,
      );
    const postText = cell(cells, format.postDate);
    const postDate = postText ? parseUsDate(postText) : null;
    if (postText && !postDate)
      problems.push(`the post date "${postText}" is not a valid date`);
    const cents = parseCents(cell(cells, format.amount));
    if (cents === null)
      problems.push(
        `the amount "${cell(cells, format.amount)}" is not a number`,
      );
    const description = cell(cells, format.description);
    if (!description) problems.push('the description is empty');
    if (description.length > MAX_TEXT)
      problems.push('the description is too long');
    const memo = cell(cells, format.memo) || null;

    if (problems.length > 0) {
      errors.push(`Row ${line}: ${problems.join('; ')}.`);
      return;
    }
    rows.push({
      line,
      date: date!,
      postDate,
      description,
      memo: memo ? memo.slice(0, MAX_TEXT) : null,
      cents: cents!,
      typeHint: cell(cells, format.typeHint) || null,
      lastFour: lastFourIn(description, memo),
    });
  });

  if (errors.length > 0) {
    const more = errors.length - MAX_ERRORS;
    return {
      ok: false,
      errors:
        more > 0
          ? [
              ...errors.slice(0, MAX_ERRORS),
              `…and ${more} more rows with problems.`,
            ]
          : errors,
    };
  }
  return { ok: true, format, rows };
}
