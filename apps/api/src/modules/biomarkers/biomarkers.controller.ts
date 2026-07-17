import { ZodResponse } from 'nestjs-zod';

import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';

import {
  GetSeriesQueryDto,
  LatestReadingsDto,
  SeriesDto,
} from './dto/biomarkers.dto';
import { GetLatestQuery } from './queries/get-latest';
import { GetSeriesQuery } from './queries/get-series';

@ApiTags('Biomarkers')
@Controller('biomarkers')
export class BiomarkersController {
  constructor(private readonly queryBus: QueryBus) {}

  @ZodResponse({ type: SeriesDto })
  @Get('series')
  async getSeries(@Query() dto: GetSeriesQueryDto) {
    return this.queryBus.execute(new GetSeriesQuery(dto));
  }

  @ZodResponse({ type: LatestReadingsDto })
  @Get('latest')
  async getLatest() {
    return this.queryBus.execute(new GetLatestQuery());
  }
}
