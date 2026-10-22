import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoaModule } from '../coa/coa.module.js';
import { Pharmacy } from '../pharmacies/pharmacy.entity.js';
import { Rule } from './rule.entity.js';
import { RulesController } from './rules.controller.js';
import { RulesService } from './rules.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Rule, Pharmacy]), CoaModule],
  controllers: [RulesController],
  providers: [RulesService],
  exports: [RulesService],
})
export class RulesModule {}
