import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoaAccount } from './coa-account.entity.js';
import { CoaController } from './coa.controller.js';
import { CoaService } from './coa.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([CoaAccount])],
  controllers: [CoaController],
  providers: [CoaService],
  exports: [CoaService],
})
export class CoaModule {}
