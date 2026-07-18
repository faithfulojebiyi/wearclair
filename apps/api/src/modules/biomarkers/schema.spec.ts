import { describe, expect, it } from 'bun:test';

import { GetSeriesQuerySchema } from './schema';

const query = (bucket: string, from: string, to: string) => ({
  metric: 'skin_temp',
  bucket,
  from,
  to,
});

describe('GetSeriesQuerySchema range caps', () => {
  it('rejects to <= from', () => {
    const result = GetSeriesQuerySchema.safeParse(
      query('1h', '2026-07-02T00:00:00Z', '2026-07-01T00:00:00Z'),
    );

    expect(result.success).toBe(false);
  });

  it('caps 5m (raw hypertable) reads at 24h', () => {
    const ok = GetSeriesQuerySchema.safeParse(
      query('5m', '2026-07-01T00:00:00Z', '2026-07-01T23:00:00Z'),
    );
    const tooBig = GetSeriesQuerySchema.safeParse(
      query('5m', '2026-07-01T00:00:00Z', '2026-07-03T00:00:00Z'),
    );

    expect(ok.success).toBe(true);
    expect(tooBig.success).toBe(false);
  });

  it('caps 1h reads at 31d', () => {
    const ok = GetSeriesQuerySchema.safeParse(
      query('1h', '2026-06-01T00:00:00Z', '2026-06-30T00:00:00Z'),
    );
    const tooBig = GetSeriesQuerySchema.safeParse(
      query('1h', '2026-05-01T00:00:00Z', '2026-07-01T00:00:00Z'),
    );

    expect(ok.success).toBe(true);
    expect(tooBig.success).toBe(false);
  });

  it('caps 1d reads at 400d', () => {
    const ok = GetSeriesQuerySchema.safeParse(
      query('1d', '2025-07-01T00:00:00Z', '2026-07-01T00:00:00Z'),
    );
    const tooBig = GetSeriesQuerySchema.safeParse(
      query('1d', '2024-01-01T00:00:00Z', '2026-07-01T00:00:00Z'),
    );

    expect(ok.success).toBe(true);
    expect(tooBig.success).toBe(false);
  });
});
