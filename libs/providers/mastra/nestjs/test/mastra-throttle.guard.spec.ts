import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { HttpException, Logger } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import { MastraThrottleGuard } from '../guards/mastra-throttle.guard';
import type { MastraModuleOptions } from '../mastra.module';
import { fakeRequest } from './test-helpers';

function makeGuard(
  options: Partial<MastraModuleOptions> = {},
): MastraThrottleGuard {
  const reflector = {
    getAllAndOverride: () => undefined,
  } as unknown as Reflector;
  return new MastraThrottleGuard(options as MastraModuleOptions, reflector);
}

// The guard logs debug lines on rate-limit + cleanup; silence Nest's logger.
beforeAll(() => Logger.overrideLogger(false));
afterAll(() => Logger.overrideLogger(true));

describe('MastraThrottleGuard.checkLimit', () => {
  let guard: MastraThrottleGuard;
  afterEach(() => guard.onModuleDestroy());

  it('allows requests up to the limit then throws 429', async () => {
    guard = makeGuard();
    const req = fakeRequest({ ip: '10.0.0.1' });

    await guard.checkLimit(req, 2, 60000, '/x');
    await guard.checkLimit(req, 2, 60000, '/x');
    await expect(guard.checkLimit(req, 2, 60000, '/x')).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('throws a 429 status with retryAfter metadata', async () => {
    guard = makeGuard();
    const req = fakeRequest({ ip: '10.0.0.2' });
    await guard.checkLimit(req, 1, 60000, '/x');
    try {
      await guard.checkLimit(req, 1, 60000, '/x');
      throw new Error('expected rate limit to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const ex = err as HttpException;
      expect(ex.getStatus()).toBe(429);
      const resp = ex.getResponse() as { retryAfter?: number };
      expect(typeof resp.retryAfter).toBe('number');
    }
  });

  it('keeps independent buckets per client id (ip)', async () => {
    guard = makeGuard();
    const a = fakeRequest({ ip: '10.0.0.3' });
    const b = fakeRequest({ ip: '10.0.0.4' });

    await guard.checkLimit(a, 1, 60000, '/x');
    await expect(guard.checkLimit(a, 1, 60000, '/x')).rejects.toBeInstanceOf(
      HttpException,
    );
    // A's exhausted bucket must not affect B.
    await expect(guard.checkLimit(b, 1, 60000, '/x')).resolves.toBeUndefined();
  });

  it('buckets authenticated users by user id, not ip', async () => {
    guard = makeGuard();
    const withUser = {
      ...fakeRequest({ ip: '10.0.0.5' }),
      user: { id: 'u1' },
    } as ReturnType<typeof fakeRequest> & { user: { id: string } };

    await guard.checkLimit(withUser, 1, 60000, '/x');
    await expect(
      guard.checkLimit(withUser, 1, 60000, '/x'),
    ).rejects.toBeInstanceOf(HttpException);
  });
});

describe('MastraThrottleGuard.getRateLimitSettings', () => {
  let guard: MastraThrottleGuard;
  afterEach(() => guard.onModuleDestroy());

  it('uses the default limit for ordinary paths', () => {
    guard = makeGuard();
    expect(
      guard.getRateLimitSettings(fakeRequest(), undefined, '/agents'),
    ).toEqual({ limit: 100, windowMs: 60000 });
  });

  it('applies the stricter generate limit for /generate paths', () => {
    guard = makeGuard();
    const settings = guard.getRateLimitSettings(
      fakeRequest(),
      undefined,
      '/agents/foo/generate',
    );
    expect(settings.limit).toBe(10);
  });

  it('honors per-route decorator overrides', () => {
    guard = makeGuard();
    expect(
      guard.getRateLimitSettings(fakeRequest(), { limit: 3, windowMs: 1000 }),
    ).toEqual({ limit: 3, windowMs: 1000 });
  });

  it('respects configured limits from module options', () => {
    guard = makeGuard({
      rateLimitOptions: { defaultLimit: 7, generateLimit: 2, windowMs: 5000 },
    });
    expect(
      guard.getRateLimitSettings(fakeRequest(), undefined, '/agents'),
    ).toEqual({ limit: 7, windowMs: 5000 });
    expect(
      guard.getRateLimitSettings(fakeRequest(), undefined, '/x/generate'),
    ).toEqual({ limit: 2, windowMs: 5000 });
  });
});
