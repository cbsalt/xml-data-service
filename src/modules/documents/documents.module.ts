import { Module } from '@nestjs/common';
import { DocumentsService } from './documents/documents.service.js';
import { DocumentsResolver } from './documents/documents.resolver.js';

@Module({
  providers: [DocumentsService, DocumentsResolver]
})
export class DocumentsModule {}
