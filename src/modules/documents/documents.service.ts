import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VehicleMake } from './schemas/document.schema/document.schema.js';
import { VehicleMakeData } from '../../common/contracts/vehicle-make.contracts.js';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(VehicleMake.name)
    private readonly vehicleMakeModel: Model<VehicleMake>,
  ) {}

  async upsertMany(makes: VehicleMakeData[]): Promise<void> {
    if (makes.length === 0) {
      return;
    }

    await this.vehicleMakeModel.bulkWrite(
      makes.map((make) => ({
        updateOne: {
          filter: { makeId: make.makeId },
          update: {
            $set: {
              makeName: make.makeName,
              vehicleTypes: make.vehicleTypes,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  async findMany(offset = 0, limit = 100): Promise<VehicleMakeData[]> {
    const documents = await this.vehicleMakeModel
      .find(
        {},
        {
          _id: 0,
          makeId: 1,
          makeName: 1,
          vehicleTypes: 1,
        },
      )
      .sort({ makeId: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();

    return documents.map((document) => ({
      makeId: document.makeId,
      makeName: document.makeName,
      vehicleTypes: document.vehicleTypes.map((type) => ({
        typeId: type.typeId,
        typeName: type.typeName,
      })),
    }));
  }

  async findByMakeId(makeId: number): Promise<VehicleMakeData | null> {
    const document = await this.vehicleMakeModel
      .findOne(
        { makeId },
        {
          _id: 0,
          makeId: 1,
          makeName: 1,
          vehicleTypes: 1,
        },
      )
      .lean()
      .exec();

    if (!document) {
      return null;
    }

    return {
      makeId: document.makeId,
      makeName: document.makeName,
      vehicleTypes: document.vehicleTypes.map((type) => ({
        typeId: type.typeId,
        typeName: type.typeName,
      })),
    };
  }
}
