import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { AppEnv } from '../config/env.js';
import { PharmaciesService } from '../pharmacies/pharmacies.service.js';
import { Pharmacy } from '../pharmacies/pharmacy.entity.js';
import { Rule } from './rule.entity.js';
import type { CreateRuleInput } from './rule.input.js';
import { RulesService } from './rules.service.js';

export const DEMO_PHARMACY = 'Lakeside Community Pharmacy';

type DemoRule = Omit<CreateRuleInput, 'pharmacyId'>;

/**
 * Made-up rules for the demo pharmacy, written to match the demo bank
 * statements in the handoff (03_Data Model & Samples). They show a pharmacy
 * rule overriding a shared one, direction words in keywords, and rules that
 * need a person to confirm.
 */
const DEMO_RULES: DemoRule[] = [
  {
    priority: 10,
    keyword: 'DEPOSIT INDEPENDENT PHAR',
    coaCode: '4010',
    tag: 'PSAO_REMIT',
    autoApprove: true,
    sourceNote: 'Co-op (PSAO) passing on PBM claim payments. Deposit side.',
  },
  {
    priority: 20,
    keyword: 'WITHDRAWAL INDEPENDENT PHAR',
    coaCode: '5010',
    tag: 'COOP_PURCHASE',
    autoApprove: true,
    sourceNote:
      'Drug purchases through the co-op. Same name as the deposit rule: the direction word tells them apart.',
  },
  {
    priority: 30,
    keyword: 'OAKMONT PROPERTIES',
    coaCode: '6110',
    tag: 'RENT',
    autoApprove: true,
    sourceNote: 'Store landlord, monthly rent.',
  },
  {
    priority: 40,
    keyword: 'GUSTO',
    coaCode: '6010',
    tag: 'PAYROLL',
    autoApprove: false,
    sourceNote:
      'Payroll provider. Debits mix wages and payroll tax, so staff confirm each one.',
  },
  {
    priority: 50,
    keyword: 'MERCHANT SERVICE',
    coaCode: '4040',
    tag: 'FRONT_END',
    autoApprove: true,
    sourceNote:
      'Card deposits here are front-store sales. Overrides the shared MERCHANT SERVICE rule (4030).',
  },
  {
    priority: 60,
    keyword: 'ANALYSIS SERVICE CHARGE',
    coaCode: '6340',
    tag: 'BANK_FEE',
    autoApprove: true,
    sourceNote: 'Monthly account analysis fee from the bank.',
  },
  {
    priority: 70,
    keyword: 'CARDMEMBER SERV',
    coaCode: '2010',
    tag: 'CARD_PAYMENT',
    autoApprove: false,
    sourceNote:
      'Paying the store credit card from checking. A transfer, so staff confirm it.',
  },
  {
    priority: 80,
    keyword: 'AUTOMATIC PAYMENT - THANK',
    coaCode: '2010',
    tag: 'CARD_PAYMENT',
    autoApprove: false,
    sourceNote: 'The same card payment, as it shows on the card statement.',
  },
  {
    priority: 90,
    keyword: 'COSTCO GAS',
    coaCode: '6350',
    tag: 'DELIVERY_FUEL',
    autoApprove: true,
    sourceNote:
      'Fuel for the delivery car. (Costco warehouse purchases are mixed-use and get no rule.)',
  },
];

/**
 * In local development (DEMO_USERS_ENABLED=true) makes sure the demo pharmacy
 * exists and has its sample rules. A pharmacy that already has rules is left alone.
 */
@Injectable()
export class DemoRulesSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger('DemoRules');

  constructor(
    @InjectRepository(Pharmacy)
    private readonly pharmacyRepo: Repository<Pharmacy>,
    @InjectRepository(Rule)
    private readonly ruleRepo: Repository<Rule>,
    private readonly pharmacies: PharmaciesService,
    private readonly rules: RulesService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('DEMO_USERS_ENABLED', { infer: true })) return;
    try {
      await this.seed();
    } catch (error) {
      // Demo data must never stop the app from starting.
      this.logger.warn(`Skipped demo rules: ${(error as Error).message}`);
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
    if (await this.ruleRepo.existsBy({ pharmacyId: pharmacy.id })) return;

    for (const rule of DEMO_RULES) {
      await this.rules.create({ ...rule, pharmacyId: pharmacy.id });
    }
    this.logger.log(
      `Added ${DEMO_RULES.length} demo rules to ${DEMO_PHARMACY}`,
    );
  }
}
