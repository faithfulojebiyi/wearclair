/// <reference types="bun" />
import { describe, expect, it } from 'bun:test';

import { QueuedSample } from './local-store';
import { batchKeyFor } from './utils';

const row = (rowId: string, ts: number, value: number): QueuedSample => ({
  rowId,
  ts,
  metric: 'skin_temp',
  value,
});

describe('batchKeyFor', () => {
  it('is deterministic for the same rows', () => {
    const rows = [row('a', 1, 36.5), row('b', 2, 36.6), row('c', 3, 36.7)];

    expect(batchKeyFor([...rows])).toBe(batchKeyFor(rows));
  });

  it('differs when a middle row changes, even with identical first/last/count', () => {
    const rows = [row('a', 1, 36.5), row('b', 2, 36.6), row('c', 3, 36.7)];
    // same window bounds and count — the old shape-only key would collide here
    const middleChanged = [rows[0], row('b', 2, 39.9), rows[2]];

    expect(batchKeyFor(middleChanged)).not.toBe(batchKeyFor(rows));
  });
});
