import { categorize, type EngineRule, type OwnAccount } from './engine.js';

const CHECKING = 1;
const CARD = 2;
const own: OwnAccount[] = [
  { id: CHECKING, lastFour: '4821', coaCode: '1010' },
  { id: CARD, lastFour: '7702', coaCode: '2010' },
];
const rule = (
  id: number,
  keyword: string,
  coaCode: string,
  autoApprove = true,
  pharmacyId: number | null = null,
): EngineRule => ({
  id,
  keyword,
  coaCode,
  autoApprove,
  pharmacyId,
  priority: 10 * id,
  createdAt: new Date(0),
});
const rules = [
  rule(1, 'MCKESSON', '5010'),
  rule(2, 'GUSTO', '6010', false, 7),
  rule(3, 'TRANSFER', '6999'),
];
const run = (
  description: string,
  lastFour: string | null = null,
  accountId = CHECKING,
) => categorize({ accountId, description, lastFour }, own, rules);

describe('categorize', () => {
  it('approves with an auto-approve rule', () => {
    expect(run('ELECTRONIC WITHDRAWAL MCKESSON')).toEqual({
      coaCode: '5010',
      status: 'approved',
      source: 'rule',
      ruleId: 1,
      flag: null,
    });
  });

  it('only suggests when the rule needs a person', () => {
    expect(run('ELECTRONIC WITHDRAWAL GUSTO')).toMatchObject({
      coaCode: '6010',
      status: 'suggested',
      ruleId: 2,
    });
  });

  it('treats a payment to one of our own accounts as a transfer, before any rule', () => {
    expect(run('WEB PYMT ********7702 TRANSFER', '7702')).toEqual({
      coaCode: '2010',
      status: 'suggested',
      source: 'own_account',
      ruleId: null,
      flag: null,
    });
  });

  it('ignores the account its own number appears on', () => {
    expect(run('PAYMENT TO ********7702', '7702', CARD)).toMatchObject({
      status: 'uncategorized',
      flag: null,
    });
  });

  it('flags an unknown account number and never auto-approves it', () => {
    expect(
      run('MOBILE BANKING TRANSFER TO ACCOUNT 000000009911', '9911'),
    ).toEqual({
      coaCode: '6999',
      status: 'suggested',
      source: 'rule',
      ruleId: 3,
      flag: 'unknown_account',
    });
    expect(run('ZELLE TO ********9911', '9911')).toEqual({
      coaCode: '9999',
      status: 'uncategorized',
      source: null,
      ruleId: null,
      flag: 'unknown_account',
    });
  });

  it('leaves unmatched rows in 9999', () => {
    expect(run('ZELLE INSTANT PMT TO JORDAN LEE')).toMatchObject({
      coaCode: '9999',
      status: 'uncategorized',
      source: null,
    });
  });
});
