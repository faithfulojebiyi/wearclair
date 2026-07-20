/// <reference types="bun" />
import { beforeEach, describe, expect, it } from 'bun:test';

import {
  QUEUE_TABLE,
  claimStore,
  clearAllLocalData,
  discardSyncIssues,
  getQueued,
  getSyncIssues,
  pruneQueue,
  quarantineQueued,
  recordVitals,
  retrySyncIssues,
  store,
} from './local-store';

const DAY_MS = 24 * 60 * 60 * 1000;

const vitals = [{ metric: 'skin_temp' as const, value: 36.5 }];

describe('local vitals store retention', () => {
  beforeEach(() => {
    clearAllLocalData();
  });

  it('prunes queued rows older than the max age', () => {
    const now = Date.now();

    recordVitals(now - 8 * DAY_MS, vitals);
    recordVitals(now - 1 * DAY_MS, vitals);

    pruneQueue(now);

    const remaining = getQueued();
    expect(remaining.length).toBe(1);
    expect(remaining[0]!.ts).toBe(now - 1 * DAY_MS);
  });

  it('prunes at runtime while recording, not only at persistence init', () => {
    const now = Date.now();

    // expired backlog left behind by an "offline period"
    recordVitals(now - 9 * DAY_MS, vitals);
    expect(getQueued().length).toBe(1);

    // a fresh emit >60s after the last prune triggers the throttled prune
    recordVitals(now, vitals);

    const remaining = getQueued();
    expect(remaining.length).toBe(1);
    expect(remaining[0]!.ts).toBe(now);
  });

  it('clearAllLocalData wipes tables and resets counters (sign-out path)', () => {
    recordVitals(Date.now(), vitals);
    store.setValue('syncPauseReason', 'auth');
    expect(getQueued().length).toBeGreaterThan(0);

    clearAllLocalData();

    expect(getQueued().length).toBe(0);
    expect(store.getRowIds(QUEUE_TABLE).length).toBe(0);
    expect(store.getValue('syncedTotal')).toBe(0);
    expect(store.getValue('connected')).toBe(false);
    expect(store.getValue('syncPauseReason')).toBeUndefined();
  });
});

describe('local store account isolation', () => {
  beforeEach(() => {
    clearAllLocalData();
  });

  it('re-claiming for the same user keeps the queue (session refresh, app restart)', () => {
    claimStore('user-a');
    recordVitals(Date.now(), vitals);

    expect(claimStore('user-a')).toBe(false);
    expect(getQueued().length).toBe(1);
    expect(store.getValue('ownerUserId')).toBe('user-a');
  });

  it('claiming for a different user destroys the previous owner health data', () => {
    claimStore('user-a');
    recordVitals(Date.now(), vitals);

    // wiped=true so callers also drop user-scoped caches
    expect(claimStore('user-b')).toBe(true);
    expect(getQueued().length).toBe(0);
    expect(store.getRowIds(QUEUE_TABLE).length).toBe(0);
    expect(store.getValue('ownerUserId')).toBe('user-b');
  });

  it('clearAllLocalData removes the owner stamp with the data', () => {
    claimStore('user-a');

    clearAllLocalData();

    expect(store.getValue('ownerUserId')).toBeUndefined();
  });
});

describe('local sync issues', () => {
  beforeEach(() => {
    clearAllLocalData();
  });

  it('moves permanently rejected readings out of the active queue', () => {
    recordVitals(Date.now(), vitals);
    const rowIds = getQueued().map((sample) => sample.rowId);

    quarantineQueued(rowIds, 'Server rejected these readings.');

    expect(getQueued()).toHaveLength(0);
    expect(getSyncIssues()).toEqual([
      expect.objectContaining({
        metric: 'skin_temp',
        reason: 'Server rejected these readings.',
      }),
    ]);
  });

  it('can retry or discard quarantined readings', () => {
    recordVitals(Date.now(), vitals);
    quarantineQueued(
      getQueued().map((sample) => sample.rowId),
      'Server rejected these readings.',
    );

    retrySyncIssues();
    expect(getQueued()).toHaveLength(1);
    expect(getSyncIssues()).toHaveLength(0);

    quarantineQueued(
      getQueued().map((sample) => sample.rowId),
      'Server rejected these readings.',
    );
    discardSyncIssues();
    expect(getQueued()).toHaveLength(0);
    expect(getSyncIssues()).toHaveLength(0);
  });
});
