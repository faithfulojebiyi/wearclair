import { describe, expect, it, mock } from 'bun:test';

import { CyclePhase } from '@feature/cycle-insights/phase';

import { DAY_MS, startOfDay } from '../cycle-model';
import {
  GetPredictionsQuery,
  GetPredictionsQueryHandler,
} from './get-predictions';

const als = { ctx: { get: () => 'u1' } };

const makePrisma = (insight: {
  date: Date;
  cycleDay: number;
  phase: string;
}) => {
  const prisma = {
    // no period logs — force the insight fallback
    cycleLog: { findMany: mock(async () => []) },
    dailyInsight: { findFirst: mock(async () => insight) },
  };

  return prisma;
};

describe('GetPredictionsQueryHandler insight fallback', () => {
  it('projects a stale insight anchor forward to today', async () => {
    const today = startOfDay(new Date());
    // latest insight is 10 days old at cycle day 20 (luteal back then)
    const prisma = makePrisma({
      date: new Date(today.getTime() - 10 * DAY_MS),
      cycleDay: 20,
      phase: 'LUTEAL',
    });
    // @ts-expect-error — minimal fakes for the handler under test
    const handler = new GetPredictionsQueryHandler(prisma, als);

    const result = await handler.execute(new GetPredictionsQuery());

    // day 20 + 10 days ≡ day 2 of the next 28-day cycle
    expect(result.cycleDay).toBe(2);
    // the stale luteal phase no longer applies — day 2 is menstrual
    expect(result.phase).toBe(CyclePhase.MENSTRUAL);

    // anchored on today: never in the past, inDays agrees with the dates
    for (const prediction of [result.nextPeriod, result.ovulation]) {
      expect(prediction.date.getTime()).toBeGreaterThanOrEqual(today.getTime());
      expect(prediction.inDays).toBe(
        Math.round((prediction.date.getTime() - today.getTime()) / DAY_MS),
      );
    }

    // next period: from day 2, day 1 comes around in 27 days
    expect(result.nextPeriod.inDays).toBe(27);
    expect(result.ovulation.inDays).toBe(12);
  });

  it('keeps the worker-derived phase while the insight is from today', async () => {
    const today = startOfDay(new Date());
    const prisma = makePrisma({ date: today, cycleDay: 20, phase: 'LUTEAL' });
    // @ts-expect-error — minimal fakes for the handler under test
    const handler = new GetPredictionsQueryHandler(prisma, als);

    const result = await handler.execute(new GetPredictionsQuery());

    expect(result.cycleDay).toBe(20);
    expect(result.phase).toBe(CyclePhase.LUTEAL);
  });
});
