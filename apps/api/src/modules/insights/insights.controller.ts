import { ZodResponse } from 'nestjs-zod';

import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';

import {
  DailyInsightDto,
  DailyInsightListDto,
  GetHealthInsightsQueryDto,
  GetInsightRangeQueryDto,
  HealthInsightListDto,
} from './dto/insights.dto';
import { GetHealthInsightsQuery } from './queries/get-health-insights';
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

  @ZodResponse({ type: HealthInsightListDto })
  @Get('health')
  async getHealth(@Query() dto: GetHealthInsightsQueryDto) {
    return this.queryBus.execute(new GetHealthInsightsQuery(dto));
  }

  @ZodResponse({ type: DailyInsightListDto })
  @Get()
  async getRange(@Query() dto: GetInsightRangeQueryDto) {
    return this.queryBus.execute(new GetInsightRangeQuery(dto));
  }
}
