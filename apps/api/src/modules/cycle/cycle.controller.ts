import { ZodResponse } from 'nestjs-zod';

import { Body, Controller, Get, Query, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';

import { CreateCycleLogCommand } from './commands/create-cycle-log';
import { SetPeriodCommand } from './commands/set-period';
import { UpsertCycleLogCommand } from './commands/upsert-cycle-log';
import {
  CreateCycleLogDto,
  CycleCalendarDto,
  CycleDaySummaryDto,
  CycleLogDto,
  CycleLogListDto,
  CyclePredictionsDto,
  CycleTimelineDto,
  GetCycleCalendarQueryDto,
  GetCycleDayQueryDto,
  SetPeriodDto,
  UpsertCycleLogDto,
} from './dto/cycle.dto';
import { GetCycleCalendarQuery } from './queries/get-cycle-calendar';
import { GetCycleDayQuery } from './queries/get-cycle-day';
import { GetCycleTimelineQuery } from './queries/get-cycle-timeline';
import { GetPredictionsQuery } from './queries/get-predictions';
import { ListCycleLogsQuery } from './queries/list-cycle-logs';

@ApiTags('Cycle')
@Controller('cycle')
export class CycleController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @ZodResponse({ type: CyclePredictionsDto })
  @Get('predictions')
  async getPredictions() {
    return this.queryBus.execute(new GetPredictionsQuery());
  }

  @ZodResponse({ type: CycleCalendarDto })
  @Get('calendar')
  async getCalendar(@Query() dto: GetCycleCalendarQueryDto) {
    return this.queryBus.execute(new GetCycleCalendarQuery(dto));
  }

  @ZodResponse({ type: CycleDaySummaryDto })
  @Get('day')
  async getDay(@Query() dto: GetCycleDayQueryDto) {
    return this.queryBus.execute(new GetCycleDayQuery(dto));
  }

  @ZodResponse({ type: CycleTimelineDto })
  @Get('timeline')
  async getTimeline() {
    return this.queryBus.execute(new GetCycleTimelineQuery());
  }

  @ZodResponse({ type: CycleLogListDto })
  @Get('logs')
  async listLogs() {
    return this.queryBus.execute(new ListCycleLogsQuery());
  }

  @ZodResponse({ type: CycleLogDto })
  @Post('logs')
  async createLog(@Body() dto: CreateCycleLogDto) {
    return this.commandBus.execute(new CreateCycleLogCommand(dto));
  }

  @ZodResponse({ type: CycleDaySummaryDto })
  @Post('day/logs')
  async upsertDayLog(@Body() dto: UpsertCycleLogDto) {
    return this.commandBus.execute(new UpsertCycleLogCommand(dto));
  }

  @ZodResponse({ type: CycleCalendarDto })
  @Post('period')
  async setPeriod(@Body() dto: SetPeriodDto) {
    return this.commandBus.execute(new SetPeriodCommand(dto));
  }
}
