import { describe, expect, it } from 'bun:test';

import { GetCycleCalendarQuerySchema, SetPeriodSchema } from './schema';

describe('GetCycleCalendarQuerySchema range caps', () => {
  it('rejects to <= from', () => {
    const result = GetCycleCalendarQuerySchema.safeParse({
      from: '2026-07-01T00:00:00Z',
      to: '2026-07-01T00:00:00Z',
    });

    expect(result.success).toBe(false);
  });

  it('caps the window at 400d — the handler derives one day object per requested day', () => {
    const ok = GetCycleCalendarQuerySchema.safeParse({
      from: '2025-07-01T00:00:00Z',
      to: '2026-07-01T00:00:00Z',
    });
    const tooBig = GetCycleCalendarQuerySchema.safeParse({
      from: '2020-01-01T00:00:00Z',
      to: '2026-07-01T00:00:00Z',
    });

    expect(ok.success).toBe(true);
    expect(tooBig.success).toBe(false);
  });
});

describe('SetPeriodSchema range caps', () => {
  it('caps the edit window at 400d', () => {
    const tooBig = SetPeriodSchema.safeParse({
      from: '2020-01-01T00:00:00Z',
      to: '2026-07-01T00:00:00Z',
      dates: [],
    });

    expect(tooBig.success).toBe(false);
  });
});
