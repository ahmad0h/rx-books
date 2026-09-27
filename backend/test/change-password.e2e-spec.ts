import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  SAME_PASSWORD,
  WRONG_CURRENT_PASSWORD,
} from '../src/auth/auth.service.js';
import { createTestApp, type InMemoryUserRepository } from './test-app.js';

const OWNER = {
  email: 'owner@rxbooks.test',
  password: 'original-password-1',
  name: 'Owner',
  role: 'client' as const,
};

function sessionCookie(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith('rx_session='));
  if (!cookie) throw new Error('no session cookie set');
  return cookie.split(';')[0];
}

describe('POST /api/auth/change-password (e2e)', () => {
  let app: NestExpressApplication;
  let users: InMemoryUserRepository;

  const login = (ip: string, password: string) =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: OWNER.email, password });

  const changePassword = (ip: string, cookie: string | null, body: object) => {
    const req = request(app.getHttpServer())
      .post('/api/auth/change-password')
      .set('X-Forwarded-For', ip);
    if (cookie) req.set('Cookie', cookie);
    return req.send(body);
  };

  const me = (cookie: string) =>
    request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie);

  beforeAll(async () => {
    ({ app, users } = await createTestApp());
    await users.add(OWNER);
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires a signed-in user', async () => {
    await changePassword('10.1.0.1', null, {
      currentPassword: OWNER.password,
      newPassword: 'another-password-2',
    }).expect(401);
  });

  it('rejects a wrong current password, a short new one and an unchanged one', async () => {
    const cookie = sessionCookie(
      await login('10.1.0.2', OWNER.password).expect(200),
    );

    const wrong = await changePassword('10.1.0.2', cookie, {
      currentPassword: 'not-my-password',
      newPassword: 'another-password-2',
    }).expect(400);
    expect(wrong.body.message).toBe(WRONG_CURRENT_PASSWORD);

    const short = await changePassword('10.1.0.2', cookie, {
      currentPassword: OWNER.password,
      newPassword: 'short',
    }).expect(400);
    expect(short.body.message).toEqual([
      'Your new password needs at least 12 characters.',
    ]);

    const same = await changePassword('10.1.0.2', cookie, {
      currentPassword: OWNER.password,
      newPassword: OWNER.password,
    }).expect(400);
    expect(same.body.message).toBe(SAME_PASSWORD);

    // Nothing changed: the session and the old password still work.
    await me(cookie).expect(200);
  });

  it('changes the password, keeps this session and ends the others', async () => {
    const thisDevice = sessionCookie(
      await login('10.1.0.3', OWNER.password).expect(200),
    );
    const otherDevice = sessionCookie(
      await login('10.1.0.4', OWNER.password).expect(200),
    );

    const res = await changePassword('10.1.0.3', thisDevice, {
      currentPassword: OWNER.password,
      newPassword: 'brand-new-password-3',
    }).expect(204);
    const renewed = sessionCookie(res);

    await me(renewed).expect(200);
    await me(thisDevice).expect(401);
    await me(otherDevice).expect(401);
    expect(users.rows[0].passwordChangedAt).toBeInstanceOf(Date);

    await login('10.1.0.5', OWNER.password).expect(401);
    await login('10.1.0.5', 'brand-new-password-3').expect(200);
  });
});
