import { centsToDecimal, parseCents, parseUsDate } from './money.js';

describe('money and dates', () => {
  it.each([
    ['3892.48', 389248],
    ['-58.2', -5820],
    ['-2800', -280000],
    ['$1,234.50', 123450],
    ['(40.00)', -4000],
    ['+7', 700],
    ['-0.00', 0],
  ])('parses %s as %i cents', (text, cents) => {
    expect(parseCents(text)).toBe(cents);
  });

  it.each(['', 'abc', '1.234', '12-3', '1e5', '9999999999999'])(
    'rejects %j',
    (text) => {
      expect(parseCents(text)).toBeNull();
    },
  );

  it('formats cents exactly', () => {
    expect(centsToDecimal(-312040)).toBe('-3120.40');
    expect(centsToDecimal(5)).toBe('0.05');
    expect(centsToDecimal(0)).toBe('0.00');
  });

  it('reads month-first dates and rejects impossible ones', () => {
    expect(parseUsDate('01/14/2025')).toBe('2025-01-14');
    expect(parseUsDate('2/3/2025')).toBe('2025-02-03');
    expect(parseUsDate('02/30/2025')).toBeNull();
    expect(parseUsDate('2025-01-14')).toBeNull();
    expect(parseUsDate('13/01/2025')).toBeNull();
  });
});
