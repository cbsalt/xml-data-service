import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { SourcesModule } from './modules/sources/sources.module.js';
import { IngestionModule } from './modules/ingestion/ingestion.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';

@Module({
  imports: [SourcesModule, IngestionModule, DocumentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
