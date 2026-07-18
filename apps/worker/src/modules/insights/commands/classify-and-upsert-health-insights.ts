import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { classifyCycleDays } from '@feature/cycle-insights/classify';
import { generateHealthInsightDrafts } from '@feature/cycle-insights/ai-insights';
import { healthInsightSignature } from '@feature/cycle-insights/signature';
import { AppPrismaService } from '@system/database/database.service';
import { DeviceBatchSyncedDto } from '@system/queues/dto/device-batch-synced.dto';

import { InsightDailyStat, UpsertInsightsResult } from '../schema';

// generates the Insights feed for the latest derived day (AI-first, rule fallback)
// and REPLACES the day's card set: keys not regenerated are deleted, the rest
// upserted — so stale cards (recovery flipped, AI key drift) never sit next to the
// new guidance. Runs after DailyInsight is derived in the same event.
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

    // defensive: generation always yields at least one card (AI schema min 1,
    // rule fallback); an unexpectedly empty set must not wipe the day's feed
    if (drafts.length === 0) {
      return { upserted: 0 };
    }

    // REPLACE the day's card set, don't just add to it: cards whose key was not
    // regenerated are obsolete (recovery flipped, AI key drift) and would sit
    // next to the new set as contradictory guidance. One transaction so a
    // mid-write failure can't leave the day half-replaced, and the signature
    // stamp only lands together with its cards.
    await this.appPrismaService.$transaction(async (tx) => {
      await tx.healthInsight.deleteMany({
        where: {
          userId: command.event.userId,
          date: today.date,
          key: { notIn: drafts.map((draft) => draft.key) },
        },
      });

      for (const draft of drafts) {
        const data = {
          category: draft.category,
          priority: draft.priority,
          title: draft.title,
          body: draft.body,
          detail: draft.detail ?? null,
        };

        await tx.healthInsight.upsert({
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

      // the row exists (compute-daily-insights created it per batch, minutes
      // before this debounced run)
      await tx.dailyInsight.update({
        where: {
          userId_date: { userId: command.event.userId, date: today.date },
        },
        data: { insightSignature: signature, insightsGeneratedAt: new Date() },
      });
    });

    return { upserted: drafts.length };
  }
}
