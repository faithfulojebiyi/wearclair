import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { classifyCycleDays } from '@feature/cycle-insights/classify';
import { generateHealthInsightDrafts } from '@feature/cycle-insights/ai-insights';
import { healthInsightSignature } from '@feature/cycle-insights/signature';
import { AppPrismaService } from '@system/database/database.service';
import { DeviceBatchSyncedDto } from '@system/queues/dto/device-batch-synced.dto';

import { InsightDailyStat, UpsertInsightsResult } from '../schema';

// generates the Insights feed for the latest derived day (AI-first, rule fallback)
// and upserts it. Idempotent per (userId, date, key) — re-running replaces the day's
// cards rather than duplicating. Runs after DailyInsight is derived in the same event.
export class ClassifyAndUpsertHealthInsightsCommand extends Command<UpsertInsightsResult> {
  constructor(
    public readonly event: DeviceBatchSyncedDto,
    public readonly stats: InsightDailyStat[],
  ) {
    super();
  }
}

@CommandHandler(ClassifyAndUpsertHealthInsightsCommand)
export class ClassifyAndUpsertHealthInsightsCommandHandler implements ICommandHandler<ClassifyAndUpsertHealthInsightsCommand> {
  constructor(private readonly appPrismaService: AppPrismaService) {}

  async execute(command: ClassifyAndUpsertHealthInsightsCommand) {
    const hydrated = command.stats.map((stat) => ({
      ...stat,
      day: new Date(stat.day),
    }));

    const days = classifyCycleDays(hydrated);

    if (days.length === 0) {
      return { upserted: 0 };
    }

    const today = days[days.length - 1];
    const signature = healthInsightSignature(days);

    // change-gate: signature is written only AFTER a successful card upsert, so a
    // stored match means the same numbers already have cards — skip Opus + writes.
    const existing = await this.appPrismaService.dailyInsight.findUnique({
      where: {
        userId_date: { userId: command.event.userId, date: today.date },
      },
      select: { insightSignature: true },
    });

    if (existing?.insightSignature === signature) {
      return { upserted: 0, skipped: true };
    }

    const drafts = await generateHealthInsightDrafts(days);

    for (const draft of drafts) {
      const data = {
        category: draft.category,
        priority: draft.priority,
        title: draft.title,
        body: draft.body,
        detail: draft.detail ?? null,
      };

      await this.appPrismaService.healthInsight.upsert({
        where: {
          userId_date_key: {
            userId: command.event.userId,
            date: today.date,
            key: draft.key,
          },
        },
        create: {
          userId: command.event.userId,
          date: today.date,
          key: draft.key,
          ...data,
        },
        update: data,
      });
    }

    // stamp the signature last — the row exists (compute-daily-insights created it
    // per batch, minutes before this debounced run).
    await this.appPrismaService.dailyInsight.update({
      where: {
        userId_date: { userId: command.event.userId, date: today.date },
      },
      data: { insightSignature: signature, insightsGeneratedAt: new Date() },
    });

    return { upserted: drafts.length };
  }
}
