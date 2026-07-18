import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';

import { toCyclePhase } from '@feature/cycle-insights/phase';
import { AlsService } from '@system/als/als.service';
import { AppPrismaService } from '@system/database/database.service';

import {
  DAY_MS,
  DEFAULT_CYCLE_LENGTH,
  buildPeriodModel,
  dayKey,
  deriveCalendarDay,
  fertilityChance,
  startOfDay,
} from '../cycle-model';
import { CycleDaySummaryDto, GetCycleDayQueryDto } from '../dto/cycle.dto';

// one day's derived state + every log for that day. drives the Track screen prefill
// and the calendar's selected-day card. same derivation as the calendar grid.
export class GetCycleDayQuery extends Query<CycleDaySummaryDto> {
  constructor(public readonly dto: GetCycleDayQueryDto) {
    super();
  }
}

@QueryHandler(GetCycleDayQuery)
export class GetCycleDayQueryHandler implements IQueryHandler<GetCycleDayQuery> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute(query: GetCycleDayQuery) {
    const userId = this.alsService.ctx.get('userId');

    if (!userId) {
      throw new UnauthorizedException();
    }

    const day = startOfDay(new Date(query.dto.date));

    const insight = await this.appPrismaService.dailyInsight.findFirst({
      where: { userId, date: day },
    });

    const latest = await this.appPrismaService.dailyInsight.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
    });

    const periodLogs = await this.appPrismaService.cycleLog.findMany({
      where: { userId, type: 'period' },
      select: { date: true },
    });

    const logs = await this.appPrismaService.cycleLog.findMany({
      where: { userId, date: day },
      orderBy: { type: 'asc' },
    });

    const model = buildPeriodModel(periodLogs.map((l) => l.date));

    const fallbackCycleDay = latest
      ? ((((latest.cycleDay -
          1 +
          Math.round((day.getTime() - latest.date.getTime()) / DAY_MS)) %
          DEFAULT_CYCLE_LENGTH) +
          DEFAULT_CYCLE_LENGTH) %
          DEFAULT_CYCLE_LENGTH) +
        1
      : null;

    const state = deriveCalendarDay({
      date: day,
      todayKey: dayKey(new Date()),
      insight: insight
        ? { cycleDay: insight.cycleDay, phase: toCyclePhase(insight.phase) }
        : null,
      isLoggedPeriod: logs.some((l) => l.type === 'period'),
      model,
      fallbackCycleDay,
    });

    return {
      date: day,
      ...state,
      fertilityChance: fertilityChance(state),
      logs: logs.map((log) => ({
        id: log.id,
        type: log.type,
        value: log.value,
        note: log.note,
        date: log.date,
        loggedAt: log.loggedAt,
      })),
    };
  }
}
