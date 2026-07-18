import { describe, expect, it, mock } from 'bun:test';

import { GetCycleDayQuery } from '../queries/get-cycle-day';
import {
  UpsertCycleLogCommand,
  UpsertCycleLogCommandHandler,
} from './upsert-cycle-log';

describe('UpsertCycleLogCommandHandler read-after-write', () => {
  it('returns the day summary via a fresh (primary-routed) query', async () => {
    const upsert = mock(async () => ({}));
    const deleteMany = mock(async () => ({ count: 0 }));
    const prisma = { cycleLog: { upsert, deleteMany } };
    const execute = mock(async () => ({ logs: [] }));
    const als = { ctx: { get: () => 'u1' } };

    const handler = new UpsertCycleLogCommandHandler(
      // @ts-expect-error — minimal fakes for the handler under test
      prisma,
      als,
      { execute },
    );

    await handler.execute(
      new UpsertCycleLogCommand({
        type: 'mood',
        value: 'energetic',
        date: '2026-07-01T00:00:00Z',
      }),
    );

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);

    const query = execute.mock.calls[0][0] as unknown as GetCycleDayQuery;
    expect(query).toBeInstanceOf(GetCycleDayQuery);
    expect(query.fresh).toBe(true);
  });
});
