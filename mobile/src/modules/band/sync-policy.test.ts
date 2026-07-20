/// <reference types="bun" />
import { describe, expect, it } from 'bun:test';

import { decideSyncFailure, syncErrorDetails } from './sync-policy';

describe('decideSyncFailure', () => {
  it('retries network and server failures with bounded exponential backoff', () => {
    expect(decideSyncFailure({}, 1, 0, () => 0.5)).toEqual({
      kind: 'retry',
      delayMs: 8_000,
    });
    expect(decideSyncFailure({ status: 503 }, 10, 0, () => 1)).toEqual({
      kind: 'retry',
      delayMs: 300_000,
    });
  });

  it('honors a numeric Retry-After header for rate limits', () => {
    expect(
      decideSyncFailure(
        { status: 429, retryAfter: '60' },
        1,
        Date.parse('2026-07-19T12:00:00.000Z'),
        () => 0.5,
      ),
    ).toEqual({ kind: 'retry', delayMs: 60_000 });
  });

  it('pauses for authentication and missing-device failures', () => {
    expect(decideSyncFailure({ status: 401 }, 1)).toEqual({
      kind: 'pause',
      reason: 'auth',
    });
    expect(decideSyncFailure({ status: 404 }, 1)).toEqual({
      kind: 'pause',
      reason: 'device',
    });
  });

  it('quarantines permanently rejected readings', () => {
    expect(decideSyncFailure({ status: 422 }, 1)).toEqual({
      kind: 'quarantine',
      reason: 'Server rejected these readings.',
    });
  });
});

describe('syncErrorDetails', () => {
  it('extracts status and Retry-After from an Axios-style error', () => {
    expect(
      syncErrorDetails({
        isAxiosError: true,
        response: { status: 429, headers: { 'retry-after': '45' } },
      }),
    ).toEqual({ status: 429, retryAfter: '45' });
  });
});
