import { Module } from '@nestjs/common';
import { XmlParserService } from './xml-parser/xml-parser.service.js';
import { NormalizerService } from './normalizer/normalizer.service.js';

@Module({
  providers: [XmlParserService, NormalizerService]
})
export class SourcesModule {}
