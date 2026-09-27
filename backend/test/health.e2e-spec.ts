import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createTestApp } from './test-app.js';

describe('GET /api/health (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: Awaited<ReturnType<typeof createTestApp>>['dataSource'];

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('is public and returns 200 when the database is up', async () => {
    dataSource.query.mockResolvedValueOnce([{ 1: 1 }]);
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      database: 'up',
      service: 'rxbooks-backend',
    });
  });

  it('returns 503 when the database is down', async () => {
    dataSource.query.mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(503);
    expect(res.body).toMatchObject({ status: 'degraded', database: 'down' });
  });
});
