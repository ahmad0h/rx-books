import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DemoUsersSeeder } from './demo-users.seeder.js';
import { User } from './user.entity.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService, DemoUsersSeeder],
  exports: [UsersService],
})
export class UsersModule {}
