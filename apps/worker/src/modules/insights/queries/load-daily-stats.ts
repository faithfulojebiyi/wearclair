import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { DeviceBatchSyncedDto } from '@system/queues/dto/device-batch-synced.dto';
import { BiomarkerStore } from '@system/timeseries/biomarker.store';

import { InsightDailyStat } from '../schema';

// enough history for the classifier to see full cycles + its warm-up window
const HISTORY_DAYS = 70;
const DAY_MS = 24 * 60 * 60 * 1000;

export class LoadDailyStatsQuery extends Query<InsightDailyStat[]> {
  constructor(public readonly event: DeviceBatchSyncedDto) {
    super();
  }
}

@QueryHandler(LoadDailyStatsQuery)
export class LoadDailyStatsQueryHandler implements IQueryHandler<LoadDailyStatsQuery> {
  constructor(private readonly biomarkerStore: BiomarkerStore) {}

  async execute(query: LoadDailyStatsQuery) {
    const to = new Date(new Date(query.event.windowEnd).getTime() + DAY_MS);
    const from = new Date(to.getTime() - HISTORY_DAYS * DAY_MS);

    const stats = await this.biomarkerStore.queryDailyStats({
      userId: query.event.userId,
      metrics: ['skin_temp', 'heart_rate', 'hrv'],
      from,
      to,
    });

    return stats.map((stat) => ({
      day: stat.day.toISOString(),
      metric: stat.metric as InsightDailyStat['metric'],
      avg: stat.avg,
      min: stat.min,
      max: stat.max,
      count: stat.count,
    }));
  }
}
