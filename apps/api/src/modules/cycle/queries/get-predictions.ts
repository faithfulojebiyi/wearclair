import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';

import { toCyclePhase } from '@feature/cycle-insights/phase';
import { AlsService } from '@system/als/als.service';
import { AppPrismaService } from '@system/database/database.service';

import {
  DAY_MS,
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  FERTILE_END,
  FERTILE_START,
  OVULATION_DAY,
  PERIOD_EXCLUDED,
  buildPeriodModel,
  phaseForDay,
  projectCycleDay,
  startOfDay,
  todayKeyIn,
} from '../cycle-model';
import { CyclePredictionsDto } from '../dto/cycle.dto';

// next calendar date on which the cycle reaches `targetDay`, anchored on a known
// (date, cycleDay) pair. delta 0 rolls forward a full cycle (so "next period" from
// day 1 is the following cycle, not today).
const nextDateForDay = (
  anchorDate: Date,
  anchorDay: number,
  targetDay: number,
  cycleLength: number,
  rollForwardOnZero: boolean,
): { date: Date; inDays: number } => {
  let delta =
    (((targetDay - anchorDay) % cycleLength) + cycleLength) % cycleLength;

  if (delta === 0 && rollForwardOnZero) {
    delta = cycleLength;
  }

  return {
    date: new Date(anchorDate.getTime() + delta * DAY_MS),
    inDays: delta,
  };
};

export class GetPredictionsQuery extends Query<CyclePredictionsDto> {
  constructor() {
    super();
  }
}

@QueryHandler(GetPredictionsQuery)
export class GetPredictionsQueryHandler implements IQueryHandler<GetPredictionsQuery> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute() {
    const userId = this.alsService.ctx.get('userId');

    if (!userId) {
      throw new UnauthorizedException();
    }

    const periodLogs = await this.appPrismaService.cycleLog.findMany({
      // tombstones (user unmarked the day) are never model input
      where: { userId, type: 'period', value: { not: PERIOD_EXCLUDED } },
      select: { date: true },
    });

    const user = await this.appPrismaService.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    // predictions anchor on the user's local today, not the server's UTC day
    const today = new Date(todayKeyIn(user?.timezone));

    const model = buildPeriodModel(periodLogs.map((l) => l.date));

    // user period is authoritative — anchor everything on the derived model so an
    // edit-period save immediately shifts every prediction.
    if (model) {
      const cycleDay = projectCycleDay(model, today);
      const length = model.length;
      const ovDay = model.ovulationDay;
      const fertileStartDay = Math.max(1, ovDay - 5);

      const fertileStart = nextDateForDay(
        today,
        cycleDay,
        fertileStartDay,
        length,
        false,
      );
      const fertileEnd = nextDateForDay(today, cycleDay, ovDay, length, false);
      const active = cycleDay >= fertileStartDay && cycleDay <= ovDay;

      return {
        cycleDay,
        phase: phaseForDay(model, cycleDay),
        ovulation: nextDateForDay(today, cycleDay, ovDay, length, false),
        nextPeriod: nextDateForDay(today, cycleDay, 1, length, true),
        fertileWindow: {
          start: active ? today : fertileStart.date,
          end: fertileEnd.date,
          active,
        },
      };
    }

    /**
     * fallback: no period logs — project the latest insight forward to TODAY;
     * a stale anchor lets "next period" land in the past.
     */
    const insight = await this.appPrismaService.dailyInsight.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
    });

    if (!insight) {
      throw new NotFoundException('no insights yet — sync a device first');
    }

    const offset = Math.round(
      (today.getTime() - startOfDay(insight.date).getTime()) / DAY_MS,
    );
    const day =
      ((((insight.cycleDay - 1 + offset) % DEFAULT_CYCLE_LENGTH) +
        DEFAULT_CYCLE_LENGTH) %
        DEFAULT_CYCLE_LENGTH) +
      1;

    // keep the richer worker phase only while the insight is today's
    const phase =
      offset === 0
        ? toCyclePhase(insight.phase)
        : phaseForDay(
            {
              anchor: today,
              length: DEFAULT_CYCLE_LENGTH,
              periodLength: DEFAULT_PERIOD_LENGTH,
              ovulationDay: OVULATION_DAY,
            },
            day,
          );

    const fertileStart = nextDateForDay(
      today,
      day,
      FERTILE_START,
      DEFAULT_CYCLE_LENGTH,
      false,
    );
    const fertileEnd = nextDateForDay(
      today,
      day,
      FERTILE_END,
      DEFAULT_CYCLE_LENGTH,
      false,
    );
    const active = day >= FERTILE_START && day <= FERTILE_END;

    return {
      cycleDay: day,
      phase,
      ovulation: nextDateForDay(
        today,
        day,
        OVULATION_DAY,
        DEFAULT_CYCLE_LENGTH,
        false,
      ),
      nextPeriod: nextDateForDay(today, day, 1, DEFAULT_CYCLE_LENGTH, true),
      fertileWindow: {
        start: active ? today : fertileStart.date,
        end: fertileEnd.date,
        active,
      },
    };
  }
}
