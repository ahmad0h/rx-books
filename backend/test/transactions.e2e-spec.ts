import { readFileSync } from 'node:fs';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { BankTransaction } from '../src/transactions/bank-transaction.entity.js';
import {
  createTestApp,
  type InMemoryCoaRepository,
  type InMemoryTable,
  type InMemoryUserRepository,
} from './test-app.js';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const CHECKING_JAN = 'demo_usbank_checking_2025-01.csv';
const CHECKING_FEB = 'demo_usbank_checking_2025-02.csv';
const CARD = 'demo_chase_cc_2025-01_02.csv';
const US_BANK_HEADER = 'Date,Transaction,Name,Memo,Amount';

const coaRow = (
  code: string,
  name: string,
  type: 'asset' | 'liability' | 'review',
) => ({
  code,
  name,
  type,
  expenseGroup: null,
  description: null,
  ownerLabel: null,
  contraOf: null,
  categorizable: true,
  isActive: true,
});

describe('Transaction upload (e2e)', () => {
  let app: NestExpressApplication;
  let users: InMemoryUserRepository;
  let coa: InMemoryCoaRepository;
  let transactions: InMemoryTable<BankTransaction>;
  let adminCookie: string;
  let clientCookie: string;
  let pharmacyId: number;
  let checking: number;
  let card: number;
  let ip = 0;

  const signIn = async (email: string, password: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', `10.6.0.${++ip}`)
      .send({ email, password })
      .expect(200);
    return ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('rx_session='))!
      .split(';')[0];
  };

  const as = (cookie: string) => ({
    get: (url: string) =>
      request(app.getHttpServer()).get(url).set('Cookie', cookie),
    post: (url: string, body: object) =>
      request(app.getHttpServer()).post(url).set('Cookie', cookie).send(body),
    put: (url: string, body: object) =>
      request(app.getHttpServer()).put(url).set('Cookie', cookie).send(body),
  });
  const admin = () => as(adminCookie);
  const base = () => `/api/pharmacies/${pharmacyId}`;
  const file = (accountId: number, name: string, content = fixture(name)) => ({
    accountId,
    fileName: name,
    content,
  });
  const preview = (body: object) =>
    admin().post(`${base()}/uploads/preview`, body);
  const upload = (body: object) => admin().post(`${base()}/uploads`, body);

  const addAccount = async (body: object) =>
    (
      (await admin().post(`${base()}/accounts`, body).expect(201)).body as {
        id: number;
      }
    ).id;

  beforeAll(async () => {
    ({ app, users, coa, transactions } = await createTestApp());
    coa.add(coaRow('1010', 'Cash — checking 1', 'asset'));
    coa.add(coaRow('1020', 'Cash — savings 1', 'asset'));
    coa.add(coaRow('2010', 'Credit card 1', 'liability'));
    coa.add(coaRow('9999', 'Uncategorized — needs review', 'review'));
    await users.add({
      email: 'admin@rxbooks.test',
      password: 'admin-password-123',
      name: 'Demo Admin',
      role: 'admin',
    });
    await users.add({
      email: 'client@rxbooks.test',
      password: 'client-password-123',
      name: 'Client',
      role: 'client',
    });
    adminCookie = await signIn('admin@rxbooks.test', 'admin-password-123');
    clientCookie = await signIn('client@rxbooks.test', 'client-password-123');

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
    const account = { openedOn: null, closedOn: null, notes: null };
    checking = await addAccount({
      ...account,
      name: 'Main operating checking',
      kind: 'checking',
      bank: 'US Bank',
      lastFour: '4821',
      coaCode: '1010',
    });
    card = await addAccount({
      ...account,
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

  it('is for admins only', async () => {
    await as(clientCookie)
      .post(`${base()}/uploads/preview`, file(checking, CHECKING_JAN))
      .expect(403);
    await as(clientCookie).get(`${base()}/transactions`).expect(403);
  });

  it('previews a file without saving anything', async () => {
    const res = await preview(file(checking, CHECKING_JAN)).expect(200);
    expect(res.body).toMatchObject({
      format: { id: 'usbank_checking' },
      account: { id: checking, lastFour: '4821' },
      summary: {
        rows: 62,
        new: 62,
        loaded: 0,
        held: 0,
        firstDate: '2025-01-01',
        months: ['2025-01'],
        moneyIn: '138680.71',
        moneyOut: '-83743.14',
      },
      warnings: [],
    });
    expect(res.body.rows[0]).toMatchObject({
      line: 2,
      status: 'new',
      amount: '3892.48',
    });
    expect(transactions.rows).toHaveLength(0);
  });

  it('imports the new rows into 9999 and lists them by month', async () => {
    const res = await upload(file(checking, CHECKING_JAN)).expect(201);
    expect(res.body).toMatchObject({
      accountId: checking,
      format: 'usbank_checking',
      uploadedBy: 'Demo Admin',
      rowsInFile: 62,
      rowsAdded: 62,
      rowsSkipped: 0,
      months: ['2025-01'],
    });

    const list = await admin().get(`${base()}/transactions`).expect(200);
    expect(list.body).toMatchObject({
      months: ['2025-01'],
      month: '2025-01',
      totals: { count: 62, moneyIn: '138680.71', moneyOut: '-83743.14' },
    });
    expect(list.body.transactions[0]).toMatchObject({
      date: '2025-01-01',
      description: 'ELECTRONIC DEPOSIT CAREMARK',
      amount: '3892.48',
      coaCode: '9999',
      coaLabel: '9999 · Uncategorized — needs review',
      status: 'uncategorized',
    });
    const transfer = (
      list.body.transactions as {
        description: string;
        lastFour: string | null;
      }[]
    ).find((t) => t.description.includes('TRANSFER TO ACCOUNT'));
    expect(transfer?.lastFour).toBe('9911');
  });

  it('never loads the same rows twice', async () => {
    const again = await preview(file(checking, CHECKING_JAN)).expect(200);
    expect(again.body.summary).toMatchObject({ new: 0, loaded: 62, held: 0 });
    expect(again.body.warnings).toEqual([
      'Everything in this file is already loaded. There is nothing new to import.',
    ]);
    const res = await upload(file(checking, CHECKING_JAN)).expect(400);
    expect(res.body.message).toMatch(/already loaded/);
    expect(transactions.rows).toHaveLength(62);

    // The next month adds only its own rows.
    await upload(file(checking, CHECKING_FEB)).expect(201);
    expect(transactions.rows).toHaveLength(118);
  });

  it('files a two-month card file under each month', async () => {
    const res = await upload(file(card, CARD)).expect(201);
    expect(res.body).toMatchObject({
      rowsAdded: 22,
      months: ['2025-01', '2025-02'],
    });
    const jan = await admin()
      .get(`${base()}/transactions?month=2025-01&accountId=${card}`)
      .expect(200);
    expect(jan.body.totals).toEqual({
      count: 11,
      moneyIn: '3120.40',
      moneyOut: '-2594.32',
    });
    const all = await admin()
      .get(`${base()}/transactions?month=2025-02`)
      .expect(200);
    expect(all.body.months).toEqual(['2025-02', '2025-01']);
    expect(all.body.totals.count).toBe(56 + 11);
  });

  it('keeps identical rows in one file, and holds groups whose count changed', async () => {
    const row = '01/31/2025,CREDIT,REBATE ANDA,,10.00';
    const twice = [US_BANK_HEADER, row, row].join('\n');
    const first = await upload(file(checking, 'rebates.csv', twice)).expect(
      201,
    );
    expect(first.body.rowsAdded).toBe(2);

    const thrice = [
      US_BANK_HEADER,
      row,
      row,
      row,
      '01/31/2025,CREDIT,OTHER,,5.00',
    ].join('\n');
    const check = await preview(file(checking, 'rebates2.csv', thrice)).expect(
      200,
    );
    expect(check.body.summary).toMatchObject({ new: 1, loaded: 0, held: 3 });
    expect(check.body.warnings[0]).toMatch(/3 rows are held back/);
    const second = await upload(file(checking, 'rebates2.csv', thrice)).expect(
      201,
    );
    expect(second.body).toMatchObject({ rowsAdded: 1, rowsHeld: 3 });
  });

  it('refuses the wrong file, bad rows and closed accounts', async () => {
    const wrong = await preview(file(checking, CARD)).expect(400);
    expect(wrong.body.message).toMatch(/This is a Chase credit card file/);

    const unknown = await preview(file(checking, 'x.csv', 'A,B\n1,2')).expect(
      400,
    );
    expect(unknown.body.message[0]).toMatch(/don't match a known bank format/);

    const bad = await preview(
      file(checking, 'bad.csv', `${US_BANK_HEADER}\n02/30/2025,DEBIT,X,,-1`),
    ).expect(400);
    expect(bad.body.message).toEqual([
      'Row 2: the date "02/30/2025" is not a valid MM/DD/YYYY date.',
    ]);

    await preview(file(999, CHECKING_JAN)).expect(404);
    await preview({
      accountId: checking,
      fileName: 'x.csv',
      content: '',
    }).expect(400);

    const savings = await addAccount({
      name: 'Old savings',
      kind: 'savings',
      bank: 'US Bank',
      lastFour: '5530',
      coaCode: '1020',
      openedOn: '2024-01-01',
      closedOn: '2024-12-31',
      notes: null,
    });
    const closed = await preview(file(savings, CHECKING_JAN)).expect(400);
    expect(closed.body.message).toMatch(/was closed on 2024-12-31/);
  });

  it('warns about rows dated before the account was opened', async () => {
    await admin()
      .put(`${base()}/accounts/${card}`, {
        name: 'Business credit card',
        kind: 'credit_card',
        bank: 'Chase',
        lastFour: '7702',
        coaCode: '2010',
        openedOn: '2025-02-01',
        closedOn: null,
        notes: null,
      })
      .expect(200);
    const res = await preview(file(card, CARD)).expect(200);
    expect(res.body.warnings[0]).toMatch(
      /11 rows are dated before the account was opened/,
    );
  });

  it('lists the upload history, newest first', async () => {
    const res = await admin().get(`${base()}/uploads`).expect(200);
    expect((res.body as { fileName: string }[]).map((u) => u.fileName)).toEqual(
      ['rebates2.csv', 'rebates.csv', CARD, CHECKING_FEB, CHECKING_JAN],
    );
  });
});
