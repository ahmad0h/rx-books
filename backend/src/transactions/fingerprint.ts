import { createHash } from 'node:crypto';
import type { ParsedRow } from './bank-formats.js';

/** PRD 10.1: trimmed, upper-case, repeated spaces collapsed. Nothing else removed. */
export function normalizeDescription(text: string): string {
  return text.trim().toUpperCase().replace(/\s+/g, ' ');
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export interface FingerprintedRow extends ParsedRow {
  /** Same for identical rows (same account, date, amount and description). */
  signature: string;
  /** 1, 2, 3… among identical rows, in file order. */
  occurrence: number;
  /** Permanent identity: loading the same file again gives the same ids. */
  sourceRowId: string;
}

/** Gives each row its signature, occurrence number and source_row_id. */
export function fingerprint(
  pharmacyId: number,
  accountId: number,
  rows: ParsedRow[],
): FingerprintedRow[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const key = [
      pharmacyId,
      accountId,
      row.date,
      row.cents,
      normalizeDescription(row.description),
    ].join('|');
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);
    return {
      ...row,
      signature: sha256(key),
      occurrence,
      sourceRowId: sha256(`${key}|${occurrence}`),
    };
  });
}

export function fileFingerprint(text: string): string {
  return sha256(text);
}
