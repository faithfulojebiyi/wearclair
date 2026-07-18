import { describe, expect, it, mock } from 'bun:test';

import { GetCycleCalendarQuery } from '../queries/get-cycle-calendar';
import { SetPeriodCommand, SetPeriodCommandHandler } from './set-period';

describe('SetPeriodCommandHandler read-after-write', () => {
  it('returns the calendar via a fresh (primary-routed) query', async () => {
    const deleteMany = mock(async () => ({ count: 0 }));
    const createMany = mock(async () => ({ count: 1 }));
    const prisma = {
      $transaction: async (fn: (tx: unknown) => Promise<void>) =>
        fn({ cycleLog: { deleteMany, createMany } }),
    };
    const execute = mock(async () => ({ days: [] }));
    const als = { ctx: { get: () => 'u1' } };

    const handler = new SetPeriodCommandHandler(
      // @ts-expect-error — minimal fakes for the handler under test
      prisma,
      als,
      { execute },
    );

    await handler.execute(
      new SetPeriodCommand({
        from: '2026-07-01T00:00:00Z',
        to: '2026-07-05T00:00:00Z',
        dates: ['2026-07-02T00:00:00Z'],
      }),
    );

    expect(execute).toHaveBeenCalledTimes(1);

    const query = execute.mock.calls[0][0] as unknown as GetCycleCalendarQuery;
    expect(query).toBeInstanceOf(GetCycleCalendarQuery);
    expect(query.fresh).toBe(true);
  });
});
