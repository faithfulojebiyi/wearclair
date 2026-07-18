import { Module } from '@nestjs/common';

import { CreateCycleLogCommandHandler } from './commands/create-cycle-log';
import { SetPeriodCommandHandler } from './commands/set-period';
import { UpsertCycleLogCommandHandler } from './commands/upsert-cycle-log';
import { CycleController } from './cycle.controller';
import { GetCycleCalendarQueryHandler } from './queries/get-cycle-calendar';
import { GetCycleDayQueryHandler } from './queries/get-cycle-day';
import { GetCycleTimelineQueryHandler } from './queries/get-cycle-timeline';
import { GetPredictionsQueryHandler } from './queries/get-predictions';
import { ListCycleLogsQueryHandler } from './queries/list-cycle-logs';

@Module({
  controllers: [CycleController],
  providers: [
    GetPredictionsQueryHandler,
    GetCycleCalendarQueryHandler,
    GetCycleDayQueryHandler,
    GetCycleTimelineQueryHandler,
    ListCycleLogsQueryHandler,
    CreateCycleLogCommandHandler,
    UpsertCycleLogCommandHandler,
    SetPeriodCommandHandler,
  ],
})
export class CycleModule {}
