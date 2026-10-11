import { NormalizerService } from './normalizer.service.js';

describe('NormalizerService', () => {
  let service: NormalizerService;

  beforeEach(() => {
    service = new NormalizerService();
  });

  it('should normalize a single make', () => {
    const result = service.normalizeMakes({
      Response: {
        Results: {
          AllVehicleMakes: {
            Make_ID: 440,
            Make_Name: 'Example Make',
          },
        },
      },
    });

    expect(result).toEqual([
      {
        makeId: 440,
        makeName: 'Example Make',
      },
    ]);
  });

  it('should normalize multiple makes', () => {
    const result = service.normalizeMakes({
      Response: {
        Results: {
          AllVehicleMakes: [
            { Make_ID: 440, Make_Name: 'Make A' },
            { Make_ID: 441, Make_Name: 'Make B' },
          ],
        },
      },
    });

    expect(result).toEqual([
      { makeId: 440, makeName: 'Make A' },
      { makeId: 441, makeName: 'Make B' },
    ]);
  });

  it('should normalize vehicle types', () => {
    const result = service.normalizeVehicleTypes({
      Response: {
        Results: {
          VehicleTypesForMakeIds: [
            {
              VehicleTypeId: 1,
              VehicleTypeName: 'Passenger Car',
            },
            {
              VehicleTypeId: 2,
              VehicleTypeName: 'Truck',
            },
          ],
        },
      },
    });

    expect(result).toEqual([
      { typeId: 1, typeName: 'Passenger Car' },
      { typeId: 2, typeName: 'Truck' },
    ]);
  });

  it('should return an empty array when no vehicle types exist', () => {
    const result = service.normalizeVehicleTypes({
      Response: {
        Results: {},
      },
    });

    expect(result).toEqual([]);
  });
});
