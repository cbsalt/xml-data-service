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
    let validation: ReturnType<typeof SyntaxValidator.validate>;

    try {
      validation = SyntaxValidator.validate(xml);
    } catch {
      throw new BadGatewayException('The NHTSA API returned invalid XML');
    }

    if (validation !== true) {
      throw new BadGatewayException('The NHTSA API returned invalid XML');
    }

    let result: unknown;

    try {
      result = this.parser.parse(xml);
    } catch {
      throw new BadGatewayException('The NHTSA API returned invalid XML');
    }

    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new BadGatewayException('Unexpected XML response structure');
    }

    return result as Record<string, unknown>;
  }
}
