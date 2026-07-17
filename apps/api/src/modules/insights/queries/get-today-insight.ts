import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';

import { DailyInsight } from '@orm/app';

import { AlsService } from '@system/als/als.service';
import { AppPrismaService } from '@system/database/database.service';

import { DailyInsightDto } from '../dto/insights.dto';

export const toInsightPayload = (insight: DailyInsight) => ({
  date: insight.date,
  cycleDay: insight.cycleDay,
  phase: insight.phase,
  basalTempC: insight.basalTempC,
  restingHrBpm: insight.restingHrBpm,
  hrvRmssdMs: insight.hrvRmssdMs,
  readiness: insight.readiness,
  sourceFrom: insight.sourceFrom,
  sourceTo: insight.sourceTo,
  sourceSampleCount: insight.sourceSampleCount,
});

export class GetTodayInsightQuery extends Query<DailyInsightDto> {
  constructor() {
    super();
  }
}

@QueryHandler(GetTodayInsightQuery)
export class GetTodayInsightQueryHandler implements IQueryHandler<GetTodayInsightQuery> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute() {
    const userId = this.alsService.ctx.get('userId');

    if (!userId) {
      throw new UnauthorizedException();
    }

    // "today" = the most recent derived day (the latest sync may not cover today yet)
    const insight = await this.appPrismaService.dailyInsight.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
    });

    if (!insight) {
      throw new NotFoundException('no insights yet — sync a device first');
    }

    return toInsightPayload(insight);
  }
}
