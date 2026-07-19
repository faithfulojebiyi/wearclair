import { describe, expect, it } from 'bun:test';

import { CyclePhase } from '@feature/cycle-insights/phase';

import { buildPeriodModel, deriveCalendarDay } from './cycle-model';

const TODAY_KEY = '2026-07-19';

describe('deriveCalendarDay period exclusion', () => {
  const base = {
    date: new Date('2026-07-10T00:00:00.000Z'),
    todayKey: TODAY_KEY,
    isLoggedPeriod: false,
    isExcludedPeriod: false,
    model: null,
    fallbackCycleDay: null,
  };

  it('marks a past MENSTRUAL-classified day as period by default', () => {
    const state = deriveCalendarDay({
      ...base,
      insight: { cycleDay: 2, phase: CyclePhase.MENSTRUAL },
    });

    expect(state.isPeriod).toBe(true);
  });

  it('user tombstone overrides the worker MENSTRUAL classification', () => {
    const state = deriveCalendarDay({
      ...base,
      insight: { cycleDay: 2, phase: CyclePhase.MENSTRUAL },
      isExcludedPeriod: true,
    });

    expect(state.isPeriod).toBe(false);
  });

  it('user tombstone overrides a model projection on a past gap day', () => {
    const model = buildPeriodModel([
      new Date('2026-06-01T00:00:00.000Z'),
      new Date('2026-06-02T00:00:00.000Z'),
      new Date('2026-06-29T00:00:00.000Z'),
      new Date('2026-06-30T00:00:00.000Z'),
    ]);

    // day 2 of the modeled cycle, no insight — projected period without override
    const projected = deriveCalendarDay({
      ...base,
      date: new Date('2026-06-30T00:00:00.000Z'),
      insight: null,
      model,
    });
    const excluded = deriveCalendarDay({
      ...base,
      date: new Date('2026-06-30T00:00:00.000Z'),
      insight: null,
      model,
      isExcludedPeriod: true,
    });

    expect(projected.isPeriod).toBe(true);
    expect(excluded.isPeriod).toBe(false);
  });

  it('tombstone also suppresses the cycleDay<=5 fallback heuristic', () => {
    const state = deriveCalendarDay({
      ...base,
      insight: null,
      fallbackCycleDay: 3,
      isExcludedPeriod: true,
    });

    expect(state.isPeriod).toBe(false);
  });
});
