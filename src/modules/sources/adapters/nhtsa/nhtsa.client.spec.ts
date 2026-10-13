import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PinoLogger } from 'nestjs-pino';
import { NhtsaClient } from './nhtsa.client.js';

const BASE_URL = 'https://example.com/api/vehicles';
const XML = '<Response><Results /></Response>';

function createAxiosError(status?: number, code?: string): AxiosError {
  const error = new Error('Request failed') as AxiosError;

  Object.defineProperty(error, 'isAxiosError', {
    value: true,
  });

  if (status !== undefined) {
    error.response = {
      status,
      data: {},
      statusText: 'Error',
      headers: {},
      config: { headers: {} } as AxiosError['config'],
    } as AxiosError['response'];
  }

  if (code) {
    error.code = code;
  }

  return error;
}

describe('NhtsaClient', () => {
  let client: NhtsaClient;

  let http: {
    get: ReturnType<typeof vi.fn>;
  };

  let config: {
    get: ReturnType<typeof vi.fn>;
    getOrThrow: ReturnType<typeof vi.fn>;
  };

  let logger: {
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    http = {
      get: vi.fn(),
    };

    config = {
      getOrThrow: vi.fn().mockReturnValue(`${BASE_URL}/`),
      get: vi.fn((key: string) => {
        const values: Record<string, string> = {
          NHTSA_TIMEOUT_MS: '5000',
          NHTSA_MAX_RETRIES: '2',
        };

        return values[key];
      }),
    };

    logger = {
      warn: vi.fn(),
      error: vi.fn(),
    };

    client = new NhtsaClient(
      http as unknown as HttpService,
      config as unknown as ConfigService,
      logger as unknown as PinoLogger,
    );

    vi.spyOn(
      client as unknown as { delay: (ms: number) => Promise<void> },
      'delay',
    ).mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('reads BASE_URL from ConfigService and removes trailing slashes', async () => {
      http.get.mockReturnValue(of({ data: XML }));

      await client.getAllMakesXml();

      expect(config.getOrThrow).toHaveBeenCalledWith('BASE_URL');
      expect(http.get).toHaveBeenCalledWith(
        `${BASE_URL}/getallmakes?format=XML`,
        expect.any(Object),
      );
    });

    it('propagates a missing BASE_URL configuration error', () => {
      config.getOrThrow.mockImplementation(() => {
        throw new Error('Configuration key "BASE_URL" does not exist');
      });

      expect(
        () =>
          new NhtsaClient(
            http as unknown as HttpService,
            config as unknown as ConfigService,
            logger as unknown as PinoLogger,
          ),
      ).toThrow('BASE_URL');
    });
  });

  describe('getAllMakesXml', () => {
    it('returns the XML response', async () => {
      http.get.mockReturnValue(of({ data: XML }));

      await expect(client.getAllMakesXml()).resolves.toBe(XML);
    });

    it('sends the expected request options', async () => {
      http.get.mockReturnValue(of({ data: XML }));

      await client.getAllMakesXml();

      expect(http.get).toHaveBeenCalledWith(
        `${BASE_URL}/getallmakes?format=XML`,
        {
          timeout: 5000,
          responseType: 'text',
          headers: {
            Accept: 'application/xml, text/xml',
          },
        },
      );
    });
  });

  describe('getVehicleTypesXml', () => {
    it('returns the XML for a valid make ID', async () => {
      http.get.mockReturnValue(of({ data: XML }));

      await expect(client.getVehicleTypesXml(440)).resolves.toBe(XML);

      expect(http.get).toHaveBeenCalledWith(
        `${BASE_URL}/GetVehicleTypesForMakeId/440?format=xml`,
        expect.any(Object),
      );
    });

    it.each([
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ])('rejects invalid make ID: %s', (makeId) => {
      expect(() => client.getVehicleTypesXml(makeId)).toThrow(
        BadGatewayException,
      );

      expect(http.get).not.toHaveBeenCalled();
    });
  });

  describe('response validation', () => {
    it.each([
      ['', 'empty string'],
      ['   ', 'whitespace'],
      [null, 'null'],
      [undefined, 'undefined'],
      [123, 'number'],
      [{ xml: XML }, 'object'],
    ])('rejects an invalid response: %s (%s)', async (data, _description) => {
      http.get.mockReturnValue(of({ data }));

      await expect(client.getAllMakesXml()).rejects.toThrow(
        BadGatewayException,
      );

      expect(http.get).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${BASE_URL}/getallmakes?format=XML`,
        }),
        'NHTSA request failed',
      );
    });

    it('returns malformed XML unchanged for the XML parser to validate', async () => {
      const malformedXml = '<Response><Results>';

      http.get.mockReturnValue(of({ data: malformedXml }));

      await expect(client.getAllMakesXml()).resolves.toBe(malformedXml);
      expect(http.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry behavior', () => {
    it('retries a 5xx response and succeeds on a later attempt', async () => {
      http.get
        .mockReturnValueOnce(throwError(() => createAxiosError(503)))
        .mockReturnValueOnce(throwError(() => createAxiosError(500)))
        .mockReturnValueOnce(of({ data: XML }));

      await expect(client.getAllMakesXml()).resolves.toBe(XML);

      expect(http.get).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledTimes(2);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('retries a timeout/network error without an HTTP status', async () => {
      http.get
        .mockReturnValueOnce(
          throwError(() => createAxiosError(undefined, 'ECONNABORTED')),
        )
        .mockReturnValueOnce(of({ data: XML }));

      await expect(client.getAllMakesXml()).resolves.toBe(XML);

      expect(http.get).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it.each([408, 429, 500, 503])('retries HTTP status %s', async (status) => {
      http.get
        .mockReturnValueOnce(throwError(() => createAxiosError(status)))
        .mockReturnValueOnce(of({ data: XML }));

      await expect(client.getAllMakesXml()).resolves.toBe(XML);

      expect(http.get).toHaveBeenCalledTimes(2);
    });

    it.each([400, 401, 403, 404])(
      'does not retry non-retryable HTTP status %s',
      async (status) => {
        http.get.mockReturnValue(throwError(() => createAxiosError(status)));

        await expect(client.getAllMakesXml()).rejects.toThrow(
          BadGatewayException,
        );

        expect(http.get).toHaveBeenCalledTimes(1);
        expect(logger.warn).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            url: `${BASE_URL}/getallmakes?format=XML`,
          }),
          'NHTSA request failed',
        );
      },
    );

    it('throws ServiceUnavailableException when retries are exhausted', async () => {
      http.get.mockReturnValue(throwError(() => createAxiosError(503)));

      await expect(client.getAllMakesXml()).rejects.toThrow(
        ServiceUnavailableException,
      );

      expect(http.get).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          attempts: 3,
          url: `${BASE_URL}/getallmakes?format=XML`,
        }),
        'NHTSA retries exhausted',
      );
    });

    it('makes only one attempt when maxRetries is zero', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'NHTSA_TIMEOUT_MS') return '5000';
        if (key === 'NHTSA_MAX_RETRIES') return '0';
        return undefined;
      });

      http.get.mockReturnValue(throwError(() => createAxiosError(503)));

      await expect(client.getAllMakesXml()).rejects.toThrow(
        ServiceUnavailableException,
      );

      expect(http.get).toHaveBeenCalledTimes(1);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('uses fallback values for invalid timeout and retry configuration', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'NHTSA_TIMEOUT_MS') return '-10';
        if (key === 'NHTSA_MAX_RETRIES') return 'invalid';
        return undefined;
      });

      http.get.mockReturnValue(of({ data: XML }));

      await client.getAllMakesXml();

      expect(http.get).toHaveBeenCalledWith(
        `${BASE_URL}/getallmakes?format=XML`,
        expect.objectContaining({
          timeout: 10000,
        }),
      );
    });

    it('uses fallback values when configuration is absent', async () => {
      config.get.mockReturnValue(undefined);
      http.get.mockReturnValue(of({ data: XML }));

      await client.getAllMakesXml();

      expect(http.get).toHaveBeenCalledWith(
        `${BASE_URL}/getallmakes?format=XML`,
        expect.objectContaining({
          timeout: 10000,
        }),
      );
    });

    it('wraps non-Axios errors as BadGatewayException without retrying', async () => {
      http.get.mockReturnValue(
        throwError(() => new Error('Unexpected failure')),
      );

      await expect(client.getAllMakesXml()).rejects.toThrow(
        BadGatewayException,
      );

      expect(http.get).toHaveBeenCalledTimes(1);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${BASE_URL}/getallmakes?format=XML`,
        }),
        'NHTSA request failed',
      );
    });
  });
});
