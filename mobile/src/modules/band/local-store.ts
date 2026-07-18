import { createStore, Store } from 'tinybase';

import { BiomarkerMetric } from '@/api/generated/wearclairAPI.schemas';
import { Vital } from './band-sim';

// The device's local-first source of truth for raw vitals. Samples land here FIRST
// (offline-capable, reactive, persisted); a background engine later syncs the
// unsynced queue to the backend. Two tables:
//   latest  — rowId=metric -> { value, ts }   (newest reading per sensor; drives live UI)
//   queue   — rowId=`ts_metric` -> { ts, metric, value }  (unsynced upload backlog)
// and values: connected, streaming stats, lastSyncTs.
export const store: Store = createStore()
  .setValue('connected', false)
  .setValue('lastEmitTs', 0)
  .setValue('lastSyncTs', 0)
  .setValue('syncedTotal', 0);

export const LATEST_TABLE = 'latest';
export const QUEUE_TABLE = 'queue';

// retention limits must hold while the app RUNS, not just across restarts — an
// offline app kept open would otherwise grow past them. pruning scans the queue,
// so it's throttled rather than run on every emit.
const PRUNE_INTERVAL_MS = 60_000;

let lastPruneTs = 0;

// append one instant's worth of vitals: newest-per-metric for the UI, plus the
// upload queue.
export const recordVitals = (ts: number, vitals: Vital[]): void => {
  store.transaction(() => {
    for (const { metric, value } of vitals) {
      store.setRow(LATEST_TABLE, metric, { value, ts });
      store.setRow(QUEUE_TABLE, `${ts}_${metric}`, { ts, metric, value });
    }

    store.setValue('lastEmitTs', ts);
  });

  if (ts - lastPruneTs >= PRUNE_INTERVAL_MS) {
    lastPruneTs = ts;
    pruneQueue(ts);
  }
};

export interface QueuedSample {
  rowId: string;
  ts: number;
  metric: BiomarkerMetric;
  value: number;
}

export const getQueued = (): QueuedSample[] =>
  store.getRowIds(QUEUE_TABLE).map((rowId) => {
    const row = store.getRow(QUEUE_TABLE, rowId);

    return {
      rowId,
      ts: Number(row.ts),
      metric: row.metric as BiomarkerMetric,
      value: Number(row.value),
    };
  });

export const clearQueued = (rowIds: string[], syncedTs: number): void => {
  store.transaction(() => {
    for (const rowId of rowIds) {
      store.delRow(QUEUE_TABLE, rowId);
    }

    store.setValue('lastSyncTs', syncedTs);
    store.setValue(
      'syncedTotal',
      Number(store.getValue('syncedTotal') ?? 0) + rowIds.length,
    );
  });
};

// retention guard for the persisted queue: extended offline periods must not grow
// health data on-device without bound. drops rows past MAX_AGE, then the oldest
// rows over MAX_ROWS.
const QUEUE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const QUEUE_MAX_ROWS = 100_000;

export const pruneQueue = (now: number = Date.now()): void => {
  const rows = getQueued();
  const cutoff = now - QUEUE_MAX_AGE_MS;

  const expired = rows.filter((row) => row.ts < cutoff);
  const kept = rows.filter((row) => row.ts >= cutoff);
  const overflow =
    kept.length > QUEUE_MAX_ROWS
      ? kept
          .sort((a, b) => a.ts - b.ts)
          .slice(0, kept.length - QUEUE_MAX_ROWS)
      : [];

  const drop = [...expired, ...overflow];

  if (drop.length === 0) {
    return;
  }

  store.transaction(() => {
    for (const row of drop) {
      store.delRow(QUEUE_TABLE, row.rowId);
    }
  });
};

// user-scoped device state (latest readings + unsynced queue + counters) — cleared
// on sign-out so the next account never sees the previous one's vitals. autoSave
// propagates the wipe to the platform persister.
export const clearAllLocalData = (): void => {
  store.transaction(() => {
    store.delTables();
    store.delValue('ownerUserId');
    store.setValue('connected', false);
    store.setValue('lastEmitTs', 0);
    store.setValue('lastSyncTs', 0);
    store.setValue('syncedTotal', 0);
  });
};

// single-owner guard for the (persisted) store: the store is stamped with the
// account it belongs to, and a different account claiming it destroys the previous
// one's health data — including anything a dead session's cleanup never wiped —
// before it can be shown or uploaded. autoSave propagates the wipe to disk. Claim
// only after the persisted snapshot has loaded (initPersistence), or the previous
// owner's snapshot would overwrite the claim.
export const claimStore = (userId: string): void => {
  const owner = store.getValue('ownerUserId');

  if (owner !== undefined && owner !== userId) {
    clearAllLocalData();
  }

  store.setValue('ownerUserId', userId);
};

// best-effort persistence: browser storage on web, expo-sqlite on native — resolved
// via the platform-split local-persister(.web).ts twins so the wrong platform's
// driver never enters the bundle (Metro statically bundles even dynamic imports).
// A failure here must never break streaming. Memoized promise so callers (the
// account-isolation guard) can await "persisted snapshot is loaded".
let persistencePromise: Promise<void> | null = null;

export const initPersistence = (): Promise<void> => {
  persistencePromise ??= (async () => {
    try {
      const { createPlatformPersister } = await import('./local-persister');
      const persister = await createPlatformPersister(store);
      await persister.load();
      // apply retention to whatever a previous session left behind
      pruneQueue();
      await persister.startAutoSave();
    } catch {
      // in-memory only — streaming + sync still work, data just won't survive
      // restart. reset so a later call may retry.
      persistencePromise = null;
    }
  })();

  return persistencePromise;
};
