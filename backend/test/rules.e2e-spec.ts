import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  BALANCE_SHEET_AUTO_APPROVE,
  DUPLICATE_KEYWORD,
} from '../src/rules/rules.service.js';
import {
  createTestApp,
  type InMemoryCoaRepository,
  type InMemoryRuleRepository,
  type InMemoryUserRepository,
} from './test-app.js';

const account = (
  code: string,
  name: string,
  type: 'revenue' | 'cost_of_goods' | 'expense' | 'liability' | 'review',
  extra: { isActive?: boolean; categorizable?: boolean } = {},
) => ({
  code,
  name,
  type,
  expenseGroup: type === 'expense' ? ('General' as const) : null,
  description: null,
  ownerLabel: null,
  contraOf: null,
  categorizable: extra.categorizable ?? true,
  isActive: extra.isActive ?? true,
});

describe('Rules (e2e)', () => {
  let app: NestExpressApplication;
  let users: InMemoryUserRepository;
  let coa: InMemoryCoaRepository;
  let rules: InMemoryRuleRepository;
  let adminCookie: string;
  let clientCookie: string;
  let pharmacyId: number;
  let ip = 0;

  const signIn = async (email: string, password: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', `10.4.0.${++ip}`)
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
    post: (url: string, body: object = {}) =>
      request(app.getHttpServer()).post(url).set('Cookie', cookie).send(body),
    put: (url: string, body: object) =>
      request(app.getHttpServer()).put(url).set('Cookie', cookie).send(body),
    delete: (url: string) =>
      request(app.getHttpServer()).delete(url).set('Cookie', cookie),
  });
  const admin = () => as(adminCookie);

  const newRule = (fields: object) => ({
    pharmacyId: null,
    keyword: 'ANDA',
    coaCode: '5010',
    tag: null,
    autoApprove: true,
    sourceNote: null,
    ...fields,
  });

  beforeAll(async () => {
    ({ app, users, coa, rules } = await createTestApp());
    coa.add(account('4030', 'Cash & patient-pay revenue', 'revenue'));
    coa.add(account('4040', 'OTC / front-end sales', 'revenue'));
    coa.add(account('5010', 'Rx drugs — wholesale', 'cost_of_goods'));
    coa.add(account('6110', 'Rent', 'expense'));
    coa.add(account('6999', 'Old account', 'expense', { isActive: false }));
    coa.add(account('2010', 'Credit card 1', 'liability'));
    coa.add(account('9999', 'Uncategorized — needs review', 'review'));
    rules.add({
      pharmacyId: null,
      keyword: 'MERCHANT SERVICE',
      coaCode: '4030',
      tag: null,
      priority: 1310,
      autoApprove: true,
      source: 'import',
      sourceNote: 'Card settlement deposits.',
      retiredAt: null,
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

    const pharmacy = await admin()
      .post('/api/pharmacies', {
        name: 'Lakeside Community Pharmacy',
        ownerName: 'Jordan Lee',
        ownerPhone: '(612) 555-0142',
        ownerEmail: 'jordan@lakeside.test',
      })
      .expect(201);
    pharmacyId = (pharmacy.body as { id: number }).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('is for admins only', async () => {
    await request(app.getHttpServer()).get('/api/rules').expect(401);
    await as(clientCookie).get('/api/rules?pharmacy=shared').expect(403);
    await as(clientCookie)
      .post('/api/rules/test', { description: 'ANDA' })
      .expect(403);
  });

  it('lists the shared rules with account labels', async () => {
    const res = await admin().get('/api/rules?pharmacy=shared').expect(200);
    expect(res.body).toEqual([
      expect.objectContaining({
        keyword: 'MERCHANT SERVICE',
        account: '4030 · Cash & patient-pay revenue',
        pharmacyId: null,
        retiredAt: null,
      }),
    ]);
    await admin().get('/api/rules?pharmacy=abc').expect(400);
    await admin().get('/api/rules?pharmacy=999').expect(404);
  });

  it('adds a shared rule, tidying the keyword and picking the next priority', async () => {
    const res = await admin()
      .post('/api/rules', newRule({ keyword: '  anda   pharma ', tag: '' }))
      .expect(201);
    expect(res.body).toMatchObject({
      keyword: 'ANDA PHARMA',
      priority: 1320,
      tag: null,
      source: 'manual',
      account: '5010 · Rx drugs — wholesale',
    });
  });

  it('adds a pharmacy rule in its own list', async () => {
    const res = await admin()
      .post(
        '/api/rules',
        newRule({
          pharmacyId,
          keyword: 'MERCHANT SERVICE',
          coaCode: '4040',
          priority: 50,
        }),
      )
      .expect(201);
    expect(res.body).toMatchObject({ pharmacyId, priority: 50 });
    const list = await admin().get(`/api/rules?pharmacy=${pharmacyId}`);
    expect(list.body).toHaveLength(1);
    await admin()
      .post('/api/rules', newRule({ pharmacyId: 999, keyword: 'GUSTO' }))
      .expect(404);
  });

  it('rejects bad keywords, accounts and duplicates', async () => {
    const message = async (body: object, status: number) =>
      (
        (await admin().post('/api/rules', newRule(body)).expect(status))
          .body as { message: unknown }
      ).message;

    expect(await message({ keyword: 'AB' }, 400)).toEqual([
      'The keyword must be at least 3 characters.',
    ]);
    expect(await message({ keyword: 'ZELLE' }, 400)).toMatch(/payment words/);
    expect(await message({ keyword: '2500607134' }, 400)).toMatch(/letters/);
    expect(await message({ keyword: 'AMAZON MKTPLACE' }, 400)).toMatch(
      /business and personal/,
    );
    expect(await message({ keyword: 'GUSTO', coaCode: '9999' }, 400)).toMatch(
      /real account/,
    );
    expect(await message({ keyword: 'GUSTO', coaCode: '6999' }, 400)).toMatch(
      /inactive/,
    );
    expect(
      await message({ keyword: 'CARDMEMBER SERV', coaCode: '2010' }, 400),
    ).toBe(BALANCE_SHEET_AUTO_APPROVE);
    expect(await message({ keyword: 'merchant service' }, 409)).toBe(
      DUPLICATE_KEYWORD,
    );
    // The same keyword is fine in another list.
    await admin()
      .post(
        '/api/rules',
        newRule({
          keyword: 'CARDMEMBER SERV',
          coaCode: '2010',
          autoApprove: false,
        }),
      )
      .expect(201);
  });

  it('edits a rule without moving it between lists', async () => {
    const [rule] = (await admin().get(`/api/rules?pharmacy=${pharmacyId}`))
      .body as { id: number }[];
    const res = await admin()
      .put(`/api/rules/${rule.id}`, {
        keyword: 'MERCHANT SERVICE',
        coaCode: '4040',
        tag: 'FRONT_END',
        priority: 45,
        autoApprove: true,
        sourceNote: 'Front-store card sales.',
      })
      .expect(200);
    expect(res.body).toMatchObject({
      pharmacyId,
      tag: 'FRONT_END',
      priority: 45,
    });
    await admin()
      .put(`/api/rules/${rule.id}`, { ...newRule({}), keyword: 'X Y Z' })
      .expect(400); // pharmacyId is not an editable field
    await admin()
      .put('/api/rules/9999', {
        keyword: 'GUSTO',
        coaCode: '6110',
        autoApprove: true,
      })
      .expect(404);
  });

  it('tests a description: pharmacy rules first, then shared ones', async () => {
    const res = await admin()
      .post('/api/rules/test', {
        description: 'ELECTRONIC DEPOSIT MERCHANT SERVICE',
        pharmacyId,
      })
      .expect(200);
    expect(res.body.winner).toMatchObject({ pharmacyId, coaCode: '4040' });
    expect(
      (res.body.matches as { coaCode: string }[]).map((m) => m.coaCode),
    ).toEqual(['4040', '4030']);

    const shared = await admin()
      .post('/api/rules/test', {
        description: 'ELECTRONIC DEPOSIT MERCHANT SERVICE',
      })
      .expect(200);
    expect(shared.body.winner).toMatchObject({ coaCode: '4030' });

    const none = await admin()
      .post('/api/rules/test', { description: 'ZELLE TO JORDAN LEE' })
      .expect(200);
    expect(none.body).toEqual({ winner: null, matches: [] });
    await admin().post('/api/rules/test', { description: '  ' }).expect(400);
  });

  it('deletes by retiring: the rule stops matching and can be restored', async () => {
    const [rule] = (await admin().get(`/api/rules?pharmacy=${pharmacyId}`))
      .body as { id: number }[];
    const retired = await admin().delete(`/api/rules/${rule.id}`).expect(200);
    expect(retired.body.retiredAt).not.toBeNull();

    const test = await admin()
      .post('/api/rules/test', {
        description: 'DEPOSIT MERCHANT SERVICE',
        pharmacyId,
      })
      .expect(200);
    expect(test.body.winner).toMatchObject({ coaCode: '4030' });

    // While it is retired, a new rule may take the keyword; restoring then clashes.
    const replacement = await admin()
      .post('/api/rules', newRule({ pharmacyId, keyword: 'MERCHANT SERVICE' }))
      .expect(201);
    await admin().post(`/api/rules/${rule.id}/restore`).expect(409);
    await admin()
      .delete(`/api/rules/${(replacement.body as { id: number }).id}`)
      .expect(200);
    const restored = await admin()
      .post(`/api/rules/${rule.id}/restore`)
      .expect(200);
    expect(restored.body.retiredAt).toBeNull();
    expect(rules.rows).toHaveLength(5); // nothing was erased
  });
});
