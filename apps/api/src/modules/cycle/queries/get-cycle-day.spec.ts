import { describe, expect, it, mock } from 'bun:test';

import { GetCycleDayQuery, GetCycleDayQueryHandler } from './get-cycle-day';

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
    $primary: () => ({
      dailyInsight: { findMany: primaryFindMany, findFirst: primaryFindFirst },
      cycleLog: { findMany: primaryFindMany },
    }),
  };

  return { prisma, replicaFindFirst, primaryFindFirst };
};

const als = { ctx: { get: () => 'u1' } };
const dto = { date: '2026-07-01T00:00:00Z' };

describe('GetCycleDayQueryHandler replica routing', () => {
  it('uses the default (replica-eligible) client for plain reads', async () => {
    const { prisma, replicaFindFirst, primaryFindFirst } = makePrisma();
    // @ts-expect-error — minimal fakes for the handler under test
    const handler = new GetCycleDayQueryHandler(prisma, als);

    await handler.execute(new GetCycleDayQuery(dto));

    expect(replicaFindFirst).toHaveBeenCalled();
    expect(primaryFindFirst).not.toHaveBeenCalled();
  });

  it('routes reads to $primary() when fresh — read-after-write must not see a lagging replica', async () => {
    const { prisma, replicaFindFirst, primaryFindFirst } = makePrisma();
    // @ts-expect-error — minimal fakes for the handler under test
    const handler = new GetCycleDayQueryHandler(prisma, als);

    await handler.execute(new GetCycleDayQuery(dto, true));

    expect(primaryFindFirst).toHaveBeenCalled();
    expect(replicaFindFirst).not.toHaveBeenCalled();
  });
});
