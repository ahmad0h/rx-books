import type { CreateRuleInput } from '../rules/rule.input.js';

export type DemoRule = Omit<CreateRuleInput, 'pharmacyId'>;

/**
 * Made-up rules for the demo pharmacy, written to match the demo bank
 * statements in the handoff (03_Data Model & Samples) and its expected
 * categorization table. They show direction words in keywords, a pharmacy
 * rule alongside a shared one, and rules that need a person to confirm.
 */
export const DEMO_RULES: DemoRule[] = [
  {
    priority: 10,
    keyword: 'DEPOSIT INDEPENDENT PHAR',
    coaCode: '5090',
    tag: 'COOP_REBATE',
    autoApprove: true,
    sourceNote:
      'Co-op rebates paid to the pharmacy. They lower drug cost (5090 offsets 5010).',
  },
  {
    priority: 20,
    keyword: 'WITHDRAWAL INDEPENDENT PHAR',
    coaCode: '5090',
    tag: 'COOP_REBATE_ADJ',
    autoApprove: true,
    sourceNote:
      'Rebate adjustments the co-op takes back. Same vendor as the deposit rule: the direction word keeps them separate.',
  },
  {
    priority: 30,
    keyword: 'OAKMONT PROPERTIES',
    coaCode: '6110',
    tag: 'RENT',
    autoApprove: true,
    sourceNote: 'Store landlord, monthly rent.',
  },
  {
    priority: 40,
    keyword: 'GUSTO',
    coaCode: '6010',
    tag: 'PAYROLL',
    autoApprove: false,
    sourceNote:
      'Payroll provider. Debits mix wages and payroll tax, so staff confirm each one.',
  },
  {
    priority: 50,
    keyword: 'MERCHANT SERVICE',
    coaCode: '4030',
    tag: 'CARD_SETTLEMENT',
    autoApprove: true,
    sourceNote:
      'Card settlement deposits: patient payments and co-pays taken at the register.',
  },
  {
    priority: 60,
    keyword: 'ANALYSIS SERVICE CHARGE',
    coaCode: '6340',
    tag: 'BANK_FEE',
    autoApprove: true,
    sourceNote: 'Monthly account analysis fee from the bank.',
  },
  {
    priority: 70,
    keyword: 'CARDMEMBER SERV',
    coaCode: '2010',
    tag: 'CARD_PAYMENT',
    autoApprove: false,
    sourceNote:
      'Paying the store credit card from checking. A transfer, so staff confirm it.',
  },
  {
    priority: 80,
    keyword: 'AUTOMATIC PAYMENT - THANK',
    coaCode: '1010',
    tag: 'CARD_PAYMENT',
    autoApprove: false,
    sourceNote:
      'The card payment as the card statement shows it: money in from checking (1010). A transfer, so staff confirm it.',
  },
  {
    priority: 90,
    keyword: 'COSTCO GAS',
    coaCode: '6350',
    tag: 'DELIVERY_FUEL',
    autoApprove: true,
    sourceNote:
      'Fuel for the delivery car. (Costco warehouse purchases are mixed-use and get no rule.)',
  },
];
