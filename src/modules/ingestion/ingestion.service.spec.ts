import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IngestionService } from './ingestion.service.js';
import { DocumentsService } from '../documents/documents.service.js';

import { NhtsaClient } from '../sources/adapters/nhtsa/nhtsa.client.js';
import { NormalizerService } from '../sources/normalizer/normalizer.service.js';
import { XmlParserService } from '../sources/xml-parser/xml-parser.service.js';
import { getLoggerToken } from 'nestjs-pino';

describe('IngestionService', () => {
  let service: IngestionService;

  const nhtsaClientMock = {
    getAllMakesXml: vi.fn(),
    getVehicleTypesXml: vi.fn(),
  };

  const documentsServiceMock = {
    upsertMany: vi.fn(),
  };

  const normalizerMock = {
    normalizeMakes: vi.fn(),
    normalizeVehicleTypes: vi.fn(),
  };

  const xmlParserMock = {
    parse: vi.fn(),
  };

  const makesXml = `
    <Response>
      <Count>1</Count>
      <Message>Success</Message>
      <Results>
        <AllVehicleMakes>
          <Make_ID>12858</Make_ID>
          <Make_Name>#1 ALPINE CUSTOMS</Make_Name>
        </AllVehicleMakes>
      </Results>
    </Response>
  `;

  const vehicleTypesXml = `
    <Response>
      <Count>1</Count>
      <Message>Success</Message>
      <Results>
        <VehicleTypesForMakeIds>
          <VehicleTypeId>6</VehicleTypeId>
          <VehicleTypeName>Trailer</VehicleTypeName>
        </VehicleTypesForMakeIds>
      </Results>
    </Response>
  `;

  beforeEach(async () => {
    vi.clearAllMocks();

    nhtsaClientMock.getAllMakesXml.mockResolvedValue(makesXml);
    nhtsaClientMock.getVehicleTypesXml.mockResolvedValue(vehicleTypesXml);
    documentsServiceMock.upsertMany.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: NhtsaClient, useValue: nhtsaClientMock },
        { provide: XmlParserService, useValue: xmlParserMock },
        { provide: NormalizerService, useValue: normalizerMock },
        { provide: DocumentsService, useValue: documentsServiceMock },
        {
          provide: getLoggerToken(IngestionService.name),
          useValue: {
            setContext: vi.fn(),
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(IngestionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch, transform, and persist vehicle makes', async () => {
    xmlParserMock.parse
      .mockReturnValueOnce({
        Response: {
          Count: 1,
          Message: 'Success',
          Results: {
            AllVehicleMakes: {
              Make_ID: 12858,
              Make_Name: '#1 ALPINE CUSTOMS',
            },
          },
        },
      })
      .mockReturnValueOnce({
        Response: {
          Count: 1,
          Message: 'Success',
          Results: {
            VehicleTypesForMakeIds: {
              VehicleTypeId: 6,
              VehicleTypeName: 'Trailer',
            },
          },
        },
      });
    normalizerMock.normalizeMakes.mockReturnValue([
      {
        makeId: 12858,
        makeName: '#1 ALPINE CUSTOMS',
      },
    ]);
    normalizerMock.normalizeVehicleTypes.mockReturnValue([
      {
        typeId: 6,
        typeName: 'Trailer',
      },
    ]);

    const result = await service.syncAllMakes();

    expect(nhtsaClientMock.getAllMakesXml).toHaveBeenCalledTimes(1);
    expect(nhtsaClientMock.getVehicleTypesXml).toHaveBeenCalledWith(12858);
    expect(documentsServiceMock.upsertMany).toHaveBeenCalledWith([
      {
        makeId: 12858,
        makeName: '#1 ALPINE CUSTOMS',
        vehicleTypes: [
          {
            typeId: 6,
            typeName: 'Trailer',
          },
        ],
      },
    ]);
    expect(result).toEqual({
      processed: 1,
      persisted: 1,
      failed: 0,
    });
  });

  it('should handle an external API failure', async () => {
    nhtsaClientMock.getVehicleTypesXml.mockRejectedValueOnce(
      new Error('NHTSA service unavailable'),
    );

    await expect(service.syncAllMakes()).rejects.toThrow();

    expect(documentsServiceMock.upsertMany).not.toHaveBeenCalled();
  });
});
