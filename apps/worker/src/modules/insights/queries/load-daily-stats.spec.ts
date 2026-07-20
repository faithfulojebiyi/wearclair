import { describe, expect, it, mock } from 'bun:test';

import {
  LoadDailyStatsQuery,
  LoadDailyStatsQueryHandler,
} from './load-daily-stats';

describe('LoadDailyStatsQueryHandler', () => {
  it('preserves the device-local day returned for a late UTC batch', async () => {
    const queryDailyStats = mock(async () => [
      {
        day: new Date('2026-07-20T00:00:00.000Z'),
        metric: 'skin_temp' as const,
        avg: 36.7,
        min: 36.5,
        max: 36.9,
        count: 12,
      },
    ]);
    const handler = new LoadDailyStatsQueryHandler({
      queryDailyStats,
    } as never);
    const event = {
      batchId: 'batch-1',
      deviceId: 'device-1',
      userId: 'user-1',
      // 23:30 UTC belongs to the next local day in zones ahead of UTC.
      windowStart: '2026-07-19T23:00:00.000Z',
      windowEnd: '2026-07-19T23:30:00.000Z',
      sampleCount: 12,
    };

    const stats = await handler.execute(new LoadDailyStatsQuery(event));

    expect(stats[0]?.day).toBe('2026-07-20T00:00:00.000Z');
    expect(queryDailyStats).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        metrics: ['skin_temp', 'heart_rate', 'hrv'],
      }),
    );
  });
});
