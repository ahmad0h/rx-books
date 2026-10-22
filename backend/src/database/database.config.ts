import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { DataSourceOptions } from 'typeorm';
import type { DatabaseEnv } from '../config/env.js';
import { CoaAccount } from '../coa/coa-account.entity.js';
import { Pharmacy } from '../pharmacies/pharmacy.entity.js';
import { PharmacyAccount } from '../pharmacy-accounts/pharmacy-account.entity.js';
import { Rule } from '../rules/rule.entity.js';
import { User } from '../users/user.entity.js';
import { CreateUsers1790514830000 } from './migrations/1790514830000-CreateUsers.js';
import { AddPasswordChangedAt1790520000000 } from './migrations/1790520000000-AddPasswordChangedAt.js';
import { CreatePharmacies1790600000000 } from './migrations/1790600000000-CreatePharmacies.js';
import { CreateChartOfAccounts1790700000000 } from './migrations/1790700000000-CreateChartOfAccounts.js';
import { CreateRules1790800000000 } from './migrations/1790800000000-CreateRules.js';
import { CreatePharmacyAccounts1790900000000 } from './migrations/1790900000000-CreatePharmacyAccounts.js';
import { AddSecondChecking1791000000000 } from './migrations/1791000000000-AddSecondChecking.js';

/** Every table the app uses. Add new entities here. */
export const ENTITIES = [User, Pharmacy, CoaAccount, Rule, PharmacyAccount];

/** Every migration, oldest first. Add new migrations here. */
export const MIGRATIONS = [
  CreateUsers1790514830000,
  AddPasswordChangedAt1790520000000,
  CreatePharmacies1790600000000,
  CreateChartOfAccounts1790700000000,
  CreateRules1790800000000,
  CreatePharmacyAccounts1790900000000,
  AddSecondChecking1791000000000,
];

/** Plain TypeORM settings, shared by the app and the migration command line. */
export function buildDataSourceOptions(env: DatabaseEnv): DataSourceOptions {
  return {
    type: 'mysql',
    url: env.DATABASE_URL,
    // Production uses verified TLS; local Docker runs without it.
    ssl: env.DATABASE_TLS ? { rejectUnauthorized: true } : undefined,
    charset: 'utf8mb4',
    // Store and read DATETIME values as UTC.
    timezone: 'Z',
    // Return DATE columns as 'YYYY-MM-DD' text, so transaction dates never shift
    // with time zones. (DECIMAL money values already come back as exact strings.)
    dateStrings: ['DATE'],
    entities: ENTITIES,
    migrations: MIGRATIONS,
    // The schema only changes through migrations, never automatically.
    synchronize: false,
  };
}

/** Settings for the running app: also applies pending migrations at start-up. */
export function buildTypeOrmOptions(env: DatabaseEnv): TypeOrmModuleOptions {
  return {
    ...buildDataSourceOptions(env),
    migrationsRun: true,
    // Keep retrying at start-up while the database is still booting.
    retryAttempts: 10,
    retryDelay: 3000,
  };
}
