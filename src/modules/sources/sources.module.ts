import { Module } from '@nestjs/common';
import { XmlParserService } from './xml-parser/xml-parser.service.js';
import { NormalizerService } from './normalizer/normalizer.service.js';
import { HttpModule } from '@nestjs/axios';
import { NhtsaClient } from './adapters/nhtsa/nhtsa.client.js';

@Module({
  imports: [HttpModule],
  providers: [XmlParserService, NormalizerService, NhtsaClient],
  exports: [XmlParserService, NormalizerService, NhtsaClient],
})
export class SourcesModule {}
