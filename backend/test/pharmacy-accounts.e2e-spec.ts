import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  CODE_TAKEN,
  NUMBER_TAKEN,
} from '../src/pharmacy-accounts/pharmacy-accounts.service.js';
import {
  createTestApp,
  type InMemoryCoaRepository,
  type InMemoryPharmacyAccountRepository,
  type InMemoryUserRepository,
} from './test-app.js';

const coaRow = (
  code: string,
  name: string,
  type: 'asset' | 'liability' | 'expense',
  isActive = true,
) => ({
  code,
  name,
  type,
  expenseGroup: type === 'expense' ? ('General' as const) : null,
  description: null,
  ownerLabel: null,
  contraOf: null,
  categorizable: true,
  isActive,
});

const CHECKING = {
  name: 'Main operating checking',
  kind: 'checking',
  bank: 'US Bank',
  lastFour: '4821',
  coaCode: '1010',
  openedOn: '',
  closedOn: '',
  notes: '',
};

describe('Pharmacy accounts (e2e)', () => {
  let app: NestExpressApplication;
  let users: InMemoryUserRepository;
  let coa: InMemoryCoaRepository;
  let accounts: InMemoryPharmacyAccountRepository;
  let adminCookie: string;
  let clientCookie: string;
  let lakeside: number;
  let aspen: number;
  let ip = 0;

  const signIn = async (email: string, password: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', `10.5.0.${++ip}`)
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
  const url = (pharmacyId: number) => `/api/pharmacies/${pharmacyId}/accounts`;

  const addPharmacy = async (name: string, email: string) =>
    (
      (
        await admin()
          .post('/api/pharmacies', {
            name,
            ownerName: 'Owner',
            ownerPhone: '(612) 555-0142',
            ownerEmail: email,
          })
          .expect(201)
      ).body as { id: number }
    ).id;

  beforeAll(async () => {
    ({ app, users, coa, accounts } = await createTestApp());
    coa.add(coaRow('1010', 'Cash — checking 1', 'asset'));
    coa.add(coaRow('1015', 'Cash on Hand', 'asset'));
    coa.add(coaRow('1020', 'Cash — savings 1', 'asset'));
    coa.add(coaRow('1030', 'Cash — checking 2', 'asset', false));
    coa.add(coaRow('1510', 'Equipment & fixtures', 'asset'));
    coa.add(coaRow('2010', 'Credit card 1', 'liability'));
    coa.add(coaRow('2510', 'Owner draw / personal', 'liability'));
    coa.add(coaRow('6110', 'Rent', 'expense'));
    await users.add({
      email: 'admin@rxbooks.test',
      password: 'admin-password-123',
      name: 'Admin',
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
    lakeside = await addPharmacy(
      'Lakeside Community Pharmacy',
      'a@lakeside.test',
    );
    aspen = await addPharmacy('Aspen Drug', 'b@aspen.test');
  });

  afterAll(async () => {
    await app.close();
  });

  it('is for admins only', async () => {
    await request(app.getHttpServer()).get(url(lakeside)).expect(401);
    await as(clientCookie).get(url(lakeside)).expect(403);
    await as(clientCookie).post(url(lakeside), CHECKING).expect(403);
  });

  it('adds accounts with their chart-of-accounts label', async () => {
    const res = await admin().post(url(lakeside), CHECKING).expect(201);
    expect(res.body).toMatchObject({
      pharmacyId: lakeside,
      lastFour: '4821',
      coaLabel: '1010 · Cash — checking 1',
      openedOn: null,
      notes: null,
    });
    await admin()
      .post(url(lakeside), {
        ...CHECKING,
        name: 'Business card',
        kind: 'credit_card',
        bank: 'Chase',
        lastFour: '7702',
        coaCode: '2010',
        openedOn: '2024-03-01',
      })
      .expect(201);

    const list = await admin().get(url(lakeside)).expect(200);
    expect((list.body as { coaCode: string }[]).map((a) => a.coaCode)).toEqual([
      '1010',
      '2010',
    ]);
    await admin().get(url(999)).expect(404);
    await admin().post(url(999), CHECKING).expect(404);
  });

  it('only allows codes that fit the kind of account', async () => {
    const message = async (body: object) =>
      (
        (
          await admin()
            .post(url(lakeside), { ...CHECKING, ...body })
            .expect(400)
        ).body as { message: unknown }
      ).message;

    expect(await message({ lastFour: '1111', coaCode: '2010' })).toMatch(
      /doesn't fit/,
    );
    expect(await message({ lastFour: '1111', coaCode: '1015' })).toMatch(
      /doesn't fit/,
    ); // cash on hand
    expect(await message({ lastFour: '1111', coaCode: '1510' })).toMatch(
      /doesn't fit/,
    );
    expect(
      await message({ kind: 'credit_card', lastFour: '1111', coaCode: '2510' }),
    ).toMatch(/doesn't fit/);
    expect(await message({ lastFour: '1111', coaCode: '1030' })).toMatch(
      /inactive/,
    );
    expect(await message({ lastFour: '1111', coaCode: '1234' })).toMatch(
      /does not exist/,
    );
  });

  it('checks the fields', async () => {
    const res = await admin()
      .post(url(lakeside), {
        ...CHECKING,
        name: '',
        kind: 'loan',
        lastFour: '48',
        openedOn: '2024-13-01',
      })
      .expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([
        'Enter a name for the account.',
        'Choose checking, savings or credit card.',
        'Enter the last 4 digits of the account number.',
        'The opening date must be a date (YYYY-MM-DD).',
      ]),
    );
    await admin()
      .post(url(lakeside), {
        ...CHECKING,
        lastFour: '1111',
        coaCode: '1020',
        kind: 'savings',
        openedOn: '2024-05-01',
        closedOn: '2024-04-01',
      })
      .expect(400);
  });

  it('keeps one account per code and per number within a pharmacy', async () => {
    const sameCode = await admin()
      .post(url(lakeside), { ...CHECKING, lastFour: '9999' })
      .expect(409);
    expect(sameCode.body.message).toBe(CODE_TAKEN);

    const sameNumber = await admin()
      .post(url(lakeside), {
        ...CHECKING,
        bank: 'us bank',
        kind: 'savings',
        coaCode: '1020',
      })
      .expect(409);
    expect(sameNumber.body.message).toBe(NUMBER_TAKEN);

    // Another pharmacy has its own 1010.
    await admin().post(url(aspen), CHECKING).expect(201);
  });

  it('edits and closes an account, but only within its pharmacy', async () => {
    const [checking] = (await admin().get(url(lakeside))).body as {
      id: number;
    }[];
    const closed = await admin()
      .put(`${url(lakeside)}/${checking.id}`, {
        ...CHECKING,
        name: 'Old checking',
        closedOn: '2025-06-30',
      })
      .expect(200);
    expect(closed.body).toMatchObject({
      name: 'Old checking',
      closedOn: '2025-06-30',
    });

    // Closed accounts are listed after open ones.
    const list = await admin().get(url(lakeside));
    expect((list.body as { coaCode: string }[])[1].coaCode).toBe('1010');

    await admin()
      .put(`${url(aspen)}/${checking.id}`, CHECKING)
      .expect(404);
    expect(accounts.rows).toHaveLength(3);
  });
});
