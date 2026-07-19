import { describe, expect, it, mock } from 'bun:test';

import {
  GetCycleCalendarQuery,
  GetCycleCalendarQueryHandler,
} from './get-cycle-calendar';

// two prisma faces: the default (replica-eligible) client and the $primary()
// client — the handler must pick by the query's `fresh` flag.
const makePrisma = () => {
  const replicaFindMany = mock(async () => []);
  const replicaFindFirst = mock(async () => null);
  const primaryFindMany = mock(async () => []);
  const primaryFindFirst = mock(async () => null);

  const prisma = {
    dailyInsight: { findMany: replicaFindMany, findFirst: replicaFindFirst },
    cycleLog: { findMany: replicaFindMany },
    user: { findUnique: mock(async () => ({ timezone: 'UTC' })) },
    $primary: () => ({
      dailyInsight: { findMany: primaryFindMany, findFirst: primaryFindFirst },
      cycleLog: { findMany: primaryFindMany },
      user: { findUnique: mock(async () => ({ timezone: 'UTC' })) },
    }),
  };

  return { prisma, replicaFindMany, primaryFindMany };
};

const als = { ctx: { get: () => 'u1' } };
const dto = { from: '2026-07-01', to: '2026-07-03' };

describe('GetCycleCalendarQueryHandler replica routing', () => {
  it('uses the default (replica-eligible) client for plain reads', async () => {
    const { prisma, replicaFindMany, primaryFindMany } = makePrisma();
    // @ts-expect-error — minimal fakes for the handler under test
    const handler = new GetCycleCalendarQueryHandler(prisma, als);

    await handler.execute(new GetCycleCalendarQuery(dto));

    expect(replicaFindMany).toHaveBeenCalled();
    expect(primaryFindMany).not.toHaveBeenCalled();
  });

  it('routes reads to $primary() when fresh — read-after-write must not see a lagging replica', async () => {
    const { prisma, replicaFindMany, primaryFindMany } = makePrisma();
    // @ts-expect-error — minimal fakes for the handler under test
    const handler = new GetCycleCalendarQueryHandler(prisma, als);

    await handler.execute(new GetCycleCalendarQuery(dto, true));

    expect(primaryFindMany).toHaveBeenCalled();
    expect(replicaFindMany).not.toHaveBeenCalled();
  });
});
