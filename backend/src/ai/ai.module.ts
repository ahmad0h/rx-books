import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoaModule } from '../coa/coa.module.js';
import { Pharmacy } from '../pharmacies/pharmacy.entity.js';
import { PharmacyAccount } from '../pharmacy-accounts/pharmacy-account.entity.js';
import { BankTransaction } from '../transactions/bank-transaction.entity.js';
import { UsersModule } from '../users/users.module.js';
import { AiPrompt } from './ai-prompt.entity.js';
import { AiRun } from './ai-run.entity.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { ClaudeClient } from './claude.client.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiPrompt,
      AiRun,
      BankTransaction,
      PharmacyAccount,
      Pharmacy,
    ]),
    CoaModule,
    UsersModule,
  ],
  controllers: [AiController],
  providers: [AiService, ClaudeClient],
})
export class AiModule {}
