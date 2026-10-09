import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Starting chart of accounts, from "RxBooks — Chart of Accounts Reference"
 * (19 Aug 2026, 45 categorizable accounts + 1515). Bank and card accounts use
 * generic names (which bank it is belongs to each pharmacy's own accounts).
 * Client-specific details from the reference are deliberately left out.
 *
 * The data lives inside this migration on purpose: a migration must never
 * change once it has run, so later edits happen in the admin screen.
 */
type Seed = [
  code: string,
  name: string,
  type: string,
  expenseGroup: string | null,
  ownerLabel: string | null,
  categorizable: boolean,
  contraOf: string | null,
  description: string,
];

const ACCOUNTS: Seed[] = [
  // Revenue
  [
    '4010',
    'Rx revenue — third-party / PBM',
    'revenue',
    null,
    'Insurance & PBM payments',
    true,
    null,
    'Prescription reimbursements deposited by PBMs and insurers (Caremark, OptumRx, Express Scripts, Humana, Prime, Navitus, Argus, state Medicaid). The plan-paid portion of dispensed claims. Deposits only.',
  ],
  [
    '4030',
    'Cash & patient-pay revenue',
    'revenue',
    null,
    'Cash & copay sales',
    true,
    null,
    'Money taken directly from patients: cash and patient co-pays / out-of-pocket at the register.',
  ],
  [
    '4040',
    'OTC / front-end sales',
    'revenue',
    null,
    'Store sales',
    true,
    null,
    'Sales of over-the-counter and front-end retail merchandise (non-prescription).',
  ],

  // Cost of goods sold
  [
    '5010',
    'Rx drugs — wholesale',
    'cost_of_goods',
    null,
    'Prescription drug purchases',
    true,
    null,
    'Prescription drug inventory bought from wholesalers (McKesson, Cardinal, AmerisourceBergen, IPC, ANDA, ParMed, etc.). The largest cost line at a pharmacy.',
  ],
  [
    '5020',
    'OTC inventory',
    'cost_of_goods',
    null,
    'Over-the-counter stock',
    true,
    null,
    'Over-the-counter products purchased for resale.',
  ],
  [
    '5030',
    'Compounding supplies',
    'cost_of_goods',
    null,
    'Compounding supplies',
    true,
    null,
    'Chemicals, bases and supplies used to compound medications (PCCA, Medisca, Letco).',
  ],
  [
    '5040',
    'Front-end inventory',
    'cost_of_goods',
    null,
    'Store merchandise',
    true,
    null,
    'Non-drug retail merchandise purchased for resale (e.g. Costco front-end stock).',
  ],
  [
    '5050',
    'Rx packaging & vials',
    'cost_of_goods',
    null,
    'Bottles, vials & labels',
    true,
    null,
    'Vials, bottles, labels and bags used to dispense prescriptions.',
  ],
  [
    '5090',
    'Purchase rebates & chargebacks',
    'cost_of_goods',
    null,
    'Supplier rebates & credits',
    true,
    '5010',
    'Buying-group / wholesaler rebates (money back, lowers drug cost) and their clawbacks. Contra-COGS: nets against 5010. Deposits reduce cost; withdrawals are reversals.',
  ],

  // Operating expenses — Labor
  [
    '6010',
    'Wages & salaries',
    'expense',
    'Labor',
    'Staff wages',
    true,
    null,
    'W-2 employee gross pay (payroll runs, e.g. ADP wage pay).',
  ],
  [
    '6020',
    'Payroll taxes',
    'expense',
    'Labor',
    'Payroll taxes',
    true,
    null,
    'Employer payroll taxes and tax remittances (e.g. ADP tax).',
  ],
  [
    '6030',
    'Employee benefits',
    'expense',
    'Labor',
    'Staff benefits',
    true,
    null,
    'Employee health insurance and benefit premiums (e.g. UCare, ADP 401k).',
  ],
  [
    '6040',
    'Contract labor',
    'expense',
    'Labor',
    'Contractors',
    true,
    null,
    'Payments to non-employee 1099 contractors, including informal Zelle payments that were reported on a filed 1099.',
  ],

  // Operating expenses — Occupancy
  [
    '6110',
    'Rent',
    'expense',
    'Occupancy',
    'Rent',
    true,
    null,
    'Store lease / rent payments.',
  ],
  [
    '6120',
    'Utilities — gas & electric',
    'expense',
    'Occupancy',
    'Electricity & gas',
    true,
    null,
    'Electricity and gas (e.g. Xcel Energy, CenterPoint).',
  ],
  [
    '6130',
    'Utilities — water / waste',
    'expense',
    'Occupancy',
    'Water & trash',
    true,
    null,
    'Water, sewer and trash / waste service.',
  ],
  [
    '6140',
    'Internet & phone',
    'expense',
    'Occupancy',
    'Internet & phone',
    true,
    null,
    'Business internet and phone (e.g. Comcast, CenturyLink, Lumen).',
  ],
  [
    '6150',
    'Repairs & maintenance',
    'expense',
    'Occupancy',
    'Repairs & maintenance',
    true,
    null,
    'Upkeep and repair of the store and its equipment.',
  ],

  // Operating expenses — Regulatory
  [
    '6210',
    'Licenses & permits',
    'expense',
    'Regulatory',
    'Licenses & permits',
    true,
    null,
    'Pharmacy licenses, DEA registration and state board of pharmacy fees.',
  ],

  // Operating expenses — Professional
  [
    '6220',
    'Professional fees — legal & accounting',
    'expense',
    'Professional',
    'Legal & accounting fees',
    true,
    null,
    "Lawyers, accountants and bookkeeping fees (including RxBooks' own fee).",
  ],
  [
    '6230',
    'Software & subscriptions',
    'expense',
    'Professional',
    'Software & subscriptions',
    true,
    null,
    'Pharmacy management system and business software (PioneerRx, BestRx, QuickBooks / Intuit).',
  ],
  [
    '6240',
    'Insurance — general & liability',
    'expense',
    'Professional',
    'Business insurance',
    true,
    null,
    'Business and professional liability insurance (e.g. Pharmacists Mutual, Hanover).',
  ],
  [
    '6250',
    'Dues & memberships',
    'expense',
    'Professional',
    'Memberships & dues',
    true,
    null,
    'Professional association dues (NCPA, state pharmacists association, APhA).',
  ],

  // Operating expenses — General
  [
    '6310',
    'Office supplies',
    'expense',
    'General',
    'Office supplies',
    true,
    null,
    'General office and administrative supplies.',
  ],
  [
    '6320',
    'Breakroom & supplies',
    'expense',
    'General',
    'Break room & small supplies',
    true,
    null,
    'Staff breakroom items and small operating supplies.',
  ],
  [
    '6330',
    'Marketing & advertising',
    'expense',
    'General',
    'Advertising',
    true,
    null,
    'Advertising, promotion, and sponsorships where the business receives advertising value.',
  ],
  [
    '6340',
    'Merchant & bank fees',
    'expense',
    'General',
    'Card processing & bank fees',
    true,
    null,
    'Card-processing and bank fees (e.g. Square, WorldPay, Stripe).',
  ],
  [
    '6350',
    'Vehicle — fuel',
    'expense',
    'General',
    'Fuel',
    true,
    null,
    'Fuel for business / delivery vehicle use.',
  ],
  [
    '6360',
    'Vehicle — maintenance',
    'expense',
    'General',
    'Vehicle repairs',
    true,
    null,
    'Maintenance and repair of the business vehicle.',
  ],
  [
    '6370',
    'Meals — 50% deductible',
    'expense',
    'General',
    'Business meals',
    true,
    null,
    'Ordinary business meals (client/vendor meeting, working lunch). 50% deductible.',
  ],
  [
    '6375',
    'Meals — staff & holiday events (100%)',
    'expense',
    'General',
    'Staff events & meals',
    true,
    null,
    'Staff social, holiday or team events where employees are the primary attendees. 100% deductible under IRC §274(e)(4).',
  ],
  [
    '6380',
    'Travel — business',
    'expense',
    'General',
    'Business travel',
    true,
    null,
    'Business travel: airfare, lodging, ground transport.',
  ],
  [
    '6390',
    'Continuing education',
    'expense',
    'General',
    'Training & education',
    true,
    null,
    'Continuing education, training and conferences.',
  ],

  // Balance sheet — assets
  [
    '1010',
    'Cash — checking 1',
    'asset',
    null,
    'Checking account',
    true,
    null,
    "The pharmacy's primary operating checking account. Which bank it is is recorded per pharmacy.",
  ],
  [
    '1015',
    'Cash on Hand',
    'asset',
    null,
    'Cash kept at the pharmacy',
    true,
    null,
    'Physical cash held outside the bank: the register drawer / cashback float. Bulk teller "Customer Withdrawal" debits that restock the drawer are transfers into this account, not expenses or draws. Never appears on the P&L. Needs a periodic till reconciliation.',
  ],
  [
    '1020',
    'Cash — savings 1',
    'asset',
    null,
    'Savings account',
    true,
    null,
    "The pharmacy's savings account. Destination for transfers out of checking: balance-sheet movements, not draws or expenses, and never 2510.",
  ],
  [
    '1210',
    'Due from / to related party',
    'asset',
    null,
    'Money to or from a related business',
    true,
    null,
    'Money moving between the pharmacy and a separate company, even one under common ownership. One account for both directions; which company is on the other side is recorded on each transaction. Not 2510. Rules routing here are never auto-approved.',
  ],
  [
    '1510',
    'Equipment & fixtures',
    'asset',
    null,
    'Equipment & fixtures',
    true,
    null,
    'Capital purchases of equipment / fixtures (over $1,500). Depreciated over time, not expensed at once.',
  ],
  [
    '1515',
    'Accumulated depreciation',
    'asset',
    null,
    null,
    false,
    '1510',
    'Contra-asset for depreciation booked against 1510. A year-end journal entry by the tax preparer, never a bank or card transaction, so it is not offered for categorizing.',
  ],

  // Balance sheet — liabilities
  [
    '2010',
    'Credit card 1',
    'liability',
    null,
    'Credit card 1',
    true,
    null,
    'First business credit card. Payments from checking to this card are transfers, not expenses. Which card it is is recorded per pharmacy.',
  ],
  [
    '2020',
    'Credit card 2',
    'liability',
    null,
    'Credit card 2',
    true,
    null,
    'Second business credit card. Same transfer treatment as 2010.',
  ],
  [
    '2030',
    'Credit card 3',
    'liability',
    null,
    'Credit card 3',
    true,
    null,
    'Third business credit card. Same transfer treatment as 2010.',
  ],
  [
    '2040',
    'Credit card 4',
    'liability',
    null,
    'Credit card 4',
    true,
    null,
    'Fourth business credit card. Same transfer treatment as 2010. Cards billed centrally ("not a bill" memo statements) are reconciled at the central billing account.',
  ],

  // Equity
  [
    '2510',
    'Owner draw / personal',
    'equity',
    null,
    'Personal / owner use',
    true,
    null,
    'Shareholder and personal items. Each transaction carries a subtag (personal, distribution or charity) and the name of the shareholder or charity. Transfers between own accounts and to other companies do not belong here.',
  ],
  [
    '3010',
    'Owner contribution',
    'equity',
    null,
    'Money the owner put in',
    true,
    null,
    'Owner money put into the business (capital in).',
  ],

  // Review
  [
    '9999',
    'Uncategorized — needs review',
    'review',
    null,
    'Not sure',
    true,
    null,
    'Catch-all for transactions no rule matched, waiting for staff, AI or owner review. Nothing should stay here at month-close.',
  ],
];

export class CreateChartOfAccounts1790700000000 implements MigrationInterface {
  name = 'CreateChartOfAccounts1790700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`coa_accounts\` (
        \`code\` char(4) NOT NULL,
        \`name\` varchar(120) NOT NULL,
        \`type\` enum('revenue', 'cost_of_goods', 'expense', 'asset', 'liability', 'equity', 'review') NOT NULL,
        \`expense_group\` varchar(40) NULL,
        \`description\` varchar(1000) NULL,
        \`owner_label\` varchar(120) NULL,
        \`categorizable\` tinyint NOT NULL DEFAULT 1,
        \`contra_of\` char(4) NULL,
        \`is_active\` tinyint NOT NULL DEFAULT 1,
        \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`code\`),
        UNIQUE KEY \`uq_coa_accounts_name\` (\`name\`),
        CONSTRAINT \`chk_coa_code\` CHECK (\`code\` REGEXP '^[0-9]{4}$')
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    for (const [
      code,
      name,
      type,
      expenseGroup,
      ownerLabel,
      categorizable,
      ,
      description,
    ] of ACCOUNTS) {
      await queryRunner.query(
        'INSERT INTO `coa_accounts` (`code`, `name`, `type`, `expense_group`, `owner_label`, `categorizable`, `description`) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          code,
          name,
          type,
          expenseGroup,
          ownerLabel,
          categorizable ? 1 : 0,
          description,
        ],
      );
    }
    // Offsets are set after every account exists.
    for (const [code, , , , , , contraOf] of ACCOUNTS) {
      if (contraOf) {
        await queryRunner.query(
          'UPDATE `coa_accounts` SET `contra_of` = ? WHERE `code` = ?',
          [contraOf, code],
        );
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `coa_accounts`');
  }
}
