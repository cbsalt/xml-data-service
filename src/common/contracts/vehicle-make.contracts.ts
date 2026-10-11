export interface VehicleMakeIdentity {
  makeId: number;
  makeName: string;
}

export interface VehicleTypeData {
  typeId: number;
  typeName: string;
}

export interface VehicleMakeData extends VehicleMakeIdentity {
  vehicleTypes: VehicleTypeData[];
}
