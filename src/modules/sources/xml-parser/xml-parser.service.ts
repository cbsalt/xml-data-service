import { BadGatewayException, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { SyntaxValidator } from 'fast-xml-validator';

@Injectable()
export class XmlParserService {
  private readonly parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: true,
    trimValues: true,
  });

  parse(xml: string): Record<string, unknown> {
    const validation = SyntaxValidator.validate(xml);

    if (validation !== true) {
      throw new BadGatewayException('The NHTSA API returned invalid XML');
    }

    const result: unknown = this.parser.parse(xml);

    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new BadGatewayException('Unexpected XML response structure');
    }

    return result as Record<string, unknown>;
  }
}
