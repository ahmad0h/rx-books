import type { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../config/env.js';
import type { DataSource } from 'typeorm';
import { HealthService } from './health.service.js';

function makeService(queryRaw: () => Promise<unknown>) {
  const dataSource = { query: vi.fn(queryRaw) } as unknown as DataSource;
  const config = {
    get: vi.fn().mockReturnValue('1.2.3'),
  } as unknown as ConfigService<AppEnv, true>;
  return new HealthService(dataSource, config);
}

describe('HealthService', () => {
  it('reports ok when the database answers', async () => {
    const report = await makeService(() => Promise.resolve([{ 1: 1 }])).check();
    expect(report).toMatchObject({
      status: 'ok',
      database: 'up',
      service: 'rxbooks-backend',
      version: '1.2.3',
    });
    expect(Number.isNaN(Date.parse(report.time))).toBe(false);
  });

  it('reports degraded when the database query fails', async () => {
    const report = await makeService(() =>
      Promise.reject(new Error('connection refused')),
    ).check();
    expect(report).toMatchObject({ status: 'degraded', database: 'down' });
  });
});
