import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../config/env.js';
import { UsersService, type NewUser } from './users.service.js';

/**
 * Creates one demo admin and one demo client at start-up, only when
 * DEMO_USERS_ENABLED=true (local development). Existing users are left as they are.
 */
@Injectable()
export class DemoUsersSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger('DemoUsers');

  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('DEMO_USERS_ENABLED', { infer: true })) return;

    const demoUsers: NewUser[] = [
      {
        email: this.config.get('DEMO_ADMIN_EMAIL', { infer: true }),
        password: this.config.get('DEMO_ADMIN_PASSWORD', { infer: true }),
        name: 'Demo Admin',
        role: 'admin',
      },
      {
        email: this.config.get('DEMO_CLIENT_EMAIL', { infer: true }),
        password: this.config.get('DEMO_CLIENT_PASSWORD', { infer: true }),
        name: 'Demo Pharmacy Owner',
        role: 'client',
      },
    ];

    for (const demo of demoUsers) {
      if (await this.users.existsByEmail(demo.email)) continue;
      await this.users.create(demo);
      this.logger.log(`Created demo ${demo.role} user ${demo.email}`);
    }
  }
}
