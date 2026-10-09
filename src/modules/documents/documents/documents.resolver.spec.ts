import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsResolver } from './documents.resolver.js';

describe('DocumentsResolver', () => {
  let resolver: DocumentsResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentsResolver],
    }).compile();

    resolver = module.get<DocumentsResolver>(DocumentsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
