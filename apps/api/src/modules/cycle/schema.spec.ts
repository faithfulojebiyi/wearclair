import { describe, expect, it } from 'bun:test';

import { GetCycleCalendarQuerySchema, SetPeriodSchema } from './schema';

describe('GetCycleCalendarQuerySchema range caps', () => {
  it('rejects to <= from', () => {
    const result = GetCycleCalendarQuerySchema.safeParse({
      from: '2026-07-01',
      to: '2026-07-01',
    });

    expect(result.success).toBe(false);
  });

  it('normalizes legacy datetime inputs to their UTC day part', () => {
    const result = GetCycleCalendarQuerySchema.safeParse({
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-03T12:34:56.000Z',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ from: '2026-07-01', to: '2026-07-03' });
  });

  it('caps the window at 400d — the handler derives one day object per requested day', () => {
    const ok = GetCycleCalendarQuerySchema.safeParse({
      from: '2025-07-01',
      to: '2026-07-01',
    });
    const tooBig = GetCycleCalendarQuerySchema.safeParse({
      from: '2020-01-01',
      to: '2026-07-01',
    });

    expect(ok.success).toBe(true);
    expect(tooBig.success).toBe(false);
  });
});

describe('SetPeriodSchema range caps', () => {
  it('caps the edit window at 400d', () => {
    const tooBig = SetPeriodSchema.safeParse({
      from: '2020-01-01',
      to: '2026-07-01',
      dates: [],
    });

    expect(tooBig.success).toBe(false);
  });
});
