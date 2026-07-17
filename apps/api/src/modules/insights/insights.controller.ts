import { ZodResponse } from 'nestjs-zod';

import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';

import {
  DailyInsightDto,
  DailyInsightListDto,
  GetInsightRangeQueryDto,
} from './dto/insights.dto';
import { GetInsightRangeQuery } from './queries/get-insight-range';
import { GetTodayInsightQuery } from './queries/get-today-insight';

@ApiTags('Insights')
@Controller('insights')
export class InsightsController {
  constructor(private readonly queryBus: QueryBus) {}

  @ZodResponse({ type: DailyInsightDto })
  @Get('today')
  async getToday() {
    return this.queryBus.execute(new GetTodayInsightQuery());
  }

  @ZodResponse({ type: DailyInsightListDto })
  @Get()
  async getRange(@Query() dto: GetInsightRangeQueryDto) {
    return this.queryBus.execute(new GetInsightRangeQuery(dto));
  }
}
