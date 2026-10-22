import { readFileSync } from 'node:fs';
import { lastFourIn, readBankFile, type ParsedRow } from './bank-formats.js';
import { fingerprint } from './fingerprint.js';
import { centsToDecimal } from './money.js';

const fixture = (name: string) =>
  readFileSync(new URL(`../../test/fixtures/${name}`, import.meta.url), 'utf8');

const read = (name: string) => {
  const result = readBankFile(fixture(name));
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result;
};

const totals = (rows: ParsedRow[]) => ({
  count: rows.length,
  in: centsToDecimal(
    rows.filter((r) => r.cents > 0).reduce((a, r) => a + r.cents, 0),
  ),
  out: centsToDecimal(
    rows.filter((r) => r.cents < 0).reduce((a, r) => a + r.cents, 0),
  ),
});

// Expected numbers come from the demo data README in the handoff.
describe('readBankFile with the demo files', () => {
  it('reads US Bank checking, January', () => {
    const { format, rows } = read('demo_usbank_checking_2025-01.csv');
    expect(format.id).toBe('usbank_checking');
    expect(totals(rows)).toEqual({
      count: 62,
      in: '138680.71',
      out: '-83743.14',
    });
    expect(rows[0]).toMatchObject({
      line: 2,
      date: '2025-01-01',
      postDate: null,
      description: 'ELECTRONIC DEPOSIT CAREMARK',
      memo: 'Download from usbank.com. CVS CAREMARK PMT',
      cents: 389248,
      typeHint: 'CREDIT',
    });
  });

  it('reads US Bank checking, February', () => {
    const { rows } = read('demo_usbank_checking_2025-02.csv');
    expect(totals(rows)).toEqual({
      count: 56,
      in: '130734.96',
      out: '-88748.05',
    });
  });

  it('reads the Chase card file across two months', () => {
    const { format, rows } = read('demo_chase_cc_2025-01_02.csv');
    expect(format.id).toBe('chase_card');
    expect(rows).toHaveLength(22);
    for (const month of ['2025-01', '2025-02']) {
      const inMonth = rows.filter((r) => r.date.startsWith(month));
      expect(totals(inMonth)).toEqual({
        count: 11,
        in: '3120.40',
        out: '-2594.32',
      });
    }
    expect(rows[0]).toMatchObject({
      date: '2025-01-02',
      postDate: '2025-01-03',
      description: 'COSTCO GAS #0999',
      cents: -5820,
      typeHint: 'Sale',
      memo: null,
    });
  });

  it('keeps the last four digits of masked account numbers only', () => {
    const { rows } = read('demo_usbank_checking_2025-01.csv');
    const transfer = rows.find((r) =>
      r.description.includes('TRANSFER TO ACCOUNT'),
    );
    expect(transfer?.lastFour).toBe('9911');
    expect(lastFourIn('WEB PYMT ********7702')).toBe('7702');
    expect(lastFourIn('COSTCO GAS #0999')).toBeNull();
    expect(lastFourIn('TRN*1*2500607134*')).toBeNull();
  });
});

describe('readBankFile problems', () => {
  it('rejects unknown formats and empty files', () => {
    expect(readBankFile('')).toEqual({
      ok: false,
      errors: ['The file is empty.'],
    });
    const unknown = readBankFile('When,What,How much\n01/01/2025,X,1');
    expect(unknown.ok).toBe(false);
    expect(!unknown.ok && unknown.errors[0]).toMatch(
      /don't match a known bank format/,
    );
    expect(readBankFile('Date,Transaction,Name,Memo,Amount\n')).toEqual({
      ok: false,
      errors: ['The file has no transactions.'],
    });
  });

  it('lists every bad row and loads nothing', () => {
    const result = readBankFile(
      [
        'Date,Transaction,Name,Memo,Amount',
        '01/02/2025,DEBIT,GOOD ROW,,-1.00',
        '13/40/2025,DEBIT,BAD DATE,,-1.00',
        '01/03/2025,DEBIT,,,abc',
      ].join('\n'),
    );
    expect(result).toEqual({
      ok: false,
      errors: [
        'Row 3: the date "13/40/2025" is not a valid MM/DD/YYYY date.',
        'Row 4: the amount "abc" is not a number; the description is empty.',
      ],
    });
  });
});

describe('fingerprint', () => {
  const row = (
    description: string,
    cents: number,
    line: number,
  ): ParsedRow => ({
    line,
    date: '2025-01-05',
    postDate: null,
    description,
    memo: null,
    cents,
    typeHint: null,
    lastFour: null,
  });

  it('numbers identical rows and ignores case and spacing', () => {
    const rows = fingerprint(1, 2, [
      row('Rebate  ANDA', 1000, 2),
      row('REBATE ANDA', 1000, 3),
      row('REBATE ANDA', 2000, 4),
    ]);
    expect(rows.map((r) => r.occurrence)).toEqual([1, 2, 1]);
    expect(rows[0].signature).toBe(rows[1].signature);
    expect(rows[0].sourceRowId).not.toBe(rows[1].sourceRowId);
    expect(rows[2].signature).not.toBe(rows[0].signature);
  });

  it('gives the same ids for the same file, and different ids per account', () => {
    const file = read('demo_usbank_checking_2025-01.csv').rows;
    const ids = (accountId: number) =>
      fingerprint(1, accountId, file).map((r) => r.sourceRowId);
    expect(ids(2)).toEqual(ids(2));
    expect(new Set(ids(2)).size).toBe(62);
    expect(ids(3)[0]).not.toBe(ids(2)[0]);
  });
});
