import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

import { AppPrismaService } from '@system/database/database.service';
import { EVENT_KEYS } from '@system/queues/events.config';
import { SYNC_BATCH_STATUS } from '@system/schema/sync-batch.schema';
import { BiomarkerStore } from '@system/timeseries/biomarker.store';

import { nextPublishAttemptAt, STALE_AFTER_MS } from '../publish-backoff';
import { EventPublisherService } from '../../event-publisher/event-publisher.service';

/**
 * recovery sweep: republish due RAW_WRITTEN batches (persisted backoff, no
 * starvation), resolve RECEIVED strays against the tsdb (promote or FAILED),
 * and demote dead-lettered PUBLISHED batches back to RAW_WRITTEN.
 */
const ALERT_AFTER_ATTEMPTS = 5;
const SWEEP_LIMIT = 100;

/**
 * PUBLISHED with no PROCESSED after this long = the worker dead-lettered. 24h
 * clears inngest's event-id dedup window so the republish mints a fresh run.
 */
export const PUBLISHED_STUCK_AFTER_MS = 24 * 60 * 60 * 1000;

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
    private readonly biomarkerStore: BiomarkerStore,
  ) {}

  async execute(_command: RepublishStaleBatchesCommand) {
    // $primary(): the sweep must see the latest lifecycle state, not a lagging replica
    const primary = this.appPrismaService.$primary();

    const now = new Date();

    /**
     * PUBLISHED strays: the worker dead-lettered and nothing else revisits
     * PUBLISHED — demote to RAW_WRITTEN, due now, so the republish leg below
     * resends this sweep (processing is idempotent).
     */
    const demoted = await this.appPrismaService.syncBatch.updateMany({
      where: {
        status: SYNC_BATCH_STATUS.PUBLISHED,
        publishedAt: {
          lt: new Date(now.getTime() - PUBLISHED_STUCK_AFTER_MS),
        },
      },
      data: {
        status: SYNC_BATCH_STATUS.RAW_WRITTEN,
        nextPublishAttemptAt: now,
      },
    });

    if (demoted.count > 0) {
      this.logger.warn(
        { demoted: demoted.count },
        'PUBLISHED batches never reached PROCESSED — worker dead-lettered; demoted for republish',
      );
    }

    // null schedule = legacy rows, due by base staleness
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

    // long-failing batches are alerted every sweep, not just silently retried
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

    /**
     * RECEIVED strays: reconcile the ledger against what actually landed in the
     * tsdb. status-guarded updates keep a racing slow ingest safe.
     */
    const stranded = await primary.syncBatch.findMany({
      where: {
        status: SYNC_BATCH_STATUS.RECEIVED,
        createdAt: { lt: new Date(now.getTime() - STALE_AFTER_MS) },
      },
      orderBy: { createdAt: 'asc' },
      take: SWEEP_LIMIT,
    });

    const promoted: typeof stale = [];

    for (const batch of stranded) {
      // batch-attributed — overlapping older rows must not fake a committed write
      const durable = await this.biomarkerStore.countBatchRows({
        userId: batch.userId,
        deviceId: batch.deviceId,
        batchId: batch.id,
        from: batch.windowStart,
        to: batch.windowEnd,
      });

      if (durable > 0) {
        // raw write committed before the crash — resume and publish this sweep
        const result = await this.appPrismaService.syncBatch.updateMany({
          where: { id: batch.id, status: SYNC_BATCH_STATUS.RECEIVED },
          data: {
            status: SYNC_BATCH_STATUS.RAW_WRITTEN,
            rawWrittenAt: now,
            nextPublishAttemptAt: now,
            sampleCount: durable,
          },
        });

        if (result.count === 1) {
          promoted.push({ ...batch, sampleCount: durable });
        }
      } else {
        // nothing landed — FAILED, revivable by a clientBatchId retry
        await this.appPrismaService.syncBatch.updateMany({
          where: { id: batch.id, status: SYNC_BATCH_STATUS.RECEIVED },
          data: { status: SYNC_BATCH_STATUS.FAILED },
        });
      }
    }

    if (stranded.length) {
      this.logger.warn(
        { stranded: stranded.length, promoted: promoted.length },
        'RECEIVED batches past the staleness window — crash gap between tsdb commit and ledger update',
      );
    }

    let republished = 0;

    for (const batch of [...promoted, ...stale]) {
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

    if (stale.length || promoted.length) {
      this.logger.log(
        { found: stale.length + promoted.length, republished },
        'stale batch sweep',
      );
    }

    return { republished };
  }
}
