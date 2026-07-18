import { describe, expect, it } from 'bun:test';

import { GetInsightRangeQuerySchema } from './schema';

describe('GetInsightRangeQuerySchema range caps', () => {
  it('rejects to <= from', () => {
    const result = GetInsightRangeQuerySchema.safeParse({
      from: '2026-07-02T00:00:00Z',
      to: '2026-07-01T00:00:00Z',
    });

    expect(result.success).toBe(false);
  });

  it('caps the window at 400d', () => {
    const ok = GetInsightRangeQuerySchema.safeParse({
      from: '2025-07-01T00:00:00Z',
      to: '2026-07-01T00:00:00Z',
    });
    const tooBig = GetInsightRangeQuerySchema.safeParse({
      from: '2024-01-01T00:00:00Z',
      to: '2026-07-01T00:00:00Z',
    });

    expect(ok.success).toBe(true);
    expect(tooBig.success).toBe(false);
  });
});
