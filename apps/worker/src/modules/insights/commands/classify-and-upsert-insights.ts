import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { classifyCycleDays } from '@feature/cycle-insights/classify';
import { AppPrismaService } from '@system/database/database.service';
import { DeviceBatchSyncedDto } from '@system/queues/dto/device-batch-synced.dto';

import { InsightDailyStat, UpsertInsightsResult } from '../schema';

const DAY_MS = 24 * 60 * 60 * 1000;

// re-derives the whole loaded window, not just the synced days — late-arriving data
// reshapes past phases, and upserting on (userId, date) makes that healing
// idempotent. Lineage columns record each row's own raw day window by value (no
// cross-db FK exists between the app db and the tsdb).
export class ClassifyAndUpsertInsightsCommand extends Command<UpsertInsightsResult> {
  constructor(
    public readonly event: DeviceBatchSyncedDto,
    public readonly stats: InsightDailyStat[],
  ) {
    super();
  }
}

@CommandHandler(ClassifyAndUpsertInsightsCommand)
export class ClassifyAndUpsertInsightsCommandHandler implements ICommandHandler<ClassifyAndUpsertInsightsCommand> {
  constructor(private readonly appPrismaService: AppPrismaService) {}

  async execute(command: ClassifyAndUpsertInsightsCommand) {
    const hydrated = command.stats.map((stat) => ({
      ...stat,
      day: new Date(stat.day),
    }));

    const insights = classifyCycleDays(hydrated);

    const samplesPerDay = new Map<number, number>();

    for (const stat of hydrated) {
      const key = stat.day.getTime();
      samplesPerDay.set(key, (samplesPerDay.get(key) ?? 0) + stat.count);
    }

    for (const insight of insights) {
      const dayStart = insight.date;
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);

      const data = {
        cycleDay: insight.cycleDay,
        phase: insight.phase,
        basalTempC: insight.basalTempC,
        restingHrBpm: insight.restingHrBpm,
        hrvRmssdMs: insight.hrvRmssdMs,
        readiness: insight.readiness,
        estradiolPgMl: insight.hormones.estradiolPgMl,
        progesteroneNgMl: insight.hormones.progesteroneNgMl,
        lhMiuMl: insight.hormones.lhMiuMl,
        fshMiuMl: insight.hormones.fshMiuMl,
        sourceFrom: dayStart,
        sourceTo: dayEnd,
        sourceSampleCount: samplesPerDay.get(dayStart.getTime()) ?? 0,
      };

      await this.appPrismaService.dailyInsight.upsert({
        where: {
          userId_date: { userId: command.event.userId, date: insight.date },
        },
        create: {
          userId: command.event.userId,
          date: insight.date,
          ...data,
        },
        update: data,
      });
    }

    return { upserted: insights.length };
  }
}
