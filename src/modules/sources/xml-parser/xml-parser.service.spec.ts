import { Test, TestingModule } from '@nestjs/testing';
import { XmlParserService } from './xml-parser.service.js';

describe('XmlParserService', () => {
  let service: XmlParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [XmlParserService],
    }).compile();

    service = module.get<XmlParserService>(XmlParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
