/** Largest amount a DECIMAL(12,2) column holds, in cents. */
const MAX_CENTS = 999_999_999_999;

/**
 * "1,234.50", "-58.2", "$12", "(40.00)" → whole cents, or null when it isn't a
 * plain amount. Cents avoid floating-point rounding.
 */
export function parseCents(text: string): number | null {
  let value = text.trim().replace(/[$,\s]/g, '');
  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (value.startsWith('-')) {
    negative = !negative;
    value = value.slice(1);
  } else if (value.startsWith('+')) {
    value = value.slice(1);
  }
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (cents > MAX_CENTS) return null;
  return negative && cents !== 0 ? -cents : cents;
}

/** Cents → exact decimal string, e.g. -312040 → "-3120.40". */
export function centsToDecimal(cents: number): string {
  const abs = Math.abs(cents);
  const text = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return cents < 0 ? `-${text}` : text;
}

/** Month-first dates as US banks export them: "1/14/2025" → "2025-01-14". */
export function parseUsDate(text: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [month, day, year] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
