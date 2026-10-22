import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PharmaciesModule } from '../pharmacies/pharmacies.module.js';
import { Pharmacy } from '../pharmacies/pharmacy.entity.js';
import { PharmacyAccount } from '../pharmacy-accounts/pharmacy-account.entity.js';
import { PharmacyAccountsModule } from '../pharmacy-accounts/pharmacy-accounts.module.js';
import { Rule } from '../rules/rule.entity.js';
import { RulesModule } from '../rules/rules.module.js';
import { User } from '../users/user.entity.js';
import { DemoDataSeeder } from './demo-data.seeder.js';

/** Sample data for local development only (DEMO_USERS_ENABLED=true). */
@Module({
  imports: [
    TypeOrmModule.forFeature([Pharmacy, Rule, PharmacyAccount, User]),
    PharmaciesModule,
    RulesModule,
    PharmacyAccountsModule,
  ],
  providers: [DemoDataSeeder],
})
export class DemoModule {}
