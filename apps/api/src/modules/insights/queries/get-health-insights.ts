import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';

import { AlsService } from '@system/als/als.service';
import { AppPrismaService } from '@system/database/database.service';

import {
  GetHealthInsightsQueryDto,
  HealthInsightListDto,
} from '../dto/insights.dto';

// priority rank for the feed: high cards first, then by date desc
const PRIORITY_RANK: Record<string, number> = { high: 0, normal: 1, low: 2 };

export class GetHealthInsightsQuery extends Query<HealthInsightListDto> {
  constructor(public readonly dto: GetHealthInsightsQueryDto) {
    super();
  }
}

@QueryHandler(GetHealthInsightsQuery)
export class GetHealthInsightsQueryHandler implements IQueryHandler<GetHealthInsightsQuery> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute(query: GetHealthInsightsQuery) {
    const userId = this.alsService.ctx.get('userId');

    if (!userId) {
      throw new UnauthorizedException();
    }

    const rows = await this.appPrismaService.healthInsight.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: query.dto.limit,
    });

    const insights = rows
      .map((row) => ({
        id: row.id,
        date: row.date,
        category: row.category,
        priority: row.priority,
        title: row.title,
        body: row.body,
        detail: row.detail,
        createdAt: row.createdAt,
      }))
      .sort((a, b) => {
        const byDate = b.date.getTime() - a.date.getTime();

        if (byDate !== 0) {
          return byDate;
        }

        return (
          (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3)
        );
      });

    return { insights };
  }
}
