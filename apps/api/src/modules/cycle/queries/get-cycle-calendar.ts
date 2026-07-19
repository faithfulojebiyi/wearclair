import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';

import { toCyclePhase } from '@feature/cycle-insights/phase';
import { AlsService } from '@system/als/als.service';
import { AppPrismaService } from '@system/database/database.service';

import {
  CalendarDayState,
  DAY_MS,
  DEFAULT_CYCLE_LENGTH,
  PERIOD_EXCLUDED,
  buildPeriodModel,
  dayKey,
  deriveCalendarDay,
  todayKeyIn,
} from '../cycle-model';
import { CycleCalendarDto, GetCycleCalendarQueryDto } from '../dto/cycle.dto';

// per-day calendar state, derived (not stored): real DailyInsight for past days,
// the user's period model for the future. Logged period days are authoritative.
// `fresh` routes reads to the primary — commands that write then return this
// query's result must not see a lagging replica. GETs stay replica-eligible.
export class GetCycleCalendarQuery extends Query<CycleCalendarDto> {
  constructor(
    public readonly dto: GetCycleCalendarQueryDto,
    public readonly fresh = false,
  ) {
    super();
  }
}

@QueryHandler(GetCycleCalendarQuery)
export class GetCycleCalendarQueryHandler implements IQueryHandler<GetCycleCalendarQuery> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute(query: GetCycleCalendarQuery) {
    const userId = this.alsService.ctx.get('userId');

    if (!userId) {
      throw new UnauthorizedException();
    }

    const from = new Date(query.dto.from);
    const to = new Date(query.dto.to);

    const db = query.fresh
      ? this.appPrismaService.$primary()
      : this.appPrismaService;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const insights = await db.dailyInsight.findMany({
      where: { userId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });

    const latest = await db.dailyInsight.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
    });

    // ALL period logs — needed to derive cycle length + anchor, not just in-range
    const periodLogs = await db.cycleLog.findMany({
      where: { userId, type: 'period' },
      select: { date: true, value: true },
    });

    // tombstones are user "not a period day" overrides, never model input
    const logged = periodLogs.filter((l) => l.value !== PERIOD_EXCLUDED);

    const model = buildPeriodModel(logged.map((l) => l.date));

    const byDate = new Map(insights.map((i) => [dayKey(i.date), i]));
    const periodDays = new Set(logged.map((l) => dayKey(l.date)));
    const excludedDays = new Set(
      periodLogs
        .filter((l) => l.value === PERIOD_EXCLUDED)
        .map((l) => dayKey(l.date)),
    );

    // the user's local today (device-synced tz), not the server's UTC day
    const todayKey = todayKeyIn(user?.timezone);

    // fallback projection (no period logs) from the latest known insight
    const fallbackCycleDay = (date: Date): number | null => {
      if (!latest) {
        return null;
      }

      const offset = Math.round(
        (date.getTime() - latest.date.getTime()) / DAY_MS,
      );

      return (
        ((((latest.cycleDay - 1 + offset) % DEFAULT_CYCLE_LENGTH) +
          DEFAULT_CYCLE_LENGTH) %
          DEFAULT_CYCLE_LENGTH) +
        1
      );
    };

    const days: (CalendarDayState & { date: Date })[] = [];
    const totalDays = Math.round((to.getTime() - from.getTime()) / DAY_MS);

    for (let i = 0; i <= totalDays; i += 1) {
      const date = new Date(from.getTime() + i * DAY_MS);
      const key = dayKey(date);
      const insight = byDate.get(key);

      const state = deriveCalendarDay({
        date,
        todayKey,
        insight: insight
          ? { cycleDay: insight.cycleDay, phase: toCyclePhase(insight.phase) }
          : null,
        isLoggedPeriod: periodDays.has(key),
        isExcludedPeriod: excludedDays.has(key),
        model,
        fallbackCycleDay: fallbackCycleDay(date),
      });

      days.push({ date, ...state });
    }

    return { days };
  }
}
