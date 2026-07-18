import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { Logger } from '@nestjs/common';

import {
  RepublishStaleBatchesCommand,
  RepublishStaleBatchesCommandHandler,
} from './republish-stale-batches';

const staleBatch = (id: string) => ({
  id,
  deviceId: 'd1',
  userId: 'u1',
  windowStart: new Date('2026-07-01T00:00:00.000Z'),
  windowEnd: new Date('2026-07-01T01:00:00.000Z'),
  sampleCount: 12,
});

const makeDeps = (batches: ReturnType<typeof staleBatch>[]) => {
  const findMany = mock(async () => batches);
  const count = mock(async () => 0);
  const updateMany = mock(async () => ({ count: 1 }));

  const prisma = {
    $primary: () => ({ syncBatch: { findMany, count } }),
    syncBatch: { updateMany },
  };

  const sendEvent = mock(async () => ({ ids: ['evt'] }));

  return { prisma, findMany, count, updateMany, sendEvent };
};

const makeHandler = (deps: ReturnType<typeof makeDeps>) =>
  new RepublishStaleBatchesCommandHandler(
    // @ts-expect-error — minimal fake prisma for the handler under test
    deps.prisma,
    { sendEvent: deps.sendEvent },
  );

describe('RepublishStaleBatchesCommandHandler', () => {
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    deps = makeDeps([staleBatch('b1'), staleBatch('b2')]);
  });

  it('republishes stale batches with the same deterministic event id', async () => {
    const handler = makeHandler(deps);

    const result = await handler.execute(new RepublishStaleBatchesCommand());

    expect(result.republished).toBe(2);

    const ids = deps.sendEvent.mock.calls.map(
      // @ts-expect-error — mock call args are loosely typed
      (call) => call[0]?.id,
    );
    expect(ids).toEqual(['device-batch-b1', 'device-batch-b2']);

    const statuses = deps.updateMany.mock.calls.map(
      // @ts-expect-error — mock call args are loosely typed
      (call) => call[0]?.data?.status,
    );
    expect(statuses).toEqual(['PUBLISHED', 'PUBLISHED']);
  });

  it('counts the attempt and continues when a republish fails', async () => {
    deps.sendEvent.mockImplementationOnce(async () => {
      throw new Error('inngest down');
    });
    const handler = makeHandler(deps);

    const result = await handler.execute(new RepublishStaleBatchesCommand());

    // b1 failed, b2 went through
    expect(result.republished).toBe(1);

    const calls = deps.updateMany.mock.calls.map((call) => ({
      // @ts-expect-error — mock call args are loosely typed
      status: call[0]?.data?.status,
      // @ts-expect-error — mock call args are loosely typed
      attempts: call[0]?.data?.publishAttempts,
    }));

    expect(calls[0]?.status).toBeUndefined();
    expect(calls[0]?.attempts).toEqual({ increment: 1 });
    expect(calls[1]?.status).toBe('PUBLISHED');
  });

  it('logs an error when batches have exhausted their publish attempts', async () => {
    deps.count.mockImplementation(async () => 3);
    const errorSpy = spyOn(Logger.prototype, 'error').mockImplementation(
      () => undefined,
    );
    const handler = makeHandler(deps);

    await handler.execute(new RepublishStaleBatchesCommand());

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('only sweeps RAW_WRITTEN batches under the attempt cap', async () => {
    const handler = makeHandler(deps);

    await handler.execute(new RepublishStaleBatchesCommand());

    // @ts-expect-error — mock call args are loosely typed
    const where = deps.findMany.mock.calls[0][0]?.where;
    expect(where?.status).toBe('RAW_WRITTEN');
    expect(where?.publishAttempts).toEqual({ lt: 5 });
  });
});
