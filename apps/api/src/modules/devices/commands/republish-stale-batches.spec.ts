import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { Logger } from '@nestjs/common';

import {
  MAX_BACKOFF_EXPONENT,
  nextPublishAttemptAt,
  STALE_AFTER_MS,
} from '../publish-backoff';
import {
  PUBLISHED_STUCK_AFTER_MS,
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

const makeDeps = (
  batches: ReturnType<typeof staleBatch>[],
  options: {
    struggling?: number;
    received?: ReturnType<typeof staleBatch>[];
    durable?: number;
    stuckPublished?: number;
  } = {},
) => {
  // the sweep issues two findMany calls — dispatch the fake on the queried status
  const findMany = mock(async (args: { where?: { status?: string } }) =>
    args?.where?.status === 'RECEIVED' ? (options.received ?? []) : batches,
  );
  const count = mock(async () => options.struggling ?? 0);
  // the PUBLISHED demote leg is status-dispatched too — 0 stuck rows by default
  const updateMany = mock(
    async (args: {
      where?: { status?: string; publishedAt?: { lt?: Date } };
      data?: {
        status?: string;
        publishAttempts?: unknown;
        nextPublishAttemptAt?: Date | null;
        sampleCount?: number;
      };
    }) =>
      args?.where?.status === 'PUBLISHED'
        ? { count: options.stuckPublished ?? 0 }
        : { count: 1 },
  );
  const countBatchRows = mock(async () => options.durable ?? 0);

  const prisma = {
    $primary: () => ({ syncBatch: { findMany, count } }),
    syncBatch: { updateMany },
  };

  const sendEvent = mock(async () => ({ ids: ['evt'] }));

  return { prisma, findMany, count, updateMany, sendEvent, countBatchRows };
};

const makeHandler = (deps: ReturnType<typeof makeDeps>) =>
  new RepublishStaleBatchesCommandHandler(
    // @ts-expect-error — minimal fake prisma for the handler under test
    deps.prisma,
    { sendEvent: deps.sendEvent },
    // @ts-expect-error — minimal fake store for the handler under test
    { countBatchRows: deps.countBatchRows },
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

    // skip the PUBLISHED demote write that opens every sweep
    const updates = deps.updateMany.mock.calls
      .filter((call) => call[0]?.where?.status !== 'PUBLISHED')
      .map((call) => call[0]?.data);
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

    const calls = deps.updateMany.mock.calls
      .filter((call) => call[0]?.where?.status !== 'PUBLISHED')
      .map((call) => ({
        status: call[0]?.data?.status,
        attempts: call[0]?.data?.publishAttempts,
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
    // persisted schedule + legacy null fallback; no in-code filtering
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
    deps = makeDeps([staleBatch('very-late', { publishAttempts: 8 })], {
      struggling: 3, // strugglers exist in the table
    });
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

  it('promotes a stranded RECEIVED batch whose raw data committed, and publishes it', async () => {
    // crash between the tsdb commit and the ledger update: durable rows exist
    deps = makeDeps([], {
      received: [staleBatch('stranded')],
      durable: 42,
    });
    const handler = makeHandler(deps);

    const result = await handler.execute(new RepublishStaleBatchesCommand());

    expect(result.republished).toBe(1);

    const promote = deps.updateMany.mock.calls.find(
      (call) => call[0]?.where?.status === 'RECEIVED',
    )?.[0];
    expect(promote?.where?.status).toBe('RECEIVED');
    expect(promote?.data?.status).toBe('RAW_WRITTEN');
    expect(promote?.data?.sampleCount).toBe(42);

    // @ts-expect-error — mock call args are loosely typed
    const eventArgs = deps.sendEvent.mock.calls[0][0];
    expect(eventArgs?.id).toBe('device-batch-stranded');
    expect(eventArgs?.data?.sampleCount).toBe(42);
  });

  it('marks a stranded RECEIVED batch FAILED when no raw data ever committed', async () => {
    deps = makeDeps([], {
      received: [staleBatch('never-landed')],
      durable: 0,
    });
    const handler = makeHandler(deps);

    const result = await handler.execute(new RepublishStaleBatchesCommand());

    expect(result.republished).toBe(0);
    expect(deps.sendEvent).not.toHaveBeenCalled();

    const fail = deps.updateMany.mock.calls.find(
      (call) => call[0]?.where?.status === 'RECEIVED',
    )?.[0];
    expect(fail?.where?.status).toBe('RECEIVED');
    expect(fail?.data?.status).toBe('FAILED');
  });

  it('demotes dead-lettered PUBLISHED batches back to RAW_WRITTEN, due now', async () => {
    deps = makeDeps([], { stuckPublished: 2 });
    const warnSpy = spyOn(Logger.prototype, 'warn').mockImplementation(
      () => undefined,
    );
    const handler = makeHandler(deps);

    await handler.execute(new RepublishStaleBatchesCommand());

    const demote = deps.updateMany.mock.calls[0]?.[0];
    expect(demote?.where?.status).toBe('PUBLISHED');
    expect(demote?.data?.status).toBe('RAW_WRITTEN');
    expect(demote?.data?.nextPublishAttemptAt).toBeInstanceOf(Date);

    // cutoff sits a full dedup window back so the republish mints a fresh run
    const cutoff = demote?.where?.publishedAt?.lt;
    expect(
      Math.abs(
        (cutoff as Date).getTime() - (Date.now() - PUBLISHED_STUCK_AFTER_MS),
      ),
    ).toBeLessThan(5000);

    // demotions are alerted, not silent
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
