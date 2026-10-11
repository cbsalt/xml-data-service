import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  VehicleMake,
  VehicleMakeSchema,
} from './schemas/document.schema/document.schema.js';
import { DocumentsService } from './documents.service.js';
import { DocumentsResolver } from './documents.resolver.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: VehicleMake.name,
        schema: VehicleMakeSchema,
      },
    ]),
  ],
  providers: [DocumentsService, DocumentsResolver],
  exports: [DocumentsService],
})
export class DocumentsModule {}
