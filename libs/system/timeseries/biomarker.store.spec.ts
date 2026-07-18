import { describe, expect, it, mock } from 'bun:test';

import { BiomarkerStore, RawSample } from './biomarker.store';
import { TsdbQueryFn } from './timeseries.pool';

const sample = (iso: string): RawSample => ({
  ts: new Date(iso),
  // @ts-expect-error — metric literal for the store under test
  metric: 'skin_temp',
  value: 36.5,
});

// > INSERT_CHUNK (10k) samples so the insert spans two chunks
const manySamples = Array.from({ length: 10_001 }, (_, i) =>
  sample(new Date(1750000000000 + i * 1000).toISOString()),
);

const makePool = () => {
  const txQuery = mock(async () => ({ rowCount: 1 }));
  const poolQuery = mock(async () => ({ rowCount: 1 }));
  const withTransaction = mock(
    async <T>(fn: (query: TsdbQueryFn) => Promise<T>) =>
      // @ts-expect-error — loose fake of the transactional query fn
      fn(txQuery),
  );

  return { query: poolQuery, withTransaction, txQuery, poolQuery };
};

describe('BiomarkerStore.insertBatch atomicity', () => {
  it('runs every chunk through one transaction, never the shared pool', async () => {
    const pool = makePool();
    // @ts-expect-error — minimal fake pool for the store under test
    const store = new BiomarkerStore(pool);

    const { inserted } = await store.insertBatch('u1', 'd1', manySamples);

    expect(pool.withTransaction).toHaveBeenCalledTimes(1);
    // two chunks (10k + 1), both inside the transaction
    expect(pool.txQuery).toHaveBeenCalledTimes(2);
    expect(pool.poolQuery).not.toHaveBeenCalled();
    expect(inserted).toBe(2);
  });

  it('propagates a chunk failure so the transaction rolls back as a unit', async () => {
    const pool = makePool();
    pool.txQuery.mockImplementationOnce(async () => ({ rowCount: 1 }));
    pool.txQuery.mockImplementationOnce(async () => {
      throw new Error('second chunk failed');
    });
    // @ts-expect-error — minimal fake pool for the store under test
    const store = new BiomarkerStore(pool);

    expect(store.insertBatch('u1', 'd1', manySamples)).rejects.toThrow(
      'second chunk failed',
    );
  });
});

describe('BiomarkerStore.refreshRollups', () => {
  it('refreshes both rollups outside any transaction, never past the current bucket', async () => {
    const pool = makePool();
    // @ts-expect-error — minimal fake pool for the store under test
    const store = new BiomarkerStore(pool);

    await store.refreshRollups();

    // CALL refresh_continuous_aggregate cannot run inside a transaction
    expect(pool.withTransaction).not.toHaveBeenCalled();
    expect(pool.poolQuery).toHaveBeenCalledTimes(2);

    const statements = pool.poolQuery.mock.calls.map(
      // @ts-expect-error — mock call args are loosely typed
      (call) => call[0] as string,
    );
    expect(statements[0]).toContain(`'biomarker_1h'`);
    expect(statements[1]).toContain(`'biomarker_1d'`);

    for (const statement of statements) {
      // end bound stops at the current bucket start — a NULL end would
      // materialize the incomplete bucket and push the watermark into the
      // future, hiding later live-sync samples from the real-time union
      expect(statement).toContain('time_bucket');
      expect(statement).not.toMatch(/NULL\s*\)/i);
    }
  });
});
