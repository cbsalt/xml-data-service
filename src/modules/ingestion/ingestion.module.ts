import { Module } from '@nestjs/common';
import { IngestionService } from './ingestion.service.js';
import { SourcesModule } from '../sources/sources.module.js';
import { DocumentsModule } from '../documents/documents.module.js';

@Module({
  imports: [SourcesModule, DocumentsModule],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
