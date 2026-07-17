import { Module } from '@nestjs/common';

import { InsightsController } from './insights.controller';
import { GetInsightRangeQueryHandler } from './queries/get-insight-range';
import { GetTodayInsightQueryHandler } from './queries/get-today-insight';

@Module({
  controllers: [InsightsController],
  providers: [GetTodayInsightQueryHandler, GetInsightRangeQueryHandler],
})
export class InsightsModule {}
