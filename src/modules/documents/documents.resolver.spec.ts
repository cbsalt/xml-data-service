import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsResolver } from './documents.resolver.js';
import { DocumentsService } from './documents.service.js';

describe('DocumentsResolver', () => {
  let resolver: DocumentsResolver;

  const documentsServiceMock = {
    findByMakeId: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsResolver,
        {
          provide: DocumentsService,
          useValue: documentsServiceMock,
        },
      ],
    }).compile();

    resolver = module.get<DocumentsResolver>(DocumentsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('should return the make requested by ID', async () => {
    const document = {
      makeId: 12858,
      makeName: '#1 ALPINE CUSTOMS',
      vehicleTypes: [{ typeId: 6, typeName: 'Trailer' }],
    };

    documentsServiceMock.findByMakeId.mockResolvedValue(document);

    await expect(resolver.vehicleMake(12858)).resolves.toEqual(document);

    expect(documentsServiceMock.findByMakeId).toHaveBeenCalledWith(12858);
  });
});
