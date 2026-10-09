import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoaModule } from '../coa/coa.module.js';
import { PharmaciesModule } from '../pharmacies/pharmacies.module.js';
import { Pharmacy } from '../pharmacies/pharmacy.entity.js';
import { DemoRulesSeeder } from './demo-rules.seeder.js';
import { Rule } from './rule.entity.js';
import { RulesController } from './rules.controller.js';
import { RulesService } from './rules.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Rule, Pharmacy]),
    CoaModule,
    PharmaciesModule,
  ],
  controllers: [RulesController],
  providers: [RulesService, DemoRulesSeeder],
  exports: [RulesService],
})
export class RulesModule {}
