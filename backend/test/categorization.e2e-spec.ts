import { readFileSync } from 'node:fs';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { SHARED_RULES } from '../src/database/migrations/1790800000000-CreateRules.js';
import { DEMO_RULES } from '../src/demo/demo-rules.js';
import { CHOOSE_ACCOUNT_FIRST } from '../src/transactions/transactions.service.js';
import {
  createTestApp,
  type InMemoryCoaRepository,
  type InMemoryRuleRepository,
  type InMemoryUserRepository,
} from './test-app.js';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

interface Row {
  id: number;
  description: string;
  amount: string;
  coaCode: string;
  status: string;
  source: string | null;
  ruleKeyword: string | null;
  flag: string | null;
  approvedBy: string | null;
}

/**
 * The demo README's expected categorization, for what rules can do today.
 * Rows that need AI, the registry, the check register or amount bands stay in 9999.
 * [description starts with / contains, account, status, flag]
 */
const EXPECTED: [string, string, string, string?][] = [
  ['ELECTRONIC DEPOSIT CAREMARK', '4010', 'approved'],
  ['ELECTRONIC DEPOSIT OPTUMRX', '4010', 'approved'],
  ['ELECTRONIC WITHDRAWAL MCKESSON', '5010', 'approved'],
  ['ELECTRONIC DEPOSIT INDEPENDENT PHAR', '5090', 'approved'],
  ['ELECTRONIC WITHDRAWAL INDEPENDENT PHAR', '5090', 'approved'],
  ['ELECTRONIC DEPOSIT MERCHANT SERVICE', '4030', 'approved'],
  ['ELECTRONIC WITHDRAWAL OAKMONT PROPERTIES', '6110', 'approved'],
  ['ELECTRONIC WITHDRAWAL GUSTO', '6010', 'suggested'],
  ['ELECTRONIC WITHDRAWAL XCEL ENERGY', '6120', 'approved'],
  ['ANALYSIS SERVICE CHARGE', '6340', 'approved'],
  ['WEB AUTHORIZED PMT CARDMEMBER SERV', '2010', 'suggested'],
  [
    'MOBILE BANKING TRANSFER TO ACCOUNT',
    '9999',
    'uncategorized',
    'unknown_account',
  ],
  ['ZELLE INSTANT PMT TO JORDAN LEE', '9999', 'uncategorized'],
  ['CHECK', '9999', 'uncategorized'],
  ['COSTCO GAS', '6350', 'approved'],
  ['COSTCO WHSE', '9999', 'uncategorized'],
  ['AMAZON', '9999', 'uncategorized'],
  ['TARGET', '9999', 'uncategorized'],
  ['CARIBOU COFFEE', '9999', 'uncategorized'],
  ['OLIVE GARDEN', '9999', 'uncategorized'],
  ['DELTA AIR', '9999', 'uncategorized'],
  ['PIONEERRX SOFTWARE', '6230', 'approved'],
  ['COMCAST BUSINESS', '6140', 'approved'],
  ['NCPA MEMBERSHIP', '6250', 'approved'],
  ['AUTOMATIC PAYMENT - THANK', '1010', 'suggested'],
];

const coaRow = (code: string, name: string, type: string, isActive = true) => ({
  code,
  name,
  type: type as 'asset',
  expenseGroup: null,
  description: null,
  ownerLabel: null,
  contraOf: null,
  categorizable: code !== '1515',
  isActive,
});

