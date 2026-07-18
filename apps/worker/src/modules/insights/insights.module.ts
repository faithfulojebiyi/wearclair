import { Module } from '@nestjs/common';

import { ClassifyAndUpsertHealthInsightsCommandHandler } from './commands/classify-and-upsert-health-insights';
import { ClassifyAndUpsertInsightsCommandHandler } from './commands/classify-and-upsert-insights';
import { MarkBatchProcessedCommandHandler } from './commands/mark-batch-processed';
import { RefreshRollupsCommandHandler } from './commands/refresh-rollups';
import { LoadDailyStatsQueryHandler } from './queries/load-daily-stats';

@Module({
  providers: [
    LoadDailyStatsQueryHandler,
    RefreshRollupsCommandHandler,
    ClassifyAndUpsertInsightsCommandHandler,
    ClassifyAndUpsertHealthInsightsCommandHandler,
    MarkBatchProcessedCommandHandler,
  ],
})
export class InsightsModule {}
