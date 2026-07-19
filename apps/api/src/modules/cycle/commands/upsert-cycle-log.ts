import {
  Command,
  CommandHandler,
  ICommandHandler,
  QueryBus,
} from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';

import { AlsService } from '@system/als/als.service';
import { AppPrismaService } from '@system/database/database.service';

import { PERIOD_EXCLUDED, startOfDay } from '../cycle-model';
import { CycleDaySummaryDto, UpsertCycleLogDto } from '../dto/cycle.dto';
import { GetCycleDayQuery } from '../queries/get-cycle-day';

// upsert a single category for a day (keyed on userId+date+type). an empty value
// deletes the row — that's how the Track screen represents "deselect everything".
// returns the refreshed day summary so the client re-renders in one round-trip.
export class UpsertCycleLogCommand extends Command<CycleDaySummaryDto> {
  constructor(public readonly dto: UpsertCycleLogDto) {
    super();
  }
}

@CommandHandler(UpsertCycleLogCommand)
export class UpsertCycleLogCommandHandler implements ICommandHandler<UpsertCycleLogCommand> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
    private readonly queryBus: QueryBus,
  ) {}

  async execute(command: UpsertCycleLogCommand) {
    const userId = this.alsService.ctx.get('userId');

    if (!userId) {
      throw new UnauthorizedException();
    }

    const { type, note } = command.dto;
    const value = command.dto.value.trim();
    const date = startOfDay(new Date(command.dto.date));

    if (value.length === 0 && type === 'period') {
      // period deselect is a tombstone, not a delete — the worker's MENSTRUAL
      // classification must not re-mark a day the user explicitly cleared
      await this.appPrismaService.cycleLog.upsert({
        where: { userId_date_type: { userId, date, type } },
        create: { userId, date, type, value: PERIOD_EXCLUDED, note: null },
        update: { value: PERIOD_EXCLUDED, note: null },
      });
    } else if (value.length === 0) {
      // deselect-all → remove the row entirely
      await this.appPrismaService.cycleLog.deleteMany({
        where: { userId, date, type },
      });
    } else {
      await this.appPrismaService.cycleLog.upsert({
        where: { userId_date_type: { userId, date, type } },
        create: { userId, date, type, value, note: note ?? null },
        update: { value, note: note ?? null },
      });
    }

    // fresh: the response must reflect the write above, not a lagging replica
    return this.queryBus.execute(
      new GetCycleDayQuery({ date: command.dto.date }, true),
    );
  }
}
