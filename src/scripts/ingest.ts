import { NestFactory } from '@nestjs/core';
import { Logger as PinoNestLogger, PinoLogger } from 'nestjs-pino';

import { AppModule } from '../app.module.js';
import { IngestionService } from '../modules/ingestion/ingestion.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(PinoNestLogger));

  const logger = await app.resolve(PinoLogger);

  try {
    await app.init();

    const summary = await app.get(IngestionService).syncAllMakes();

    logger.info(
      {
        makesProcessed: summary.processed,
        makesPersisted: summary.persisted,
        failedMakes: summary.failed,
      },
      'Ingestion script completed',
    );
  } catch (error: unknown) {
    logger.error({ err: error }, 'Ingestion script failed');

    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
