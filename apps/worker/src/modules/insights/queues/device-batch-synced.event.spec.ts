import { describe, expect, it, mock } from 'bun:test';

import { deviceBatchSyncedEvent } from './device-batch-synced.event';

describe('deviceBatchSyncedEvent', () => {
  it('derives insights directly from local-day stats without refreshing rollups', async () => {
    const stepNames: string[] = [];
    const commandBus = {
      execute: mock(async (command: { constructor: { name: string } }) =>
        command.constructor.name === 'ClassifyAndUpsertInsightsCommand'
          ? { upserted: 2 }
          : undefined,
      ),
    };
    const queryBus = {
      execute: mock(async () => []),
    };
    const step = {
      run: async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
        stepNames.push(name);

        return operation();
      },
      realtime: {
        publish: mock(async () => undefined),
      },
    };
    const fn = deviceBatchSyncedEvent({
      // @ts-expect-error — minimal buses for the function boundary under test
      commandBus,
      // @ts-expect-error — minimal buses for the function boundary under test
      queryBus,
    });

    const result = await fn.fn({
      event: {
        data: {
          batchId: 'batch-1',
          deviceId: 'device-1',
          userId: 'user-1',
          windowStart: '2026-07-19T08:00:00.000Z',
          windowEnd: '2026-07-19T09:00:00.000Z',
          sampleCount: 30,
        },
      },
      step,
    });

    expect(stepNames).toEqual([
      'load-daily-stats',
      'classify-and-upsert',
      'mark-batch-processed',
    ]);
    expect(result).toEqual({ upserted: 2 });
    expect(step.realtime.publish).toHaveBeenCalledTimes(1);
  });
});
