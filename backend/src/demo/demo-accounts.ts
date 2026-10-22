import type { PharmacyAccountInput } from '../pharmacy-accounts/pharmacy-account.input.js';

/**
 * The two accounts in the demo statements (03_Data Model & Samples):
 * "DEMO USBank Checking 4821" and "DEMO Chase Credit Card 7702".
 */
export const DEMO_ACCOUNTS: PharmacyAccountInput[] = [
  {
    name: 'Main operating checking',
    kind: 'checking',
    bank: 'US Bank',
    lastFour: '4821',
    coaCode: '1010',
    openedOn: null,
    closedOn: null,
    notes: 'Primary account: PBM deposits, card settlements, payroll and rent.',
  },
  {
    name: 'Business credit card',
    kind: 'credit_card',
    bank: 'Chase',
    lastFour: '7702',
    coaCode: '2010',
    openedOn: null,
    closedOn: null,
    notes: 'Paid from checking (WEB PYMT ********7702).',
  },
];
