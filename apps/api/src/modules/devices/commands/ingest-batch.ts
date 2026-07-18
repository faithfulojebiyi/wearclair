import { createHash } from 'node:crypto';

import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  ConflictException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { SyncBatch } from '@orm/app';

import { AlsService } from '@system/als/als.service';
import { AppPrismaService } from '@system/database/database.service';
import { EVENT_KEYS } from '@system/queues/events.config';
import { SYNC_BATCH_STATUS } from '@system/schema/sync-batch.schema';
import { BiomarkerStore } from '@system/timeseries/biomarker.store';

import { nextPublishAttemptAt } from '../publish-backoff';
import { EventPublisherService } from '../../event-publisher/event-publisher.service';
import { IngestBatchDto, SyncResultDto } from '../dto/devices.dto';

// order-independent fingerprint — guards clientBatchId reuse with different content
const hashSamples = (
  samples: { ts: Date; metric: string; value: number }[],
): string =>
  createHash('sha256')
    .update(
      samples
        .map(
          (sample) =>
            `${sample.ts.toISOString()}|${sample.metric}|${sample.value}`,
        )
        .sort()
        .join('\n'),
    )
    .digest('hex');

// THE ingest path: every batch — real device sync or simulate-sync — lands here.
export class IngestBatchCommand extends Command<SyncResultDto> {
  constructor(
    public readonly deviceId: string,
    public readonly dto: IngestBatchDto,
  ) {
    super();
  }
}

@CommandHandler(IngestBatchCommand)
export class IngestBatchCommandHandler implements ICommandHandler<IngestBatchCommand> {
  private readonly logger = new Logger(IngestBatchCommandHandler.name);

  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly biomarkerStore: BiomarkerStore,
    private readonly eventPublisherService: EventPublisherService,
    private readonly alsService: AlsService,
  ) {}

  async execute(command: IngestBatchCommand) {
    const userId = this.alsService.ctx.get('userId');

    if (!userId) {
      throw new UnauthorizedException();
    }

    // ownership check doubles as existence check — 404 either way, no leaking.
    // $primary(): a just-registered device must be visible before its first sync.
    const device = await this.appPrismaService
      .$primary()
      .device.findFirst({ where: { id: command.deviceId, userId } });

    if (!device) {
      throw new NotFoundException('device not found');
    }

    const { samples, clientBatchId } = command.dto;
    const times = samples.map((sample) => sample.ts.getTime());
    const windowStart = new Date(Math.min(...times));
    const windowEnd = new Date(Math.max(...times));

    /**
     * ledger row first — a later crash leaves something the recovery cron can
     * pick up. rejects a reused key with different content before the raw write.
     */
    const batch = await this.findOrCreateBatch({
      deviceId: device.id,
      userId,
      clientBatchId,
      windowStart,
      windowEnd,
      contentHash: hashSamples(samples),
    });

    // raw firehose write (idempotent via the tsdb dedupe index)
    let inserted: number;

    try {
      ({ inserted } = await this.biomarkerStore.insertBatch(
        userId,
        device.id,
        samples,
      ));
    } catch (error) {
      await this.appPrismaService.syncBatch.updateMany({
        where: { id: batch.id, status: SYNC_BATCH_STATUS.RECEIVED },
        data: { status: SYNC_BATCH_STATUS.FAILED },
      });

      throw error;
    }

    // durable window count, not this request's inserts — a crash-retry dedupes to 0
    const durable = await this.biomarkerStore.countWindow({
      userId: batch.userId,
      deviceId: batch.deviceId,
      from: batch.windowStart,
      to: batch.windowEnd,
    });

    await this.appPrismaService.syncBatch.updateMany({
      where: {
        id: batch.id,
        status: {
          in: [SYNC_BATCH_STATUS.RECEIVED, SYNC_BATCH_STATUS.FAILED],
        },
      },
      data: {
        status: SYNC_BATCH_STATUS.RAW_WRITTEN,
        rawWrittenAt: new Date(),
        // pre-scheduled so a failed publish below is already sweepable
        nextPublishAttemptAt: nextPublishAttemptAt(0),
        sampleCount: durable,
      },
    });

    if (!device.lastSyncedAt || windowEnd > device.lastSyncedAt) {
      await this.appPrismaService.device.update({
        where: { id: device.id },
        data: { lastSyncedAt: windowEnd },
      });
    }

    // the persisted row is the authoritative event payload: a clientBatchId retry
    // must republish the ORIGINAL window/count (not this request's zero-insert
    // view), and an already-PUBLISHED/PROCESSED batch must not publish again.
    const current = await this.appPrismaService
      .$primary()
      .syncBatch.findUniqueOrThrow({ where: { id: batch.id } });

    if (current.status === SYNC_BATCH_STATUS.RAW_WRITTEN) {
      await this.publishBatchSynced(current);
    }

    return {
      batchId: batch.id,
      accepted: inserted,
      windowStart,
      windowEnd,
    };
  }

  /**
   * reuse the row for a retried clientBatchId; a reused row must carry the SAME
   * content — a completed batch never re-publishes, so different samples under
   * its key would become raw data no derivation ever picks up.
   */
  private async findOrCreateBatch(data: {
    deviceId: string;
    userId: string;
    clientBatchId?: string;
    windowStart: Date;
    windowEnd: Date;
    contentHash: string;
  }): Promise<SyncBatch> {
    const { deviceId, userId, clientBatchId, windowStart, windowEnd } = data;

    if (!clientBatchId) {
      return this.appPrismaService.syncBatch.create({
        data: {
          deviceId,
          userId,
          windowStart,
          windowEnd,
          sampleCount: 0,
          contentHash: data.contentHash,
        },
      });
    }

    const batch = await this.appPrismaService.syncBatch.upsert({
      where: { deviceId_clientBatchId: { deviceId, clientBatchId } },
      create: {
        deviceId,
        userId,
        clientBatchId,
        windowStart,
        windowEnd,
        sampleCount: 0,
        contentHash: data.contentHash,
      },
      // retry of a known batch — leave lifecycle state alone
      update: {},
    });

    if (batch.contentHash && batch.contentHash !== data.contentHash) {
      throw new ConflictException(
        'clientBatchId reused with different samples',
      );
    }

    // legacy rows predate the hash — stamp once, guarded
    if (!batch.contentHash) {
      await this.appPrismaService.syncBatch.updateMany({
        where: { id: batch.id, contentHash: null },
        data: { contentHash: data.contentHash },
      });
    }

    return batch;
  }

  // event id = batch id -> inngest dedupes redeliveries AND recovery republishes.
  // the payload comes from the persisted row, never from the current request.
  // publish failure is non-fatal: the raw data is durable, the row stays
  // RAW_WRITTEN, and the recovery cron republishes it.
  private async publishBatchSynced(batch: SyncBatch): Promise<void> {
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
    } catch (error) {
      await this.appPrismaService.syncBatch.updateMany({
        where: { id: batch.id },
        data: {
          publishAttempts: { increment: 1 },
          nextPublishAttemptAt: nextPublishAttemptAt(batch.publishAttempts + 1),
        },
      });

      this.logger.warn(
        { batchId: batch.id, err: error },
        'batch.synced publish failed — batch left RAW_WRITTEN for recovery cron',
      );
    }
  }
}
