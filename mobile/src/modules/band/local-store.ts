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

// best-effort persistence: browser storage on web, expo-sqlite on native — resolved
// via the platform-split local-persister(.web).ts twins so the wrong platform's
// driver never enters the bundle (Metro statically bundles even dynamic imports).
// A failure here must never break streaming.
let persisterStarted = false;

export const initPersistence = async (): Promise<void> => {
  if (persisterStarted) {
    return;
  }

  persisterStarted = true;

  try {
    const { createPlatformPersister } = await import('./local-persister');
    const persister = await createPlatformPersister(store);
    await persister.load();
    await persister.startAutoSave();
  } catch {
    persisterStarted = false;
    // in-memory only — streaming + sync still work, data just won't survive restart
  }
};
