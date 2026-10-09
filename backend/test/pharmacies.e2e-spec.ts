import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DEFAULT_OWNER_PASSWORD } from '../src/pharmacies/owner-account.js';
import {
  DUPLICATE_PHARMACY_NAME,
  OWNER_EMAIL_TAKEN,
} from '../src/pharmacies/pharmacies.service.js';
import { createTestApp, type InMemoryUserRepository } from './test-app.js';

const LAKESIDE = {
  name: 'Lakeside Community Pharmacy',
  ownerName: 'Jordan Lee',
  ownerPhone: '(612) 555-0142',
  ownerEmail: 'jordan@lakeside.test',
};
const ASPEN = {
  name: 'Aspen Drug',
  ownerName: 'Sam Rivera',
  ownerPhone: '+1 651 555 0199',
  ownerEmail: 'sam@aspen.test',
};

describe('Pharmacies (e2e)', () => {
  let app: NestExpressApplication;
  let users: InMemoryUserRepository;
  let adminCookie: string;
  let clientCookie: string;
  let ipCounter = 0;

  const signIn = (email: string, password: string) =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', `10.2.0.${++ipCounter}`)
      .send({ email, password });

  const cookieFrom = (res: request.Response) =>
    ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('rx_session='))!
      .split(';')[0];

  const admin = {
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
  };

  beforeAll(async () => {
    ({ app, users } = await createTestApp());
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
    adminCookie = cookieFrom(
      await signIn('admin@rxbooks.test', 'admin-password-123').expect(200),
    );
    clientCookie = cookieFrom(
      await signIn('client@rxbooks.test', 'client-password-123').expect(200),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('is closed to signed-out visitors and to clients', async () => {
    await request(app.getHttpServer()).get('/api/pharmacies').expect(401);
    await request(app.getHttpServer())
      .get('/api/pharmacies')
      .set('Cookie', clientCookie)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/pharmacies')
      .set('Cookie', clientCookie)
      .send(LAKESIDE)
      .expect(403);
  });

  it('adds a pharmacy, cleaning up spaces and email case', async () => {
    const res = await admin
      .post('/api/pharmacies', {
        ...LAKESIDE,
        name: '  Lakeside   Community Pharmacy ',
        ownerEmail: ' Jordan@Lakeside.TEST ',
      })
      .expect(201);
    expect(res.body).toMatchObject({ id: 1, ...LAKESIDE });
  });

  it("creates the owner's client login, which signs in with the temporary password", async () => {
    const owner = users.rows.find((u) => u.email === LAKESIDE.ownerEmail);
    expect(owner).toMatchObject({
      name: LAKESIDE.ownerName,
      role: 'client',
      pharmacyId: 1,
      isActive: true,
    });

    const res = await signIn(
      LAKESIDE.ownerEmail,
      DEFAULT_OWNER_PASSWORD,
    ).expect(200);
    expect(res.body.user).toMatchObject({
      email: LAKESIDE.ownerEmail,
      role: 'client',
    });
  });

  it('lists pharmacies by name and returns one by id', async () => {
    await admin.post('/api/pharmacies', ASPEN).expect(201);

    const list = await admin.get('/api/pharmacies').expect(200);
    expect(list.body.map((p: { name: string }) => p.name)).toEqual([
      'Aspen Drug',
      'Lakeside Community Pharmacy',
    ]);
    await admin.get('/api/pharmacies/1').expect(200);
    await admin.get('/api/pharmacies/999').expect(404);
  });

  it('requires every field and checks phone and email', async () => {
    const res = await admin
      .post('/api/pharmacies', {
        name: '',
        ownerName: 'J',
        ownerPhone: 'call me',
        ownerEmail: 'not-an-email',
      })
      .expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([
        'Enter the pharmacy name.',
        "Enter the owner's name.",
        'Enter a valid phone number.',
        'Enter a valid email address.',
      ]),
    );
    await admin.post('/api/pharmacies', { name: 'Only a name' }).expect(400);
  });

  it('rejects a duplicate pharmacy name (ignoring case) or an owner email already in use', async () => {
    const byName = await admin
      .post('/api/pharmacies', {
        ...ASPEN,
        name: 'LAKESIDE community pharmacy',
        ownerEmail: 'new@owner.test',
      })
      .expect(409);
    expect(byName.body.message).toBe(DUPLICATE_PHARMACY_NAME);

    const byEmail = await admin
      .post('/api/pharmacies', {
        ...ASPEN,
        name: 'Brand New Pharmacy',
        ownerEmail: 'admin@rxbooks.test',
      })
      .expect(409);
    expect(byEmail.body.message).toBe(OWNER_EMAIL_TAKEN);
    expect(
      users.rows.some((u) => u.name === ASPEN.ownerName && u.pharmacyId === 3),
    ).toBe(false);
  });

  it("edits a pharmacy and keeps the owner's login in step", async () => {
    const res = await admin
      .put('/api/pharmacies/1', {
        ...LAKESIDE,
        ownerName: 'Jordan A. Lee',
        ownerEmail: 'jordan.lee@lakeside.test',
        ownerPhone: '612-555-0100',
      })
      .expect(200);
    expect(res.body).toMatchObject({
      ownerName: 'Jordan A. Lee',
      ownerPhone: '612-555-0100',
    });

    const owner = users.rows.find((u) => u.pharmacyId === 1);
    expect(owner).toMatchObject({
      name: 'Jordan A. Lee',
      email: 'jordan.lee@lakeside.test',
    });
    await signIn('jordan.lee@lakeside.test', DEFAULT_OWNER_PASSWORD).expect(
      200,
    );
  });

  it('will not edit into a duplicate name or a used email', async () => {
    await admin
      .put('/api/pharmacies/1', { ...LAKESIDE, name: 'Aspen Drug' })
      .expect(409);
    await admin
      .put('/api/pharmacies/1', { ...LAKESIDE, ownerEmail: ASPEN.ownerEmail })
      .expect(409);
    await admin.put('/api/pharmacies/999', LAKESIDE).expect(404);
  });
});
