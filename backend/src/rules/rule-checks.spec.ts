import { keywordProblem } from './rule-checks.js';

describe('keywordProblem', () => {
  it.each([
    'MCKESSON',
    'DEPOSIT INDEPENDENT PHAR',
    'CARDMEMBER SERV',
    'COSTCO GAS',
    'MN STATE-MMB',
    'AUTOMATIC PAYMENT - THANK',
  ])('accepts %s', (keyword) => {
    expect(keywordProblem(keyword)).toBeNull();
  });

  it.each([
    'ZELLE',
    'CHECK',
    'WEB AUTHORIZED PMT',
    'MOBILE BANKING TRANSFER TO',
    'ELECTRONIC DEPOSIT',
  ])('rejects payment words only: %s', (keyword) => {
    expect(keywordProblem(keyword)).toMatch(/only payment words/);
  });

  it.each(['7134', '000000009911', '#0999'])(
    'rejects numbers only: %s',
    (keyword) => {
      expect(keywordProblem(keyword)).toMatch(/needs letters/);
    },
  );

  it.each(['AMAZON MKTPLACE', 'TARGET', 'COSTCO WHSE', 'CARIBOU COFFEE'])(
    'rejects mixed-use stores: %s',
    (keyword) => {
      expect(keywordProblem(keyword)).toMatch(/business and personal/);
    },
  );
});
