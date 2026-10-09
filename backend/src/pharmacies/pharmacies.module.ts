import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity.js';
import { PharmaciesController } from './pharmacies.controller.js';
import { PharmaciesService } from './pharmacies.service.js';
import { Pharmacy } from './pharmacy.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Pharmacy, User])],
  controllers: [PharmaciesController],
  providers: [PharmaciesService],
})
export class PharmaciesModule {}
