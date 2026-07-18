import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

import { AppPrismaService } from '@system/database/database.service';
import { EVENT_KEYS } from '@system/queues/events.config';
import { SYNC_BATCH_STATUS } from '@system/schema/sync-batch.schema';

import { nextPublishAttemptAt, STALE_AFTER_MS } from '../publish-backoff';
import { EventPublisherService } from '../../event-publisher/event-publisher.service';

/**
 * Recovery sweep for RAW_WRITTEN batches whose derivation event never reached
 * inngest. Safe to republish (same deterministic event id + idempotent worker).
 * Retries never stop — each failed attempt persists the next due time
 * (exponential backoff, see publish-backoff.ts), so the sweep queries due-ness
 * directly and not-yet-due rows can't crowd due ones out of the page.
 */
const ALERT_AFTER_ATTEMPTS = 5;
const SWEEP_LIMIT = 100;

export class RepublishStaleBatchesCommand extends Command<{
  republished: number;
}> {
  constructor() {
    super();
  }
}

@CommandHandler(RepublishStaleBatchesCommand)
export class RepublishStaleBatchesCommandHandler implements ICommandHandler<RepublishStaleBatchesCommand> {
  private readonly logger = new Logger(
    RepublishStaleBatchesCommandHandler.name,
  );

  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly eventPublisherService: EventPublisherService,
  ) {}

  async execute(_command: RepublishStaleBatchesCommand) {
    // $primary(): the sweep must see the latest lifecycle state, not a lagging replica
    const primary = this.appPrismaService.$primary();

    const now = new Date();

    // due-ness is persisted (nextPublishAttemptAt), so the query returns exactly
    // the due rows — a backlog of not-yet-due high-attempt rows can't starve
    // newer due ones. null schedule = rows from before the column existed; they
    // fall back to the base staleness window.
    const stale = await primary.syncBatch.findMany({
      where: {
        status: SYNC_BATCH_STATUS.RAW_WRITTEN,
        OR: [
          { nextPublishAttemptAt: { lte: now } },
          {
            nextPublishAttemptAt: null,
            rawWrittenAt: { lt: new Date(now.getTime() - STALE_AFTER_MS) },
          },
        ],
      },
      orderBy: { nextPublishAttemptAt: { sort: 'asc', nulls: 'first' } },
      take: SWEEP_LIMIT,
    });

    // long-failing batches keep retrying (backoff), but past the alert threshold
    // they're surfaced loudly every sweep — even between their due times — so a
    // persistent publish problem is visible in ops, not just eventually self-healed.
    const struggling = await primary.syncBatch.count({
      where: {
        status: SYNC_BATCH_STATUS.RAW_WRITTEN,
        publishAttempts: { gte: ALERT_AFTER_ATTEMPTS },
      },
    });

    if (struggling > 0) {
      this.logger.error(
        { struggling, alertAfterAttempts: ALERT_AFTER_ATTEMPTS },
        'RAW_WRITTEN batches still unpublished after repeated attempts — investigate the publish path',
      );
    }

    let republished = 0;

    for (const batch of stale) {
      try {
        await this.eventPublisherService.sendEvent({
          id: `device-batch-${batch.id}`,
          name: EVENT_KEYS.DEVICE_BATCH_SYNCED,
          data: {
            batchId: batch.id,
            deviceId: batch.deviceId,
            userId: batch.userId,
            windowStart: batch.windowStart.toISOString(),
            windowEnd: batch.windowEnd.toISOString(),
            sampleCount: batch.sampleCount,
          },
          user: { userId: batch.userId },
        });

        await this.appPrismaService.syncBatch.updateMany({
          where: { id: batch.id, status: SYNC_BATCH_STATUS.RAW_WRITTEN },
          data: {
            status: SYNC_BATCH_STATUS.PUBLISHED,
            publishedAt: new Date(),
            publishAttempts: { increment: 1 },
            nextPublishAttemptAt: null,
          },
        });

        republished += 1;
      } catch (error) {
        await this.appPrismaService.syncBatch.updateMany({
          where: { id: batch.id },
          data: {
            publishAttempts: { increment: 1 },
            nextPublishAttemptAt: nextPublishAttemptAt(
              batch.publishAttempts + 1,
            ),
          },
        });

        this.logger.warn(
          { batchId: batch.id, err: error },
          'stale batch republish failed — will retry next sweep',
        );
      }
    }

    if (stale.length) {
      this.logger.log(
        { found: stale.length, republished },
        'stale RAW_WRITTEN batch sweep',
      );
    }

    return { republished };
  }
}
