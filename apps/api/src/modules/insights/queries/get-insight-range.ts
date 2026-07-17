import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';

import { AlsService } from '@system/als/als.service';
import { AppPrismaService } from '@system/database/database.service';

import {
  DailyInsightListDto,
  GetInsightRangeQueryDto,
} from '../dto/insights.dto';
import { toInsightPayload } from './get-today-insight';

export class GetInsightRangeQuery extends Query<DailyInsightListDto> {
  constructor(public readonly dto: GetInsightRangeQueryDto) {
    super();
  }
}

@QueryHandler(GetInsightRangeQuery)
export class GetInsightRangeQueryHandler implements IQueryHandler<GetInsightRangeQuery> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute(query: GetInsightRangeQuery) {
    const userId = this.alsService.ctx.get('userId');

    if (!userId) {
      throw new UnauthorizedException();
    }

    const insights = await this.appPrismaService.dailyInsight.findMany({
      where: {
        userId,
        date: {
          gte: new Date(query.dto.from),
          lt: new Date(query.dto.to),
        },
      },
      orderBy: { date: 'asc' },
    });

    return { insights: insights.map(toInsightPayload) };
  }
}
