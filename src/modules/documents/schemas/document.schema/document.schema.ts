import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false, versionKey: false })
export class VehicleTypeEmbedded {
  @Prop({ required: true, type: Number })
  typeId!: number;

  @Prop({ required: true, type: String })
  typeName!: string;
}

export const VehicleTypeEmbeddedSchema =
  SchemaFactory.createForClass(VehicleTypeEmbedded);

@Schema({
  collection: 'vehicle_makes',
  timestamps: true,
  versionKey: false,
})
export class VehicleMake {
  @Prop({ required: true, unique: true, type: Number })
  makeId!: number; //uniq

  @Prop({ required: true, type: String, trim: true })
  makeName!: string;

  @Prop({
    type: [VehicleTypeEmbeddedSchema],
    default: [],
  })
  vehicleTypes!: VehicleTypeEmbedded[];
}

export const VehicleMakeSchema = SchemaFactory.createForClass(VehicleMake);
