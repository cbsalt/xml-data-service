import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class VehicleTypeGraphql {
  @Field(() => Int)
  typeId!: number;

  @Field()
  typeName!: string;
}

@ObjectType()
export class VehicleMakeGraphql {
  @Field(() => Int)
  makeId!: number;

  @Field()
  makeName!: string;

  @Field(() => [VehicleTypeGraphql])
  vehicleTypes!: VehicleTypeGraphql[];
}
