import { Module } from '@nestjs/common';

import { ClassifyAndUpsertInsightsCommandHandler } from './commands/classify-and-upsert-insights';
import { MarkBatchProcessedCommandHandler } from './commands/mark-batch-processed';
import { LoadDailyStatsQueryHandler } from './queries/load-daily-stats';

@Module({
  providers: [
    LoadDailyStatsQueryHandler,
    ClassifyAndUpsertInsightsCommandHandler,
    MarkBatchProcessedCommandHandler,
  ],
})
export class InsightsModule {}
