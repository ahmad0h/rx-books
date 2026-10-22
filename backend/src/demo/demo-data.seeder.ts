import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { AppEnv } from '../config/env.js';
import { PharmaciesService } from '../pharmacies/pharmacies.service.js';
import { Pharmacy } from '../pharmacies/pharmacy.entity.js';
import { PharmacyAccount } from '../pharmacy-accounts/pharmacy-account.entity.js';
import { PharmacyAccountsService } from '../pharmacy-accounts/pharmacy-accounts.service.js';
import { Rule } from '../rules/rule.entity.js';
import { RulesService } from '../rules/rules.service.js';
import { User } from '../users/user.entity.js';
import { DEMO_ACCOUNTS } from './demo-accounts.js';
import { DEMO_RULES } from './demo-rules.js';

export const DEMO_PHARMACY = 'Lakeside Community Pharmacy';

/**
 * In local development (DEMO_USERS_ENABLED=true) makes sure the demo pharmacy
 * exists with its sample bank accounts and rules, and the demo client user is
 * its owner, matching the demo statements
 * in the handoff. Each part is added only when the pharmacy has none yet, so
 * changes made in the app are left alone.
 */
@Injectable()
export class DemoDataSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger('DemoData');

  constructor(
    @InjectRepository(Pharmacy)
    private readonly pharmacyRepo: Repository<Pharmacy>,
    @InjectRepository(Rule)
    private readonly ruleRepo: Repository<Rule>,
    @InjectRepository(PharmacyAccount)
    private readonly accountRepo: Repository<PharmacyAccount>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly pharmacies: PharmaciesService,
    private readonly rules: RulesService,
    private readonly accounts: PharmacyAccountsService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('DEMO_USERS_ENABLED', { infer: true })) return;
    try {
      await this.seed();
    } catch (error) {
      // Demo data must never stop the app from starting.
      this.logger.warn(`Skipped demo data: ${(error as Error).message}`);
    }
  }

  private async seed(): Promise<void> {
    let pharmacy = await this.pharmacyRepo.findOne({
      where: { name: DEMO_PHARMACY },
    });
    if (!pharmacy) {
      pharmacy = await this.pharmacies.create({
        name: DEMO_PHARMACY,
        ownerName: 'Demo Lakeside Owner',
        ownerPhone: '(612) 555-0142',
        ownerEmail: 'owner@lakeside-pharmacy.test',
      });
      this.logger.log(`Created demo pharmacy ${DEMO_PHARMACY}`);
    }

    // The demo client signs in as Lakeside's owner, to answer owner questions.
    const demoClient = await this.userRepo.findOne({
      where: { email: this.config.get('DEMO_CLIENT_EMAIL', { infer: true }) },
    });
    if (demoClient && demoClient.role === 'client' && !demoClient.pharmacyId) {
      await this.userRepo.update(
        { id: demoClient.id },
        { pharmacyId: pharmacy.id },
      );
      this.logger.log(
        `Linked demo client ${demoClient.email} to ${DEMO_PHARMACY}`,
      );
    }

    if (!(await this.accountRepo.existsBy({ pharmacyId: pharmacy.id }))) {
      for (const account of DEMO_ACCOUNTS) {
        await this.accounts.create(pharmacy.id, account);
      }
      this.logger.log(
        `Added ${DEMO_ACCOUNTS.length} demo accounts to ${DEMO_PHARMACY}`,
      );
    }

    if (!(await this.ruleRepo.existsBy({ pharmacyId: pharmacy.id }))) {
      for (const rule of DEMO_RULES) {
        await this.rules.create({ ...rule, pharmacyId: pharmacy.id });
      }
      this.logger.log(
        `Added ${DEMO_RULES.length} demo rules to ${DEMO_PHARMACY}`,
      );
    }
  }
}
