import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';

import { AlsService } from '@system/als/als.service';
import { BiomarkerStore } from '@system/timeseries/biomarker.store';

import { GetSeriesQueryDto, SeriesDto } from '../dto/biomarkers.dto';

export class GetSeriesQuery extends Query<SeriesDto> {
  constructor(public readonly dto: GetSeriesQueryDto) {
    super();
  }
}

@QueryHandler(GetSeriesQuery)
export class GetSeriesQueryHandler implements IQueryHandler<GetSeriesQuery> {
  constructor(
    private readonly biomarkerStore: BiomarkerStore,
    private readonly alsService: AlsService,
  ) {}

  async execute(query: GetSeriesQuery) {
    const userId = this.alsService.ctx.get('userId');

    if (!userId) {
      throw new UnauthorizedException();
    }

    const { metric, bucket, from, to } = query.dto;

    const points = await this.biomarkerStore.querySeries({
      userId,
      metric,
      bucket,
      from: new Date(from),
      to: new Date(to),
    });

    return {
      metric,
      bucket,
      points: points.map((point) => ({
        ts: point.bucket,
        avg: point.avg,
        min: point.min,
        max: point.max,
        count: point.count,
      })),
    };
  }
}
