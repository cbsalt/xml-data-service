import { BadGatewayException, Injectable } from '@nestjs/common';
import {
  VehicleMakeIdentity,
  VehicleTypeData,
} from '../../../common/contracts/vehicle-make.contracts.js';

type XmlRecord = Record<string, unknown>;
@Injectable()
export class NormalizerService {
  normalizeMakes(xml: unknown): VehicleMakeIdentity[] {
    const results = this.getResults(xml);
    const items = this.toArray(results['AllVehicleMakes']);

    const makes = items.map((item) => {
      const make = this.asRecord(item, 'AllVehicleMakes');

      return {
        makeId: this.toId(make['Make_ID'], 'Make_ID'),
        makeName: this.toText(make['Make_Name'], 'Make_Name'),
      };
    });

    return [...new Map(makes.map((make) => [make.makeId, make])).values()];
  }

  normalizeVehicleTypes(xml: unknown): VehicleTypeData[] {
    const results = this.getResults(xml);
    const items = this.toArray(results['VehicleTypesForMakeIds']);

    return items.map((item) => {
      const vehicleType = this.asRecord(item, 'VehicleTypesForMakeIds');

      return {
        typeId: this.toId(vehicleType['VehicleTypeId'], 'VehicleTypeId'),
        typeName: this.toText(
          vehicleType['VehicleTypeName'],
          'VehicleTypeName',
        ),
      };
    });
  }

  private getResults(xml: unknown): XmlRecord {
    const root = this.asRecord(xml, 'XML root');

    const response = this.asRecord(root['Response'] ?? root, 'Response');

    const results = response['Results'];

    if (results === null || results === '') {
      return {};
    }

    return this.asRecord(results, 'Results');
  }

  private toArray(value: unknown): unknown[] {
    if (value === undefined || value === null || value === '') {
      return [];
    }

    return Array.isArray(value) ? value : [value];
  }

  private asRecord(value: unknown, field: unknown): XmlRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadGatewayException(
        `Invalid field in NHTSA response: ${field}`,
      );
    }

    return value as XmlRecord;
  }

  private toId(value: unknown, field: string): number {
    const id = typeof value === 'number' ? value : Number(value);

    if (!Number.isSafeInteger(id) || id < 0) {
      throw new BadGatewayException(
        `Invalid identifier in NHTSA response: ${field}`,
      );
    }

    return id;
  }

  private toText(value: unknown, field: string): string {
    if (value === undefined || value === null || value === '') {
      throw new BadGatewayException(
        `Missing value in NHTSA response: ${field}`,
      );
    }

    return String(value).trim();
  }
}
