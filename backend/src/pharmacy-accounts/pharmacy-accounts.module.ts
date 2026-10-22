import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoaModule } from '../coa/coa.module.js';
import { Pharmacy } from '../pharmacies/pharmacy.entity.js';
import { PharmacyAccount } from './pharmacy-account.entity.js';
import { PharmacyAccountsController } from './pharmacy-accounts.controller.js';
import { PharmacyAccountsService } from './pharmacy-accounts.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([PharmacyAccount, Pharmacy]), CoaModule],
  controllers: [PharmacyAccountsController],
  providers: [PharmacyAccountsService],
  exports: [PharmacyAccountsService],
})
export class PharmacyAccountsModule {}
