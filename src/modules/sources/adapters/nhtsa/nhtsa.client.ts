import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class NhtsaClient {
  private readonly baseUrl = process.env.BASE_URL;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    @InjectPinoLogger(NhtsaClient.name)
    private readonly logger: PinoLogger,
  ) {}

  getAllMakesXml(): Promise<string> {
    return this.getXml(`${this.config.get('BASE_URL')}/getallmakes?format=XML`);
  }

  getVehicleTypesXml(makeId: number): Promise<string> {
    if (!Number.isSafeInteger(makeId) || makeId <= 0) {
      throw new BadGatewayException('Invalid vehicle make ID');
    }

    return this.getXml(
      `${this.baseUrl}/GetVehicleTypesForMakeId/${makeId}?format=xml`,
    );
  }

  private async getXml(url: string): Promise<string> {
    const timeoutMs = this.readInt('NHTSA_TIMEOUT_MS', 10000);
    const maxRetries = this.readInt('NHTSA_MAX_RETRIES', 3);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await firstValueFrom(
          this.http.get<string>(url, {
            timeout: timeoutMs,
            responseType: 'text',
            headers: {
              Accept: 'application/xml, text/xml',
            },
          }),
        );

        if (typeof response.data !== 'string' || response.data.trim() === '') {
          throw new BadGatewayException(
            'The NHTSA API returned an empty response',
          );
        }

        return response.data;
      } catch (error: unknown) {
        const retryable = this.isRetryable(error);

        if (!retryable) {
          this.logger.error({ url, err: error }, 'NHTSA request failed');

          throw new BadGatewayException('Unable to retrieve data from NHTSA');
        }

        if (attempt === maxRetries) {
          this.logger.error(
            { url, attempts: attempt + 1, err: error },
            'NHTSA retries exhausted',
          );

          throw new ServiceUnavailableException(
            'NHTSA API is temporarily unavailable',
          );
        }

        const delayMs = 250 * 2 ** attempt + Math.floor(Math.random() * 250);

        this.logger.warn(
          { url, attempt: attempt + 1, delayMs },
          'Retrying NHTSA request',
        );

        await this.delay(delayMs);
      }
    }

    throw new ServiceUnavailableException(
      'NHTSA API is temporarily unavailable',
    );
  }

  private isRetryable(error: unknown): boolean {
    if (!isAxiosError(error)) {
      return false;
    }

    const status = error.response?.status;

    return (
      status === undefined || status === 408 || status === 429 || status >= 500
    );
  }

  private readInt(key: string, fallback: number): number {
    const value = Number(this.config.get<string>(key) ?? fallback);

    return Number.isInteger(value) && value >= 0 ? value : fallback;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
