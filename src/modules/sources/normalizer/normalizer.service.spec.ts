import { Test, TestingModule } from '@nestjs/testing';
import { NormalizerService } from './normalizer.service.js';

describe('NormalizerService', () => {
  let service: NormalizerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NormalizerService],
    }).compile();

    service = module.get<NormalizerService>(NormalizerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
