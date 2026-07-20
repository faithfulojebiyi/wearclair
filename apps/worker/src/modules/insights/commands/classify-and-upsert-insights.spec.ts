import { describe, expect, it, mock } from 'bun:test';

import {
  ClassifyAndUpsertInsightsCommand,
  ClassifyAndUpsertInsightsCommandHandler,
} from './classify-and-upsert-insights';

describe('ClassifyAndUpsertInsightsCommandHandler', () => {
  it('upserts a late UTC batch against the returned device-local day', async () => {
    const upsert = mock(async () => ({}));
    const handler = new ClassifyAndUpsertInsightsCommandHandler({
      dailyInsight: { upsert },
    } as never);
    const event = {
      batchId: 'batch-1',
      deviceId: 'device-1',
      userId: 'user-1',
      windowStart: '2026-07-19T23:00:00.000Z',
      windowEnd: '2026-07-19T23:30:00.000Z',
      sampleCount: 3,
    };
    const localDay = '2026-07-20T00:00:00.000Z';
    const stats = [
      {
        day: localDay,
        metric: 'skin_temp' as const,
        avg: 36.7,
        min: 36.5,
        max: 36.9,
        count: 1,
      },
      {
        day: localDay,
        metric: 'heart_rate' as const,
        avg: 65,
        min: 65,
        max: 65,
        count: 1,
      },
      {
        day: localDay,
        metric: 'hrv' as const,
        avg: 50,
        min: 50,
        max: 50,
        count: 1,
      },
    ];

    await handler.execute(new ClassifyAndUpsertInsightsCommand(event, stats));

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        where: {
          userId_date: {
            userId: 'user-1',
            date: new Date(localDay),
          },
        },
      }),
    );
  });
});
