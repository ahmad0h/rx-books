import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoaModule } from '../coa/coa.module.js';
import { Pharmacy } from '../pharmacies/pharmacy.entity.js';
import { PharmacyAccount } from '../pharmacy-accounts/pharmacy-account.entity.js';
import { Rule } from '../rules/rule.entity.js';
import { UsersModule } from '../users/users.module.js';
import { BankTransaction } from './bank-transaction.entity.js';
import { CategorizationService } from './categorization.service.js';
import { TransactionUpload } from './transaction-upload.entity.js';
import { TransactionsController } from './transactions.controller.js';
import { TransactionsService } from './transactions.service.js';
import { UploadsService } from './uploads.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BankTransaction,
      TransactionUpload,
      PharmacyAccount,
      Pharmacy,
      Rule,
    ]),
    CoaModule,
    UsersModule,
  ],
  controllers: [TransactionsController],
  providers: [UploadsService, TransactionsService, CategorizationService],
  exports: [TransactionsService, CategorizationService],
})
export class TransactionsModule {}
