import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { VehicleMakeGraphql } from './graphql/document.type.js';
import { DocumentsService } from './documents.service.js';
import { BadRequestException } from '@nestjs/common';

@Resolver(() => VehicleMakeGraphql)
export class DocumentsResolver {
  constructor(private readonly documentsService: DocumentsService) {}

  @Query(() => [VehicleMakeGraphql], {
    name: 'vehicleMakes',
  })
  async vehicleMakes(
    @Args('offset', {
      type: () => Int,
      defaultValue: 0,
    })
    offset: number,

    @Args('limit', {
      type: () => Int,
      defaultValue: 100,
    })
    limit: number,
  ) {
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 500
    ) {
      throw new BadRequestException(
        'offset must be >= 0 and limit must be between 1 and 500',
      );
    }

    return this.documentsService.findMany(offset, limit);
  }

  @Query(() => VehicleMakeGraphql, {
    name: 'vehicleMake',
    nullable: true,
  })
  async vehicleMake(
    @Args('makeId', { type: () => Int })
    makeId: number,
  ) {
    return this.documentsService.findByMakeId(makeId);
  }
}
