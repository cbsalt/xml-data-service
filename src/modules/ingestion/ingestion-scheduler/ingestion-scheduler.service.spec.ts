import { Test, TestingModule } from '@nestjs/testing';
import { IngestionSchedulerService } from './ingestion-scheduler.service.js';

describe('IngestionSchedulerService', () => {
  let service: IngestionSchedulerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IngestionSchedulerService],
    }).compile();

    service = module.get<IngestionSchedulerService>(IngestionSchedulerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
