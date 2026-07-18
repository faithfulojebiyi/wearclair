import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';

import { AlsService } from '@system/als/als.service';
import { AppPrismaService } from '@system/database/database.service';

import { startOfDay } from '../cycle-model';
import { CreateCycleLogDto, CycleLogDto } from '../dto/cycle.dto';

export class CreateCycleLogCommand extends Command<CycleLogDto> {
  constructor(public readonly dto: CreateCycleLogDto) {
    super();
  }
}

@CommandHandler(CreateCycleLogCommand)
export class CreateCycleLogCommandHandler implements ICommandHandler<CreateCycleLogCommand> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute(command: CreateCycleLogCommand) {
    const userId = this.alsService.ctx.get('userId');

    if (!userId) {
      throw new UnauthorizedException();
    }

    const date = command.dto.date
      ? startOfDay(new Date(command.dto.date))
      : startOfDay(new Date());

    // upsert: one row per (user, day, category) — a repeated quick action replaces
    const log = await this.appPrismaService.cycleLog.upsert({
      where: {
        userId_date_type: { userId, date, type: command.dto.type },
      },
      create: {
        userId,
        date,
        type: command.dto.type,
        value: command.dto.value,
        note: command.dto.note ?? null,
      },
      update: {
        value: command.dto.value,
        note: command.dto.note ?? null,
      },
    });

    return {
      id: log.id,
      type: log.type,
      value: log.value,
      note: log.note,
      date: log.date,
      loggedAt: log.loggedAt,
    };
  }
}
