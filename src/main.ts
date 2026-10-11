import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { Logger } from 'nestjs-pino';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  const config = app.get(ConfigService);

  await app.listen(config.get<number>('PORT', 3000));
}
await bootstrap();
