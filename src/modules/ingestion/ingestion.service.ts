import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NhtsaClient } from '../sources/adapters/nhtsa/nhtsa.client.js';
import { XmlParserService } from '../sources/xml-parser/xml-parser.service.js';
import { NormalizerService } from '../sources/normalizer/normalizer.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { VehicleMakeData } from '../../common/contracts/vehicle-make.contracts.js';
import { pMapIterable } from 'p-map';

@Injectable()
export class IngestionService {
  constructor(
    private readonly nhtsaClient: NhtsaClient,
    private readonly xmlParser: XmlParserService,
    private readonly normalizer: NormalizerService,
    private readonly documentsService: DocumentsService,
    @InjectPinoLogger(IngestionService.name)
    private readonly logger: PinoLogger,
  ) {}

  async syncAllMakes(): Promise<{
    processed: number;
    persisted: number;
    failed: number;
  }> {
    const startedAt = Date.now();

    const xml = await this.nhtsaClient.getAllMakesXml();
    const parsed = this.xmlParser.parse(xml);
    const makes = this.normalizer.normalizeMakes(parsed);

    if (makes.length === 0) {
      throw new BadGatewayException('NHTSA returned no makes');
    }

    const concurrency = 5;
    const persistenceBatchSize = 100;

    let processed = 0;
    let persisted = 0;
    const failedMakeIds: number[] = [];
    let pending: VehicleMakeData[] = [];

    const flush = async () => {
      if (pending.length === 0) return;

      const elapsedMs = Date.now() - startedAt;

      const batch = pending;
      pending = [];

      await this.documentsService.upsertMany(batch);
      persisted += batch.length;

      this.logger.info(
        {
          processed,
          persisted,
          failed: failedMakeIds.length,
          elapsedMs,
          itemsPerSecond: Number((processed / (elapsedMs / 1000)).toFixed(2)),
        },
        'NHTSA ingestion progress',
      );
    };

    let consecutiveFailures = 0;

    for await (const result of pMapIterable(
      makes,
      async (make) => {
        try {
          const typesXml = await this.nhtsaClient.getVehicleTypesXml(
            make.makeId,
          );

          const typesParsed = this.xmlParser.parse(typesXml);

          return {
            ok: true as const,
            data: {
              ...make,
              vehicleTypes: this.normalizer.normalizeVehicleTypes(typesParsed),
            },
          };
        } catch (error: unknown) {
          this.logger.warn(
            {
              makeId: make.makeId,
              error: error instanceof Error ? error.message : String(error),
            },
            'Failed to process vehicle make',
          );

          return { ok: false as const, makeId: make.makeId };
        }
      },
      { concurrency, backpressure: 10 },
    )) {
      const maxConsecutiveFailures = 20;
      processed++;

      if (result.ok) {
        consecutiveFailures = 0;
        pending.push(result.data);
      } else {
        consecutiveFailures++;
        failedMakeIds.push(result.makeId);

        if (consecutiveFailures >= maxConsecutiveFailures) {
          await flush();
          throw new ServiceUnavailableException(
            `Aborting: ${consecutiveFailures} consecutive failures (possible block)`,
          );
        }
      }

      if (pending.length >= persistenceBatchSize) {
        await flush();
      }
    }

    await flush();

    this.logger.info(
      {
        processed,
        persisted,
        failed: failedMakeIds.length,
        failedMakeIds: failedMakeIds.slice(0, 20),
        durationMs: Date.now() - startedAt,
      },
      'NHTSA ingestion finished',
    );

    if (failedMakeIds.length > 0) {
      throw new BadGatewayException(
        `Ingestion completed with ${failedMakeIds.length} failed makes.` +
          'See logs for the affected IDs.',
      );
    }

    return {
      processed,
      persisted,
      failed: 0,
    };
  }
}
