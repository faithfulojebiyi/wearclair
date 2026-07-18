import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { IngestBatchCommand, IngestBatchCommandHandler } from './ingest-batch';

const samples = [
  {
    ts: new Date('2026-07-01T00:00:00.000Z'),
    metric: 'skin_temp',
    value: 36.5,
  },
  {
    ts: new Date('2026-07-01T00:05:00.000Z'),
    metric: 'skin_temp',
    value: 36.6,
  },
];

const persistedRow = {
  id: 'b1',
  deviceId: 'd1',
  userId: 'u1',
  windowStart: new Date('2026-07-01T00:00:00.000Z'),
  windowEnd: new Date('2026-07-01T00:05:00.000Z'),
  sampleCount: 2,
  status: 'RAW_WRITTEN',
  publishAttempts: 0,
};

const makeDeps = () => {
  const device = { id: 'd1', userId: 'u1', lastSyncedAt: null };
  const findFirst = mock(async () => device);
  const create = mock(async () => ({ id: 'b1' }));
  const upsert = mock(async () => ({ id: 'b1' }));
  const updateMany = mock(async () => ({ count: 1 }));
  const deviceUpdate = mock(async () => device);
  // the persisted row the handler re-reads before publishing — tests override
  // it to model retry scenarios
  const findUniqueOrThrow = mock(async () => ({ ...persistedRow }));

  const prisma = {
    $primary: () => ({
      device: { findFirst },
      syncBatch: { findUniqueOrThrow },
    }),
    syncBatch: { create, upsert, updateMany },
    device: { update: deviceUpdate },
  };

  const insertBatch = mock(async () => ({ inserted: 2 }));
  const sendEvent = mock(async () => ({ ids: ['evt'] }));
  const als = { ctx: { get: () => 'u1' } };

  return {
    prisma,
    insertBatch,
    sendEvent,
    als,
    create,
    upsert,
    updateMany,
    findUniqueOrThrow,
  };
};

const makeHandler = (deps: ReturnType<typeof makeDeps>) =>
  new IngestBatchCommandHandler(
    // @ts-expect-error — minimal fake prisma for the handler under test
    deps.prisma,
    { insertBatch: deps.insertBatch },
    { sendEvent: deps.sendEvent },
    deps.als,
  );

