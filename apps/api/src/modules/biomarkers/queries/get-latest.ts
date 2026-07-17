import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';

import { AlsService } from '@system/als/als.service';
import { BiomarkerStore } from '@system/timeseries/biomarker.store';

import { LatestReadingsDto } from '../dto/biomarkers.dto';

export class GetLatestQuery extends Query<LatestReadingsDto> {
  constructor() {
    super();
  }
}

@QueryHandler(GetLatestQuery)
export class GetLatestQueryHandler implements IQueryHandler<GetLatestQuery> {
  constructor(
    private readonly biomarkerStore: BiomarkerStore,
    private readonly alsService: AlsService,
  ) {}

  async execute() {
    const userId = this.alsService.ctx.get('userId');

    if (!userId) {
      throw new UnauthorizedException();
    }

    const readings = await this.biomarkerStore.latest(userId);

    return { readings };
  }
}
