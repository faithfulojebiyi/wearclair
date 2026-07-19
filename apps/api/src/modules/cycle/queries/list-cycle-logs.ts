import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';

import { AlsService } from '@system/als/als.service';
import { AppPrismaService } from '@system/database/database.service';

import { PERIOD_EXCLUDED } from '../cycle-model';
import { CycleLogListDto } from '../dto/cycle.dto';

export class ListCycleLogsQuery extends Query<CycleLogListDto> {
  constructor() {
    super();
  }
}

@QueryHandler(ListCycleLogsQuery)
export class ListCycleLogsQueryHandler implements IQueryHandler<ListCycleLogsQuery> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute() {
    const userId = this.alsService.ctx.get('userId');

    if (!userId) {
      throw new UnauthorizedException();
    }

    const logs = await this.appPrismaService.cycleLog.findMany({
      // period tombstones drive derivation but are not user-visible logs
      where: { userId, NOT: { type: 'period', value: PERIOD_EXCLUDED } },
      orderBy: { loggedAt: 'desc' },
      take: 50,
    });

    return {
      logs: logs.map((log) => ({
        id: log.id,
        type: log.type,
        value: log.value,
        note: log.note,
        date: log.date,
        loggedAt: log.loggedAt,
      })),
    };
  }
}
