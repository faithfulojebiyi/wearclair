import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { CyclePhase } from '@feature/cycle-insights/phase';
import { estimateHormones } from '@feature/cycle-insights/hormones';

// controlled classifier output — one day, so `today` is deterministic
const day = {
  date: new Date('2026-05-15T00:00:00.000Z'),
  cycleDay: 15,
  phase: CyclePhase.OVULATORY,
  basalTempC: 36.6,
  restingHrBpm: 60,
  hrvRmssdMs: 70,
  readiness: 82,
  hormones: estimateHormones(15),
};

const classifyCycleDays = mock(() => [day]);
const generateHealthInsightDrafts = mock(async () => [
  {
    key: 'fertile-window-open',
    category: 'fertility' as const,
    priority: 'high' as const,
    title: 'Fertile Window Open',
    body: 'ovulation likely soon',
  },
]);

mock.module('@feature/cycle-insights/classify', () => ({ classifyCycleDays }));
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
  const dailyUpdate = mock(async () => ({}));
  const dailyFindUnique = mock(async () => ({
    insightSignature: storedSignature,
  }));

  const prisma = {
    healthInsight: { upsert: healthUpsert },
    dailyInsight: { findUnique: dailyFindUnique, update: dailyUpdate },
  };

  return { prisma, healthUpsert, dailyUpdate, dailyFindUnique };
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
      new ClassifyAndUpsertHealthInsightsCommand(event, []),
    );

    expect(generateHealthInsightDrafts).toHaveBeenCalledTimes(1);
    expect(healthUpsert).toHaveBeenCalledTimes(1);
    expect(dailyUpdate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ upserted: 1 });
  });

  it('skips generation when the stored signature is unchanged', async () => {
    const currentSig = healthInsightSignature([day]);
    const { prisma, healthUpsert, dailyUpdate } = makePrisma(currentSig);
    // @ts-expect-error — minimal fake prisma for the handler under test
    const handler = new ClassifyAndUpsertHealthInsightsCommandHandler(prisma);

    const result = await handler.execute(
      new ClassifyAndUpsertHealthInsightsCommand(event, []),
    );

    expect(generateHealthInsightDrafts).not.toHaveBeenCalled();
    expect(healthUpsert).not.toHaveBeenCalled();
    expect(dailyUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({ upserted: 0, skipped: true });
  });
});
