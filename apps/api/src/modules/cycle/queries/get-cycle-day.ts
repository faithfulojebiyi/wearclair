import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';

import { toCyclePhase } from '@feature/cycle-insights/phase';
import { AlsService } from '@system/als/als.service';
import { AppPrismaService } from '@system/database/database.service';

import {
  DAY_MS,
  DEFAULT_CYCLE_LENGTH,
  PERIOD_EXCLUDED,
  buildPeriodModel,
  deriveCalendarDay,
  fertilityChance,
  startOfDay,
  todayKeyIn,
} from '../cycle-model';
import { CycleDaySummaryDto, GetCycleDayQueryDto } from '../dto/cycle.dto';

// one day's derived state + every log for that day. drives the Track screen prefill
// and the calendar's selected-day card. same derivation as the calendar grid.
// `fresh` routes reads to the primary — commands that write then return this
// query's result must not see a lagging replica. GETs stay replica-eligible.
export class GetCycleDayQuery extends Query<CycleDaySummaryDto> {
  constructor(
    public readonly dto: GetCycleDayQueryDto,
    public readonly fresh = false,
  ) {
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

    const db = query.fresh
      ? this.appPrismaService.$primary()
      : this.appPrismaService;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const insight = await db.dailyInsight.findFirst({
      where: { userId, date: day },
    });

    const latest = await db.dailyInsight.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
    });

    const periodLogs = await db.cycleLog.findMany({
      where: { userId, type: 'period', value: { not: PERIOD_EXCLUDED } },
      select: { date: true },
    });

    const allLogs = await db.cycleLog.findMany({
      where: { userId, date: day },
      orderBy: { type: 'asc' },
    });

    // tombstones drive derivation but are not user-visible logs
    const logs = allLogs.filter(
      (l) => !(l.type === 'period' && l.value === PERIOD_EXCLUDED),
    );

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
      todayKey: todayKeyIn(user?.timezone),
      insight: insight
        ? { cycleDay: insight.cycleDay, phase: toCyclePhase(insight.phase) }
        : null,
      isLoggedPeriod: logs.some((l) => l.type === 'period'),
      isExcludedPeriod: allLogs.some(
        (l) => l.type === 'period' && l.value === PERIOD_EXCLUDED,
      ),
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
