import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';

import { AlsService } from '@system/als/als.service';
import { AppPrismaService } from '@system/database/database.service';

import { DAY_MS, dayKey } from '../cycle-model';
import { CycleTimelineDto } from '../dto/cycle.dto';

// human labels for each log category shown in the timeline
const LOG_LABELS: Record<string, string> = {
  flow: 'Flow',
  symptom: 'Symptoms',
  mood: 'Mood',
  sex: 'Sex life',
  cervical_mucus: 'Cervical mucus',
  cervix_position: 'Cervix position',
  cervix_status: 'Cervix status',
  cervix_texture: 'Cervix texture',
  ovulation_test: 'Ovulation test',
  pregnancy_test: 'Pregnancy test',
  breast_exam: 'Breast self-exam',
  medicine: 'Medicine',
  energy: 'Energy',
  diary: 'Diary',
  tag: 'Tags',
};

interface Entry {
  id: string;
  date: Date;
  kind: string;
  label: string;
  detail: string | null;
}

// the Timeline list: period start/end markers (derived from the user's logged period
// runs) plus every other log the user recorded, newest first.
export class GetCycleTimelineQuery extends Query<CycleTimelineDto> {
  constructor() {
    super();
  }
}

@QueryHandler(GetCycleTimelineQuery)
export class GetCycleTimelineQueryHandler implements IQueryHandler<GetCycleTimelineQuery> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute() {
    const userId = this.alsService.ctx.get('userId');

    if (!userId) {
      throw new UnauthorizedException();
    }

    const logs = await this.appPrismaService.cycleLog.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });

    const entries: Entry[] = [];

    // group logged period days into contiguous runs → start/end markers
    const periodDays = [
      ...new Set(
        logs.filter((l) => l.type === 'period').map((l) => dayKey(l.date)),
      ),
    ].sort();

    const runs: string[][] = [];

    for (const key of periodDays) {
      const last = runs[runs.length - 1];
      const prevKey = last?.[last.length - 1];
      const contiguous =
        prevKey !== undefined &&
        Math.round(
          (new Date(key).getTime() - new Date(prevKey).getTime()) / DAY_MS,
        ) === 1;

      if (contiguous) {
        last.push(key);
      } else {
        runs.push([key]);
      }
    }

    for (const run of runs) {
      const start = new Date(run[0]);
      const end = new Date(run[run.length - 1]);

      entries.push({
        id: `period-start-${run[0]}`,
        date: start,
        kind: 'period_start',
        label: 'Period Starts',
        detail: run.length > 1 ? `${run.length} days` : null,
      });

      if (run.length > 1) {
        entries.push({
          id: `period-end-${run[run.length - 1]}`,
          date: end,
          kind: 'period_end',
          label: 'Period Ends',
          detail: null,
        });
      }
    }

    // every other logged category
    for (const log of logs) {
      if (log.type === 'period') {
        continue;
      }

      entries.push({
        id: log.id,
        date: log.date,
        kind: log.type,
        label: LOG_LABELS[log.type] ?? log.type,
        detail: log.value,
      });
    }

    entries.sort((a, b) => b.date.getTime() - a.date.getTime());

    return { entries: entries.slice(0, 60) };
  }
}
