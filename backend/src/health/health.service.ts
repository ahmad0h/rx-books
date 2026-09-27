import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { AppEnv } from '../config/env.js';

export interface HealthReport {
  status: 'ok' | 'degraded';
  service: 'rxbooks-backend';
  version: string;
  database: 'up' | 'down';
  time: string;
}

const DATABASE_CHECK_TIMEOUT_MS = 2000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async check(): Promise<HealthReport> {
    const database = await this.checkDatabase();
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      service: 'rxbooks-backend',
      version: this.config.get('APP_VERSION', { infer: true }),
      database,
      time: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<'up' | 'down'> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('database check timed out')),
        DATABASE_CHECK_TIMEOUT_MS,
      );
    });
    try {
      await Promise.race([this.dataSource.query('SELECT 1'), timeout]);
      return 'up';
    } catch (error) {
      this.logger.warn(
        `Database check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 'down';
    } finally {
      clearTimeout(timer);
    }
  }
}
