import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { classifyCycleDays } from '@feature/cycle-insights/classify';

const stats = [
  {
    day: '2026-05-15T00:00:00.000Z',
    metric: 'skin_temp' as const,
    avg: 36.6,
    min: 36.5,
    max: 36.7,
    count: 1,
  },
  {
    day: '2026-05-15T00:00:00.000Z',
    metric: 'heart_rate' as const,
    avg: 60,
    min: 60,
    max: 60,
    count: 1,
  },
  {
    day: '2026-05-15T00:00:00.000Z',
    metric: 'hrv' as const,
    avg: 70,
    min: 70,
    max: 70,
    count: 1,
  },
];
const day = classifyCycleDays(
  stats.map((stat) => ({ ...stat, day: new Date(stat.day) })),
)[0];

const generateHealthInsightDrafts = mock(async () => [
  {
    key: 'fertile-window-open',
    category: 'fertility' as const,
    priority: 'high' as const,
    title: 'Fertile Window Open',
    body: 'ovulation likely soon',
  },
]);

mock.module('@feature/cycle-insights/ai-insights', () => ({
  generateHealthInsightDrafts,
}));

// imported AFTER the module mocks are registered
const {
  ClassifyAndUpsertHealthInsightsCommand,
  ClassifyAndUpsertHealthInsightsCommandHandler,
} = await import('./classify-and-upsert-health-insights');
const { healthInsightSignature } =
  await import('@feature/cycle-insights/signature');

const event = {
  batchId: 'b1',
  deviceId: 'd1',
  userId: 'u1',
  windowStart: '2026-05-15T00:00:00.000Z',
  windowEnd: '2026-05-15T01:00:00.000Z',
  sampleCount: 10,
};

const makePrisma = (storedSignature: string | null) => {
  const healthUpsert = mock(async () => ({}));
  const healthDeleteMany = mock(async () => ({ count: 0 }));
  const dailyUpdate = mock(async () => ({}));
  const dailyFindUnique = mock(async () => ({
    insightSignature: storedSignature,
  }));

  const prisma: Record<string, unknown> = {
    healthInsight: { upsert: healthUpsert, deleteMany: healthDeleteMany },
    dailyInsight: { findUnique: dailyFindUnique, update: dailyUpdate },
  };
  // interactive transaction fake: run the callback against the same client
  prisma.$transaction = async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(prisma);

  return {
    prisma,
    healthUpsert,
    healthDeleteMany,
    dailyUpdate,
    dailyFindUnique,
  };
};

describe('ClassifyAndUpsertHealthInsightsCommandHandler', () => {
  beforeEach(() => {
    generateHealthInsightDrafts.mockClear();
  });

  it('regenerates and stores the signature when none is stored', async () => {
    const { prisma, healthUpsert, dailyUpdate } = makePrisma(null);
    // @ts-expect-error — minimal fake prisma for the handler under test
    const handler = new ClassifyAndUpsertHealthInsightsCommandHandler(prisma);

    const result = await handler.execute(
      new ClassifyAndUpsertHealthInsightsCommand(event, stats),
    );

    expect(generateHealthInsightDrafts).toHaveBeenCalledTimes(1);
    expect(healthUpsert).toHaveBeenCalledTimes(1);
    expect(dailyUpdate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ upserted: 1 });
  });

  it('deletes cards whose key was not regenerated (no obsolete guidance)', async () => {
    const { prisma, healthDeleteMany, healthUpsert } = makePrisma(null);
    // @ts-expect-error — minimal fake prisma for the handler under test
    const handler = new ClassifyAndUpsertHealthInsightsCommandHandler(prisma);

    await handler.execute(
      new ClassifyAndUpsertHealthInsightsCommand(event, stats),
    );

    expect(healthDeleteMany).toHaveBeenCalledTimes(1);

    // @ts-expect-error — mock call args are loosely typed
    const where = healthDeleteMany.mock.calls[0][0]?.where;
    expect(where?.userId).toBe('u1');
    expect(where?.date).toEqual(day.date);
    // everything OUTSIDE the freshly generated key set goes
    expect(where?.key).toEqual({ notIn: ['fertile-window-open'] });

    // the delete lands before the upserts inside the transaction
    expect(healthDeleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      healthUpsert.mock.invocationCallOrder[0],
    );
  });

  it('skips generation when the stored signature is unchanged', async () => {
    const currentSig = healthInsightSignature([day]);
    const { prisma, healthUpsert, healthDeleteMany, dailyUpdate } =
      makePrisma(currentSig);
    // @ts-expect-error — minimal fake prisma for the handler under test
    const handler = new ClassifyAndUpsertHealthInsightsCommandHandler(prisma);

    const result = await handler.execute(
      new ClassifyAndUpsertHealthInsightsCommand(event, stats),
    );

    expect(generateHealthInsightDrafts).not.toHaveBeenCalled();
    expect(healthUpsert).not.toHaveBeenCalled();
    expect(healthDeleteMany).not.toHaveBeenCalled();
    expect(dailyUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({ upserted: 0, skipped: true });
  });

  it('does not wipe the day when generation unexpectedly returns nothing', async () => {
    generateHealthInsightDrafts.mockImplementationOnce(async () => []);
    const { prisma, healthDeleteMany, dailyUpdate } = makePrisma(null);
    // @ts-expect-error — minimal fake prisma for the handler under test
    const handler = new ClassifyAndUpsertHealthInsightsCommandHandler(prisma);

    const result = await handler.execute(
      new ClassifyAndUpsertHealthInsightsCommand(event, stats),
    );

    expect(healthDeleteMany).not.toHaveBeenCalled();
    expect(dailyUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({ upserted: 0 });
  });
});
