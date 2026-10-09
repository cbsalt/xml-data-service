import { Module } from '@nestjs/common';
import { IngestionService } from './ingestion/ingestion.service.js';
import { IngestionSchedulerService } from './ingestion-scheduler/ingestion-scheduler.service.js';

@Module({
  providers: [IngestionService, IngestionSchedulerService]
})
export class IngestionModule {}
