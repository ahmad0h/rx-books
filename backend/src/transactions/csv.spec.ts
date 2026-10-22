import { parseCsv } from './csv.js';

describe('parseCsv', () => {
  it('reads plain rows and drops blank lines', () => {
    expect(parseCsv('a,b,c\r\n1,2,3\n\n4,5,6\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
      ['4', '5', '6'],
    ]);
  });

  it('handles quotes, commas, line breaks and doubled quotes inside cells', () => {
    expect(parseCsv('x,y\n"A, B","say ""hi""\nthere"')).toEqual([
      ['x', 'y'],
      ['A, B', 'say "hi"\nthere'],
    ]);
  });

  it('ignores a byte-order mark and keeps empty cells', () => {
    expect(parseCsv('﻿Date,Memo\n01/02/2025,')).toEqual([
      ['Date', 'Memo'],
      ['01/02/2025', ''],
    ]);
  });
});
