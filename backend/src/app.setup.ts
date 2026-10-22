import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

/** App-wide settings, shared by main.ts and the end-to-end tests. */
export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  // Requests arrive through nginx / the Vite proxy on the private Docker network;
  // trust their X-Forwarded-For so rate limits see the real client IP.
  app.set('trust proxy', 'loopback, uniquelocal');
  app.use(cookieParser());
  // Bank CSVs are sent as JSON text (up to about 2 MB of file content).
  app.useBodyParser('json', { limit: '3mb' });
  // Reject request bodies that don't match the DTO, including unknown fields.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
}
