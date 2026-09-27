import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { INVALID_CREDENTIALS } from '../src/auth/auth.service.js';
import { createTestApp, type InMemoryUserRepository } from './test-app.js';

const ADMIN = {
  email: 'admin@rxbooks.test',
  password: 'admin-password-123',
  name: 'Test Admin',
  role: 'admin' as const,
};
const CLIENT = {
  email: 'client@rxbooks.test',
  password: 'client-password-123',
  name: 'Test Client',
  role: 'client' as const,
};

function sessionCookie(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith('rx_session='));
  if (!cookie) throw new Error('no session cookie set');
  return cookie;
}

describe('Authentication (e2e)', () => {
  let app: NestExpressApplication;
  let users: InMemoryUserRepository;

  /**
   * Sign-in is limited to 5 attempts per minute per client IP. Each test sends
   * its own client IP (via the proxy header the app trusts), so tests don't
   * share one limit.
   */
  const login = (ip: string, body: object) =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send(body);

  beforeAll(async () => {
    ({ app, users } = await createTestApp());
    await users.add(ADMIN);
    await users.add(CLIENT);
    await users.add({
      email: 'gone@rxbooks.test',
      password: 'gone-password-123',
      name: 'Gone',
      role: 'client',
      isActive: false,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects /me without a session', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('signs in an admin, sets a safe cookie and returns the user', async () => {
    const res = await login('10.0.0.1', {
      email: ' Admin@RxBooks.test ',
      password: ADMIN.password,
    }).expect(200);

    expect(res.body.user).toEqual({
      id: 1,
      email: ADMIN.email,
      name: ADMIN.name,
      role: 'admin',
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');

    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api/);

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(me.body.user.role).toBe('admin');
    expect(users.rows[0].lastLoginAt).toBeInstanceOf(Date);
  });

  it('signs in a client with the client role', async () => {
    const res = await login('10.0.0.2', {
      email: CLIENT.email,
      password: CLIENT.password,
    }).expect(200);
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', sessionCookie(res))
      .expect(200);
    expect(me.body.user).toMatchObject({ email: CLIENT.email, role: 'client' });
  });

  it('gives the same answer for a wrong password, an unknown email and a deactivated account', async () => {
    for (const body of [
      { email: ADMIN.email, password: 'wrong-password' },
      { email: 'nobody@rxbooks.test', password: 'whatever-123' },
      { email: 'gone@rxbooks.test', password: 'gone-password-123' },
    ]) {
      const res = await login('10.0.0.3', body).expect(401);
      expect(res.body.message).toBe(INVALID_CREDENTIALS);
    }
  });

  it('rejects a malformed request body', async () => {
    await login('10.0.0.4', {
      email: 'not-an-email',
      password: '',
      extra: 'field',
    }).expect(400);
  });

  it('rejects a tampered session cookie', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', 'rx_session=not-a-real-token')
      .expect(401);
  });

  it('logs out by clearing the cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .expect(204);
    expect(sessionCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('allows 5 sign-in attempts per minute from one client, then blocks', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push(
        (
          await login('10.0.0.5', {
            email: ADMIN.email,
            password: 'wrong-password',
          })
        ).status,
      );
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);

    // A different client is not affected.
    await login('10.0.0.6', {
      email: ADMIN.email,
      password: ADMIN.password,
    }).expect(200);
  });
});
