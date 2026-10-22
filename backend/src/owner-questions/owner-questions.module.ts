import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoaModule } from '../coa/coa.module.js';
import { Pharmacy } from '../pharmacies/pharmacy.entity.js';
import { PharmacyAccount } from '../pharmacy-accounts/pharmacy-account.entity.js';
import { BankTransaction } from '../transactions/bank-transaction.entity.js';
import { UsersModule } from '../users/users.module.js';
import { OwnerQuestion } from './owner-question.entity.js';
import {
  OwnerQuestionsController,
  StaffQuestionsController,
} from './owner-questions.controller.js';
import { OwnerQuestionsService } from './owner-questions.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OwnerQuestion,
      BankTransaction,
      PharmacyAccount,
      Pharmacy,
    ]),
    CoaModule,
    UsersModule,
  ],
  controllers: [StaffQuestionsController, OwnerQuestionsController],
  providers: [OwnerQuestionsService],
})
export class OwnerQuestionsModule {}
