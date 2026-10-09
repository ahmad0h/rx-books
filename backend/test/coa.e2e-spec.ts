import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  DUPLICATE_ACCOUNT_NAME,
  UNCATEGORIZED_LOCKED,
} from '../src/coa/coa.service.js';
import {
  createTestApp,
  type InMemoryCoaRepository,
  type InMemoryUserRepository,
} from './test-app.js';

const RENT = {
  name: 'Rent',
  type: 'expense',
  expenseGroup: 'Occupancy',
  description: 'Store lease / rent payments.',
  ownerLabel: 'Rent',
  categorizable: true,
  contraOf: null,
};

describe('Chart of accounts (e2e)', () => {
  let app: NestExpressApplication;
  let users: InMemoryUserRepository;
  let coa: InMemoryCoaRepository;
  let adminCookie: string;
  let clientCookie: string;
  let ip = 0;

  const signIn = async (email: string, password: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', `10.3.0.${++ip}`)
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

  beforeAll(async () => {
    ({ app, users, coa } = await createTestApp());
    coa.add({
      code: '6110',
      ...RENT,
      type: 'expense',
      expenseGroup: 'Occupancy',
      isActive: true,
    });
    coa.add({
      code: '9999',
      name: 'Uncategorized — needs review',
      type: 'review',
      expenseGroup: null,
      description: null,
      ownerLabel: 'Not sure',
      categorizable: true,
      contraOf: null,
      isActive: true,
    });
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('needs a session, and lets any signed-in user read it with labels', async () => {
    await request(app.getHttpServer()).get('/api/coa').expect(401);
    const res = await as(clientCookie).get('/api/coa').expect(200);
    expect(res.body.map((a: { label: string }) => a.label)).toEqual([
      '6110 · Rent',
      '9999 · Uncategorized — needs review',
    ]);
  });

  it('only lets admins add or edit accounts', async () => {
    await as(clientCookie)
      .post('/api/coa', { ...RENT, code: '6111', name: 'Storage rent' })
      .expect(403);
    await as(clientCookie)
      .put('/api/coa/6110', { ...RENT, isActive: true })
      .expect(403);
  });

  it('adds an account; the group is dropped for non-expense types', async () => {
    const res = await as(adminCookie)
      .post('/api/coa', {
        code: '1520',
        name: 'Vehicles',
        type: 'asset',
        expenseGroup: 'General',
        description: '  ',
        ownerLabel: 'Vehicles',
        categorizable: true,
        contraOf: null,
      })
      .expect(201);
    expect(res.body).toMatchObject({
      code: '1520',
      label: '1520 · Vehicles',
      type: 'asset',
      expenseGroup: null,
      description: null,
      isActive: true,
    });
  });

  it('checks code, type, group and duplicates', async () => {
    const bad = await as(adminCookie)
      .post('/api/coa', {
        ...RENT,
        code: '61',
        name: 'x',
        type: 'expense',
        expenseGroup: 'Nope',
      })
      .expect(400);
    expect(bad.body.message).toEqual(
      expect.arrayContaining([
        'The code must be exactly 4 digits.',
        'Enter the account name.',
        'Choose the expense group.',
      ]),
    );

    await as(adminCookie)
      .post('/api/coa', { ...RENT, code: '6110', name: 'Other' })
      .expect(409);
    const dupName = await as(adminCookie)
      .post('/api/coa', { ...RENT, code: '6111', name: 'RENT' })
      .expect(409);
    expect(dupName.body.message).toBe(DUPLICATE_ACCOUNT_NAME);

    await as(adminCookie)
      .post('/api/coa', {
        ...RENT,
        code: '6112',
        name: 'Offset test',
        contraOf: '4999',
      })
      .expect(400);
  });

  it('edits and deactivates an account, but never changes its code', async () => {
    const res = await as(adminCookie)
      .put('/api/coa/6110', {
        ...RENT,
        code: '7000',
        name: 'Rent & lease',
        isActive: false,
      })
      .expect(400); // unknown field "code" is rejected
    expect(res.body.message).toEqual(['property code should not exist']);

    const ok = await as(adminCookie)
      .put('/api/coa/6110', { ...RENT, name: 'Rent & lease', isActive: false })
      .expect(200);
    expect(ok.body).toMatchObject({
      code: '6110',
      label: '6110 · Rent & lease',
      isActive: false,
    });
    await as(adminCookie)
      .put('/api/coa/4321', { ...RENT, isActive: true })
      .expect(404);
  });

  it('keeps 9999 · Uncategorized active and open for transactions', async () => {
    const res = await as(adminCookie)
      .put('/api/coa/9999', {
        name: 'Uncategorized — needs review',
        type: 'review',
        expenseGroup: null,
        description: null,
        ownerLabel: 'Not sure',
        categorizable: true,
        contraOf: null,
        isActive: false,
      })
      .expect(400);
    expect(res.body.message).toBe(UNCATEGORIZED_LOCKED);
  });
});
