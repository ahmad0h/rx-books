import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { AppEnv } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  const port = app
    .get(ConfigService<AppEnv, true>)
    .get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`RxBooks backend listening on port ${port}`, 'Bootstrap');
}
await bootstrap();
