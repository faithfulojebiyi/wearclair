import {
  Command,
  CommandHandler,
  ICommandHandler,
  QueryBus,
} from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';

import { AlsService } from '@system/als/als.service';
import { AppPrismaService } from '@system/database/database.service';

import { dayKey, startOfDay } from '../cycle-model';
import { CycleCalendarDto, SetPeriodDto } from '../dto/cycle.dto';
import { GetCycleCalendarQuery } from '../queries/get-cycle-calendar';

// Edit-period SAVE. within [from, to], the user's `dates` are the authoritative set of
// period days: upsert those, delete any existing period logs in the window not in the
// set. because the calendar/predictions re-derive the cycle model from period logs,
// this immediately recalculates all future predicted days.
export class SetPeriodCommand extends Command<CycleCalendarDto> {
  constructor(public readonly dto: SetPeriodDto) {
    super();
  }
}

@CommandHandler(SetPeriodCommand)
export class SetPeriodCommandHandler implements ICommandHandler<SetPeriodCommand> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
    private readonly queryBus: QueryBus,
  ) {}

  async execute(command: SetPeriodCommand) {
    const userId = this.alsService.ctx.get('userId');

    if (!userId) {
      throw new UnauthorizedException();
    }

    const from = startOfDay(new Date(command.dto.from));
    const to = startOfDay(new Date(command.dto.to));
    // defense in depth behind the schema: only window-bounded days are written
    const fromKey = dayKey(from);
    const toKey = dayKey(to);
    const keep = new Set(
      command.dto.dates
        .map((d) => dayKey(startOfDay(new Date(d))))
        .filter((key) => key >= fromKey && key <= toKey),
    );

    await this.appPrismaService.$transaction(async (tx) => {
      // drop period logs in the window that the user unmarked
      await tx.cycleLog.deleteMany({
        where: {
          userId,
          type: 'period',
          date: { gte: from, lte: to },
        },
      });

      // (re)create the marked ones
      if (keep.size > 0) {
        await tx.cycleLog.createMany({
          data: [...keep].map((key) => ({
            userId,
            type: 'period',
            value: 'logged',
            date: new Date(key),
          })),
          skipDuplicates: true,
        });
      }
    });

    // fresh: the response must reflect the writes above, not a lagging replica
    return this.queryBus.execute(
      new GetCycleCalendarQuery(
        { from: command.dto.from, to: command.dto.to },
        true,
      ),
    );
  }
}