describe('Categorization and review (e2e)', () => {
  let app: NestExpressApplication;
  let users: InMemoryUserRepository;
  let coa: InMemoryCoaRepository;
  let rules: InMemoryRuleRepository;
  let adminCookie: string;
  let pharmacyId: number;
  let checking: number;
  let card: number;
  let ip = 0;

  const admin = () => ({
    get: (url: string) =>
      request(app.getHttpServer()).get(url).set('Cookie', adminCookie),
    post: (url: string, body: object) =>
      request(app.getHttpServer())
        .post(url)
        .set('Cookie', adminCookie)
        .send(body),
    put: (url: string, body: object) =>
      request(app.getHttpServer())
        .put(url)
        .set('Cookie', adminCookie)
        .send(body),
  });
  const base = () => `/api/pharmacies/${pharmacyId}`;
  const month = async (m: string, accountId?: number) =>
    (
      await admin()
        .get(
          `${base()}/transactions?month=${m}${accountId ? `&accountId=${accountId}` : ''}`,
        )
        .expect(200)
    ).body as { transactions: Row[]; totals: Record<string, number | string> };
  const find = async (m: string, text: string) =>
    (await month(m)).transactions.filter((t) => t.description.includes(text));

  beforeAll(async () => {
    ({ app, users, coa, rules } = await createTestApp());
    for (const [code, name, type] of [
      ['1010', 'Cash — checking 1', 'asset'],
      ['1015', 'Cash on Hand', 'asset'],
      ['1515', 'Accumulated depreciation', 'asset'],
      ['2010', 'Credit card 1', 'liability'],
      ['2510', 'Owner draw / personal', 'equity'],
      ['4010', 'Rx revenue — third-party / PBM', 'revenue'],
      ['4030', 'Cash & patient-pay revenue', 'revenue'],
      ['5010', 'Rx drugs — wholesale', 'cost_of_goods'],
      ['5090', 'Purchase rebates & chargebacks', 'cost_of_goods'],
      ['6120', 'Utilities — gas & electric', 'expense'],
      ['6380', 'Travel', 'expense'],
      ['9999', 'Uncategorized — needs review', 'review'],
    ]) {
      coa.add(coaRow(code, name, type));
    }
    coa.add(coaRow('6999', 'Old account', 'expense', false));
    await users.add({
      email: 'admin@rxbooks.test',
      password: 'admin-password-123',
      name: 'Demo Admin',
      role: 'admin',
    });
    adminCookie = (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', `10.7.0.${++ip}`)
        .send({ email: 'admin@rxbooks.test', password: 'admin-password-123' })
        .expect(200)
    ).headers['set-cookie']![0].split(';')[0];

    pharmacyId = (
      (
        await admin()
          .post('/api/pharmacies', {
            name: 'Lakeside Community Pharmacy',
            ownerName: 'Owner',
            ownerPhone: '(612) 555-0142',
            ownerEmail: 'owner@lakeside.test',
          })
          .expect(201)
      ).body as { id: number }
    ).id;

    // The real shared seed and the Lakeside demo rules.
    for (const [
      priority,
      keyword,
      coaCode,
      tag,
      autoApprove,
      created,
      sourceNote,
    ] of SHARED_RULES) {
      rules.add({
        pharmacyId: null,
        keyword,
        coaCode,
        tag,
        priority,
        autoApprove,
        source: 'import',
        sourceNote,
        retiredAt: null,
        createdAt: new Date(`${created}Z`),
      });
    }
    for (const rule of DEMO_RULES) {
      rules.add({
        pharmacyId,
        keyword: rule.keyword,
        coaCode: rule.coaCode,
        tag: rule.tag ?? null,
        priority: rule.priority!,
        autoApprove: rule.autoApprove,
        source: 'manual',
        sourceNote: rule.sourceNote ?? null,
        retiredAt: null,
      });
    }

    const account = { openedOn: null, closedOn: null, notes: null };
    const add = async (body: object) =>
      (
        (
          await admin()
            .post(`${base()}/accounts`, { ...account, ...body })
            .expect(201)
        ).body as { id: number }
      ).id;
    checking = await add({
      name: 'Main operating checking',
      kind: 'checking',
      bank: 'US Bank',
      lastFour: '4821',
      coaCode: '1010',
    });
    card = await add({
      name: 'Business credit card',
      kind: 'credit_card',
      bank: 'Chase',
      lastFour: '7702',
      coaCode: '2010',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs the rules as each file is imported', async () => {
    const jan = await admin()
      .post(`${base()}/uploads`, {
        accountId: checking,
        fileName: 'jan.csv',
        content: fixture('demo_usbank_checking_2025-01.csv'),
      })
      .expect(201);
    expect(jan.body.categorization).toEqual({
      checked: 62,
      approved: 56,
      suggested: 2,
      uncategorized: 4,
    });
    for (const [accountId, name] of [
      [checking, 'demo_usbank_checking_2025-02.csv'],
      [card, 'demo_chase_cc_2025-01_02.csv'],
    ] as const) {
      await admin()
        .post(`${base()}/uploads`, {
          accountId,
          fileName: name,
          content: fixture(name),
        })
        .expect(201);
    }
  });

  it("matches the demo README's expected categorization, row by row", async () => {
    const rows = [
      ...(await month('2025-01')).transactions,
      ...(await month('2025-02')).transactions,
    ];
    expect(rows).toHaveLength(62 + 56 + 22);
    for (const row of rows) {
      const expected = EXPECTED.find(([text]) =>
        row.description.includes(text),
      );
      expect(expected, `no expectation for "${row.description}"`).toBeDefined();
      const [, coaCode, status, flag] = expected!;
      expect({
        description: row.description,
        coaCode: row.coaCode,
        status: row.status,
        flag: row.flag,
      }).toEqual({
        description: row.description,
        coaCode,
        status,
        flag: flag ?? null,
      });
    }
  });

  it('says why each row got its account', async () => {
    const [merchant] = await find('2025-01', 'MERCHANT SERVICE');
    // The Lakeside rule runs before the shared rule with the same keyword.
    expect(merchant).toMatchObject({
      source: 'rule',
      ruleKeyword: 'MERCHANT SERVICE',
      approvedBy: null,
    });
    expect(
      rules.rows.find(
        (r) => r.keyword === 'MERCHANT SERVICE' && r.pharmacyId === pharmacyId,
      ),
    ).toBeDefined();
    const [rent] = await find('2025-01', 'OAKMONT');
    expect(rent.ruleKeyword).toBe('OAKMONT PROPERTIES');
    const totals = (await month('2025-01', checking)).totals;
    expect(totals).toMatchObject({
      count: 62,
      approved: 56,
      suggested: 2,
      uncategorized: 4,
    });
  });

  it('treats a masked number of our own account as a transfer', async () => {
    const res = await admin()
      .post(`${base()}/uploads`, {
        accountId: checking,
        fileName: 'payment.csv',
        content:
          'Date,Transaction,Name,Memo,Amount\n02/18/2025,DEBIT,WEB PYMT ********7702,,-3120.40\n',
      })
      .expect(201);
    expect(res.body.categorization).toMatchObject({ suggested: 1 });
    const [payment] = await find('2025-02', 'WEB PYMT');
    expect(payment).toMatchObject({
      coaCode: '2010',
      status: 'suggested',
      source: 'own_account',
    });
  });

  it('lets a person choose the account, and keeps that decision', async () => {
    const [xcel] = await find('2025-01', 'XCEL ENERGY');
    const [delta] = await find('2025-01', 'DELTA AIR');
    const set = await admin()
      .put(`${base()}/transactions/${delta.id}`, { coaCode: '6380' })
      .expect(200);
    expect(set.body).toMatchObject({
      coaCode: '6380',
      status: 'approved',
      source: 'staff',
      ruleKeyword: null,
      approvedBy: 'Demo Admin',
    });
    await admin()
      .put(`${base()}/transactions/${xcel.id}`, { coaCode: '6999' })
      .expect(400); // inactive
    await admin()
      .put(`${base()}/transactions/${xcel.id}`, { coaCode: '1515' })
      .expect(400); // journal only
    await admin()
      .put(`${base()}/transactions/99999`, { coaCode: '6380' })
      .expect(404);

    // A rule added later catches DELTA too, but the staff decision stays.
    rules.add({
      pharmacyId,
      keyword: 'DELTA AIR',
      coaCode: '6120',
      tag: null,
      priority: 5,
      autoApprove: true,
      source: 'manual',
      sourceNote: null,
      retiredAt: null,
    });
    await admin()
      .post(`${base()}/transactions/categorize`, { month: '2025-01' })
      .expect(200);
    const [after] = await find('2025-01', 'DELTA AIR');
    expect(after).toMatchObject({ coaCode: '6380', source: 'staff' });

    // Back to 9999 = uncategorized again.
    const reset = await admin()
      .put(`${base()}/transactions/${delta.id}`, { coaCode: '9999' })
      .expect(200);
    expect(reset.body).toMatchObject({
      status: 'uncategorized',
      source: null,
      approvedBy: null,
    });
  });

  it('runs the rules again: new rules catch rows that were not decided yet', async () => {
    rules.add({
      pharmacyId,
      keyword: 'CARIBOU COFFEE',
      coaCode: '6380',
      tag: null,
      priority: 6,
      autoApprove: false,
      source: 'manual',
      sourceNote: null,
      retiredAt: null,
    });
    const run = await admin()
      .post(`${base()}/transactions/categorize`, {
        month: '2025-01',
        accountId: card,
      })
      .expect(200);
    expect(run.body.checked).toBeGreaterThan(0);
    const [coffee] = await find('2025-01', 'CARIBOU');
    expect(coffee).toMatchObject({
      coaCode: '6380',
      status: 'suggested',
      ruleKeyword: 'CARIBOU COFFEE',
    });
    await admin()
      .post(`${base()}/transactions/categorize`, { month: 'Jan' })
      .expect(400);
  });

  it('approves suggested rows in bulk, and can take approval back', async () => {
    const [gusto] = await find('2025-01', 'GUSTO');
    const [zelle] = await find('2025-01', 'ZELLE');
    const [mckesson] = await find('2025-01', 'MCKESSON');

    const res = await admin()
      .post(`${base()}/transactions/approve`, {
        ids: [gusto.id, zelle.id, mckesson.id],
      })
      .expect(200);
    expect(res.body).toEqual({ approved: 1, skipped: 2 });
    const [approved] = await find('2025-01', 'GUSTO');
    expect(approved).toMatchObject({
      status: 'approved',
      source: 'rule',
      approvedBy: 'Demo Admin',
    });

    const only9999 = await admin()
      .post(`${base()}/transactions/approve`, { ids: [zelle.id] })
      .expect(400);
    expect(only9999.body.message).toBe(CHOOSE_ACCOUNT_FIRST);

    const undo = await admin()
      .post(`${base()}/transactions/unapprove`, { ids: [gusto.id] })
      .expect(200);
    expect(undo.body).toEqual({ unapproved: 1 });
    const [back] = await find('2025-01', 'GUSTO');
    expect(back).toMatchObject({
      status: 'suggested',
      coaCode: '6010',
      approvedBy: null,
    });

    await admin()
      .post(`${base()}/transactions/approve`, { ids: [] })
      .expect(400);
    await admin()
      .post(`${base()}/transactions/approve`, { ids: [99999] })
      .expect(404);
  });
});
