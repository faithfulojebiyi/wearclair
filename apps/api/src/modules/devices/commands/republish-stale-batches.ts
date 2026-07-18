import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

import { AppPrismaService } from '@system/database/database.service';
import { EVENT_KEYS } from '@system/queues/events.config';
import { SYNC_BATCH_STATUS } from '@system/schema/sync-batch.schema';
import { BiomarkerStore } from '@system/timeseries/biomarker.store';

import { nextPublishAttemptAt, STALE_AFTER_MS } from '../publish-backoff';
import { EventPublisherService } from '../../event-publisher/event-publisher.service';

/**
 * Recovery sweep for batches the ingest lifecycle lost track of:
 * - RAW_WRITTEN whose derivation event never reached inngest — republish. Safe
 *   (same deterministic event id + idempotent worker); retries never stop, each
 *   failed attempt persists the next due time (exponential backoff, see
 *   publish-backoff.ts), so the sweep queries due-ness directly and not-yet-due
 *   rows can't crowd due ones out of the page.
 * - RECEIVED older than the staleness window — a crash in the gap between the
 *   tsdb commit and the ledger update. Resolved against tsdb ground truth:
 *   durable rows in the window mean the raw write committed (promote to
 *   RAW_WRITTEN and publish); none mean it never did (FAILED, which a client
 *   retry on the same clientBatchId revives).
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
    private readonly biomarkerStore: BiomarkerStore,
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

    // crash recovery for RECEIVED strays: reconcile the ledger against what
    // actually landed in the tsdb. status-guarded updates keep this safe against
    // a concurrent slow ingest — whoever transitions the row first wins, and the
    // ingest path treats FAILED as retryable.
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
      const durable = await this.biomarkerStore.countWindow({
        userId: batch.userId,
        deviceId: batch.deviceId,
        from: batch.windowStart,
        to: batch.windowEnd,
      });

      if (durable > 0) {
        // the raw write committed before the crash — resume the lifecycle where
        // it was cut off and publish in this same sweep (already overdue)
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
        // nothing landed — the raw write never committed. FAILED is the honest
        // state and stays revivable by a clientBatchId retry.
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
