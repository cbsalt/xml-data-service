import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service.js';
import { getModelToken } from '@nestjs/mongoose';
import { VehicleMake } from './schemas/document.schema/document.schema.js';

describe('DocumentsService', () => {
  let service: DocumentsService;

  const modelMock = {
    bulkWrite: vi.fn(),
    findOne: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: getModelToken(VehicleMake.name),
          useValue: modelMock,
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should persist documents using bulkWrite', async () => {
    modelMock.bulkWrite.mockResolvedValue({ upsertedCount: 1 });

    const documents = [
      {
        makeId: 12858,
        makeName: '#1 ALPINE CUSTOMS',
        vehicleTypes: [{ typeId: 6, typeName: 'Trailer' }],
      },
    ];

    await service.upsertMany(documents);

    expect(modelMock.bulkWrite).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: { makeId: 12858 },
            upsert: true,
          }),
        }),
      ]),
      expect.anything(),
    );
  });

  it('should return a document by makeId', async () => {
    const document = {
      makeId: 12858,
      makeName: '#1 ALPINE CUSTOMS',
      vehicleTypes: [{ typeId: 6, typeName: 'Trailer' }],
    };

    modelMock.findOne.mockReturnValue({
      lean: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(document),
      }),
    });

    await expect(service.findByMakeId(12858)).resolves.toEqual(document);

    expect(modelMock.findOne).toHaveBeenCalledWith(
      { makeId: 12858 },
      {
        _id: 0,
        makeId: 1,
        makeName: 1,
        vehicleTypes: 1,
      },
    );
  });
});
