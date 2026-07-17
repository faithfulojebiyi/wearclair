import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';

import { AlsService } from '@system/als/als.service';
import { AppPrismaService } from '@system/database/database.service';
import { EVENT_KEYS } from '@system/queues/events.config';
import { BiomarkerStore } from '@system/timeseries/biomarker.store';

import { EventPublisherService } from '../../event-publisher/event-publisher.service';
import { IngestBatchDto, SyncResultDto } from '../dto/devices.dto';

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

    // ownership check doubles as existence check — 404 either way, no leaking
    const device = await this.appPrismaService.device.findFirst({
      where: { id: command.deviceId, userId },
    });

    if (!device) {
      throw new NotFoundException('device not found');
    }

    const { samples } = command.dto;
    const times = samples.map((sample) => sample.ts.getTime());
    const windowStart = new Date(Math.min(...times));
    const windowEnd = new Date(Math.max(...times));

    // raw firehose write first (idempotent via the tsdb dedupe index) …
    const { inserted } = await this.biomarkerStore.insertBatch(
      userId,
      device.id,
      samples,
    );

    // … then the relational bookkeeping in the app db
    const batch = await this.appPrismaService.syncBatch.create({
      data: {
        deviceId: device.id,
        userId,
        windowStart,
        windowEnd,
        sampleCount: inserted,
      },
    });

    if (!device.lastSyncedAt || windowEnd > device.lastSyncedAt) {
      await this.appPrismaService.device.update({
        where: { id: device.id },
        data: { lastSyncedAt: windowEnd },
      });
    }

    // event id = batch id -> inngest dedupes retries of the same batch
    await this.eventPublisherService.sendEvent({
      id: `device-batch-${batch.id}`,
      name: EVENT_KEYS.DEVICE_BATCH_SYNCED,
      data: {
        batchId: batch.id,
        deviceId: device.id,
        userId,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        sampleCount: inserted,
      },
      user: { userId },
    });

    return {
      batchId: batch.id,
      accepted: inserted,
      windowStart,
      windowEnd,
    };
  }
}
