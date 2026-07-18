import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { Logger } from '@nestjs/common';

import {
  MAX_BACKOFF_EXPONENT,
  nextPublishAttemptAt,
  STALE_AFTER_MS,
} from '../publish-backoff';
import {
  RepublishStaleBatchesCommand,
  RepublishStaleBatchesCommandHandler,
} from './republish-stale-batches';

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60 * 1000);

const staleBatch = (
  id: string,
  overrides: { publishAttempts?: number } = {},
) => ({
  id,
  deviceId: 'd1',
  userId: 'u1',
  windowStart: new Date('2026-07-01T00:00:00.000Z'),
  windowEnd: new Date('2026-07-01T01:00:00.000Z'),
  sampleCount: 12,
  rawWrittenAt: minutesAgo(30),
  publishAttempts: overrides.publishAttempts ?? 0,
  nextPublishAttemptAt: minutesAgo(1),
});

const makeDeps = (batches: ReturnType<typeof staleBatch>[], struggling = 0) => {
  const findMany = mock(async () => batches);
  const count = mock(async () => struggling);
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

    const updates = deps.updateMany.mock.calls.map(
      // @ts-expect-error — mock call args are loosely typed
      (call) => call[0]?.data,
    );
    expect(updates.map((data) => data?.status)).toEqual([
      'PUBLISHED',
      'PUBLISHED',
    ]);
    // a published batch leaves the retry schedule
    expect(updates.map((data) => data?.nextPublishAttemptAt)).toEqual([
      null,
      null,
    ]);
  });

  it('counts the attempt and schedules the next one with backoff when a republish fails', async () => {
    deps = makeDeps([
      staleBatch('b1', { publishAttempts: 2 }),
      staleBatch('b2'),
    ]);
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
      // @ts-expect-error — mock call args are loosely typed
      nextAttemptAt: call[0]?.data?.nextPublishAttemptAt,
    }));

    expect(calls[0]?.status).toBeUndefined();
    expect(calls[0]?.attempts).toEqual({ increment: 1 });

    // attempts 2 → 3, so the next due time is ~STALE_AFTER_MS * 2^3 out
    const expectedMs = Date.now() + STALE_AFTER_MS * 2 ** 3;
    expect(
      Math.abs((calls[0]?.nextAttemptAt as Date).getTime() - expectedMs),
    ).toBeLessThan(5000);

    expect(calls[1]?.status).toBe('PUBLISHED');
  });

  it('queries due-ness directly so not-yet-due rows cannot starve due ones', async () => {
    const handler = makeHandler(deps);

    await handler.execute(new RepublishStaleBatchesCommand());

    // @ts-expect-error — mock call args are loosely typed
    const query = deps.findMany.mock.calls[0][0];

    expect(query?.where?.status).toBe('RAW_WRITTEN');
    // due rows selected by persisted schedule, with a legacy null fallback —
    // no attempt cap and no in-code backoff filtering
    expect(query?.where?.OR?.[0]?.nextPublishAttemptAt?.lte).toBeInstanceOf(
      Date,
    );
    expect(query?.where?.OR?.[1]?.nextPublishAttemptAt).toBeNull();
    expect(query?.where?.OR?.[1]?.rawWrittenAt?.lt).toBeInstanceOf(Date);
    expect(query?.where?.publishAttempts).toBeUndefined();
    expect(query?.orderBy).toEqual({
      nextPublishAttemptAt: { sort: 'asc', nulls: 'first' },
    });
  });

  it('republishes every fetched row, even far past the alert threshold', async () => {
    deps = makeDeps(
      [staleBatch('very-late', { publishAttempts: 8 })],
      3, // strugglers exist in the table
    );
    const errorSpy = spyOn(Logger.prototype, 'error').mockImplementation(
      () => undefined,
    );
    const handler = makeHandler(deps);

    const result = await handler.execute(new RepublishStaleBatchesCommand());

    // no abandonment: due rows are retried regardless of attempt count
    expect(result.republished).toBe(1);

    // repeated failures are alerted loudly every sweep, not just silently retried
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('caps the backoff interval at ~7 days', () => {
    const capped = nextPublishAttemptAt(50, new Date(0));

    expect(capped.getTime()).toBe(STALE_AFTER_MS * 2 ** MAX_BACKOFF_EXPONENT);
  });
});