describe('IngestBatchCommandHandler', () => {
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    deps = makeDeps();
  });

  it('creates the batch row before the raw write and marks it PUBLISHED on success', async () => {
    const handler = makeHandler(deps);

    // @ts-expect-error — minimal dto
    const result = await handler.execute(
      new IngestBatchCommand('d1', { samples }),
    );

    expect(result.batchId).toBe('b1');
    expect(result.accepted).toBe(2);

    // batch row exists before the tsdb write
    expect(deps.create.mock.invocationCallOrder[0]).toBeLessThan(
      deps.insertBatch.mock.invocationCallOrder[0],
    );

    const updates = deps.updateMany.mock.calls.map(
      // @ts-expect-error — mock call args are loosely typed
      (call) => call[0]?.data,
    );
    expect(updates.map((data) => data?.status)).toContain('RAW_WRITTEN');
    expect(updates.map((data) => data?.status)).toContain('PUBLISHED');

    // the raw write schedules the recovery sweep; the publish clears it
    const rawWritten = updates.find((data) => data?.status === 'RAW_WRITTEN');
    expect(rawWritten?.nextPublishAttemptAt).toBeInstanceOf(Date);

    const published = updates.find((data) => data?.status === 'PUBLISHED');
    expect(published?.nextPublishAttemptAt).toBeNull();
  });

  it('publishes the PERSISTED window and count, not the request view', async () => {
    // model a client-retry: this request inserted 0 rows, but the persisted
    // batch (from the original request) carries the real window + count
    deps.insertBatch.mockImplementation(async () => ({ inserted: 0 }));
    deps.findUniqueOrThrow.mockImplementation(async () => ({
      ...persistedRow,
      sampleCount: 42,
      windowStart: new Date('2026-06-30T10:00:00.000Z'),
      windowEnd: new Date('2026-06-30T11:00:00.000Z'),
    }));
    const handler = makeHandler(deps);

    await handler.execute(
      // @ts-expect-error — minimal dto
      new IngestBatchCommand('d1', {
        samples,
        clientBatchId: 'client-batch-1',
      }),
    );

    expect(deps.sendEvent).toHaveBeenCalledTimes(1);

    // @ts-expect-error — mock call args are loosely typed
    const eventData = deps.sendEvent.mock.calls[0][0]?.data;
    expect(eventData?.sampleCount).toBe(42);
    expect(eventData?.windowStart).toBe('2026-06-30T10:00:00.000Z');
    expect(eventData?.windowEnd).toBe('2026-06-30T11:00:00.000Z');
  });

  it('does not republish a batch that is already PUBLISHED or PROCESSED', async () => {
    deps.findUniqueOrThrow.mockImplementation(async () => ({
      ...persistedRow,
      status: 'PUBLISHED',
    }));
    const handler = makeHandler(deps);

    await handler.execute(
      // @ts-expect-error — minimal dto
      new IngestBatchCommand('d1', {
        samples,
        clientBatchId: 'client-batch-1',
      }),
    );

    expect(deps.sendEvent).not.toHaveBeenCalled();
  });

  it('leaves the batch RAW_WRITTEN and still succeeds when the event publish fails', async () => {
    deps.sendEvent.mockImplementation(async () => {
      throw new Error('inngest down');
    });
    const handler = makeHandler(deps);

    // @ts-expect-error — minimal dto
    const result = await handler.execute(
      new IngestBatchCommand('d1', { samples }),
    );

    // sync must not fail — raw data is durable, recovery cron republishes
    expect(result.batchId).toBe('b1');

    const statuses = deps.updateMany.mock.calls.map(
      // @ts-expect-error — mock call args are loosely typed
      (call) => call[0]?.data?.status,
    );
    expect(statuses).toContain('RAW_WRITTEN');
    expect(statuses).not.toContain('PUBLISHED');

    // the failed attempt is counted and the next one scheduled with backoff,
    // so the recovery cron finds the batch as soon as it is due
    const attemptBumps = deps.updateMany.mock.calls.filter(
      // @ts-expect-error — mock call args are loosely typed
      (call) => call[0]?.data?.publishAttempts !== undefined,
    );
    expect(attemptBumps.length).toBe(1);

    // @ts-expect-error — mock call args are loosely typed
    const nextAttemptAt = attemptBumps[0][0]?.data?.nextPublishAttemptAt;
    expect(nextAttemptAt).toBeInstanceOf(Date);
    expect((nextAttemptAt as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it('marks the batch FAILED and rethrows when the raw tsdb write fails', async () => {
    deps.insertBatch.mockImplementation(async () => {
      throw new Error('tsdb down');
    });
    const handler = makeHandler(deps);

    expect(
      // @ts-expect-error — minimal dto
      handler.execute(new IngestBatchCommand('d1', { samples })),
    ).rejects.toThrow('tsdb down');

    await Bun.sleep(0);

    const statuses = deps.updateMany.mock.calls.map(
      // @ts-expect-error — mock call args are loosely typed
      (call) => call[0]?.data?.status,
    );
    expect(statuses).toContain('FAILED');
    expect(deps.sendEvent).not.toHaveBeenCalled();
  });

  it('reuses the batch row for a retried clientBatchId via upsert', async () => {
    const handler = makeHandler(deps);

    await handler.execute(
      // @ts-expect-error — minimal dto
      new IngestBatchCommand('d1', {
        samples,
        clientBatchId: 'client-batch-1',
      }),
    );

    expect(deps.upsert).toHaveBeenCalledTimes(1);
    expect(deps.create).not.toHaveBeenCalled();

    // @ts-expect-error — mock call args are loosely typed
    const where = deps.upsert.mock.calls[0][0]?.where;
    expect(where).toEqual({
      deviceId_clientBatchId: {
        deviceId: 'd1',
        clientBatchId: 'client-batch-1',
      },
    });
  });
});
