import { Module } from '@nestjs/common';

import { BiomarkersController } from './biomarkers.controller';
import { GetLatestQueryHandler } from './queries/get-latest';
import { GetSeriesQueryHandler } from './queries/get-series';

@Module({
  controllers: [BiomarkersController],
  providers: [GetSeriesQueryHandler, GetLatestQueryHandler],
})
export class BiomarkersModule {}
