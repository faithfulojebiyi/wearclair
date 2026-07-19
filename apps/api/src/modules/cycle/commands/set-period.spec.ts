import { describe, expect, it, mock } from 'bun:test';

import { SetPeriodSchema } from '../schema';
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
        from: '2026-07-01',
        to: '2026-07-05',
        dates: ['2026-07-02'],
      }),
    );

    expect(execute).toHaveBeenCalledTimes(1);

    const query = execute.mock.calls[0][0] as unknown as GetCycleCalendarQuery;
    expect(query).toBeInstanceOf(GetCycleCalendarQuery);
    expect(query.fresh).toBe(true);
  });
});

describe('SetPeriod window bounds', () => {
  it('schema rejects dates outside [from, to]', () => {
    const result = SetPeriodSchema.safeParse({
      from: '2026-07-01',
      to: '2026-07-31',
      // a December date inside a July edit window
      dates: ['2026-07-02', '2026-12-25'],
    });

    expect(result.success).toBe(false);
  });

  it('schema accepts dates on the window boundaries', () => {
    const result = SetPeriodSchema.safeParse({
      from: '2026-07-01',
      to: '2026-07-31',
      dates: ['2026-07-01', '2026-07-31'],
    });

    expect(result.success).toBe(true);
  });

  it('command never writes days outside the window (defense in depth)', async () => {
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
        from: '2026-07-01',
        to: '2026-07-05',
        dates: ['2026-07-02', '2026-12-25'],
      }),
    );

    // @ts-expect-error — mock call args are loosely typed
    const written = createMany.mock.calls[0][0]?.data as { date: Date }[];
    expect(written.length).toBe(1);
    expect(written[0].date.toISOString().slice(0, 10)).toBe('2026-07-02');
  });
});
