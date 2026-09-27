import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppEnv } from '../config/env.js';
import { buildTypeOrmOptions } from './database.config.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) =>
        buildTypeOrmOptions({
          DATABASE_URL: config.get('DATABASE_URL', { infer: true }),
          DATABASE_TLS: config.get('DATABASE_TLS', { infer: true }),
        }),
    }),
  ],
})
export class DatabaseModule {}
