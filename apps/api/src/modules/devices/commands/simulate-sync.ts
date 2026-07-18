import {
  Command,
  CommandBus,
  CommandHandler,
  ICommandHandler,
} from '@nestjs/cqrs';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { cycleAnchorFor } from '@feature/biomarker-sim/cycle-model';
import { generateSamples } from '@feature/biomarker-sim/generator';
import { AlsService } from '@system/als/als.service';
import { AppPrismaService } from '@system/database/database.service';

import { SyncResultDto } from '../dto/devices.dto';
import { IngestBatchCommand } from './ingest-batch';

const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;

// demo stand-in for the BLE device: generates the next window of cycle-shaped
// samples server-side, then dispatches the REAL IngestBatchCommand — the generator
// lives in one place and the live demo exercises the actual ingest path.
export class SimulateSyncCommand extends Command<SyncResultDto> {
  constructor(public readonly deviceId: string) {
    super();
  }
}

@CommandHandler(SimulateSyncCommand)
export class SimulateSyncCommandHandler implements ICommandHandler<SimulateSyncCommand> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: SimulateSyncCommand) {
    const userId = this.alsService.ctx.get('userId');

    if (!userId) {
      throw new UnauthorizedException();
    }

    const device = await this.appPrismaService.device.findFirst({
      where: { id: command.deviceId, userId },
    });

    if (!device) {
      throw new NotFoundException('device not found');
    }

    const to = new Date();
    const from = new Date(
      Math.max(
        device.lastSyncedAt?.getTime() ?? to.getTime() - MAX_WINDOW_MS,
        to.getTime() - MAX_WINDOW_MS,
      ),
    );

    // same mid-month cycle anchor the seed uses, so live syncs continue the seeded
    // cycle without a discontinuity at "now".
    const samples = generateSamples({
      userId,
      from,
      to,
      cycleAnchorMs: cycleAnchorFor(to),
    });

    if (samples.length === 0) {
      throw new BadRequestException('device is already up to date');
    }

    return this.commandBus.execute(
      new IngestBatchCommand(device.id, { samples }),
    );
  }
}
