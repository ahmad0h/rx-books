import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { CoaModule } from './coa/coa.module.js';
import { validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { DemoModule } from './demo/demo.module.js';
import { HealthModule } from './health/health.module.js';
import { PharmaciesModule } from './pharmacies/pharmacies.module.js';
import { PharmacyAccountsModule } from './pharmacy-accounts/pharmacy-accounts.module.js';
import { RulesModule } from './rules/rules.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // General limit per client IP; stricter limits are set on individual routes (e.g. login).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    UsersModule,
    AuthModule,
    HealthModule,
    PharmaciesModule,
    CoaModule,
    RulesModule,
    PharmacyAccountsModule,
    TransactionsModule,
    DemoModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
