import { Test, TestingModule } from '@nestjs/testing';
import { XmlParserService } from './xml-parser.service.js';
import { BadGatewayException } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

describe('XmlParserService', () => {
  let service: XmlParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [XmlParserService],
    }).compile();

    service = module.get<XmlParserService>(XmlParserService);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('parse', () => {
    it('parses valid XML into an object', () => {
      const xml = `
        <Response>
          <Count>2</Count>
          <Message>Success</Message>
        </Response>  
      `;

      expect(service.parse(xml)).toEqual({
        Response: {
          Count: 2,
          Message: 'Success',
        },
      });
    });

    it('rejects an empty string', () => {
      expect(() => service.parse('')).toThrow(BadGatewayException);
    });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'unexpected result'],
    ['a number', 123],
    ['an array', []],
  ])('throws BadGatewayException when parser returns %s', (_, result) => {
    const service = new XmlParserService();

    const parser = (service as unknown as { parser: XMLParser }).parser;

    vi.spyOn(parser, 'parse').mockReturnValue(result as never);

    expect(() => service.parse('<Response />')).toThrow(
      new BadGatewayException('Unexpected XML response structure'),
    );
  });
});
