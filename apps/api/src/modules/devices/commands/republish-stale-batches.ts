import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

import { AppPrismaService } from '@system/database/database.service';
import { EVENT_KEYS } from '@system/queues/events.config';
import { SYNC_BATCH_STATUS } from '@system/schema/sync-batch.schema';

import { EventPublisherService } from '../../event-publisher/event-publisher.service';

// stale = raw data is durable in the tsdb but the derivation event never made it
// to inngest (crash or publish failure after the raw write). republishing with
// the SAME deterministic event id (device-batch-<id>) is safe: inngest dedupes
// if the original send actually landed, and the worker's derivation is idempotent.
const STALE_AFTER_MS = 10 * 60 * 1000;
const MAX_PUBLISH_ATTEMPTS = 5;
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

    const stale = await primary.syncBatch.findMany({
      where: {
        status: SYNC_BATCH_STATUS.RAW_WRITTEN,
        rawWrittenAt: { lt: new Date(Date.now() - STALE_AFTER_MS) },
        publishAttempts: { lt: MAX_PUBLISH_ATTEMPTS },
      },
      orderBy: { rawWrittenAt: 'asc' },
      take: SWEEP_LIMIT,
    });

    // batches over the attempt cap are no longer retried automatically — surface
    // them loudly every sweep instead of abandoning them silently. they stay
    // RAW_WRITTEN and queryable for manual republish / a raised cap.
    const exhausted = await primary.syncBatch.count({
      where: {
        status: SYNC_BATCH_STATUS.RAW_WRITTEN,
        publishAttempts: { gte: MAX_PUBLISH_ATTEMPTS },
      },
    });

    if (exhausted > 0) {
      this.logger.error(
        { exhausted, maxAttempts: MAX_PUBLISH_ATTEMPTS },
        'RAW_WRITTEN batches exhausted publish attempts — manual intervention required',
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
          },
        });

        republished += 1;
      } catch (error) {
        await this.appPrismaService.syncBatch.updateMany({
          where: { id: batch.id },
          data: { publishAttempts: { increment: 1 } },
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
