import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { devicesControllerSyncDevice } from '@/api/generated/devices/devices';
import { clearQueued, getQueued } from './local-store';

const FLUSH_MS = 8000;
const MAX_BATCH = 500;

// background sync engine: every FLUSH_MS, drain the local unsynced queue and push it
// to the REAL ingest endpoint (POST /devices/:id/sync -> hypertable -> Inngest ->
// worker insights). On success the rows are removed locally and the server-derived
// queries (insights, series) are invalidated so the UI reflects the new data. Runs
// app-wide (mounted once, behind auth) so streaming and syncing are decoupled.
export const useVitalsSync = (deviceId: string | undefined): void => {
  const queryClient = useQueryClient();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!deviceId) {
      return;
    }

    const flush = async () => {
      if (inFlight.current) {
        return;
      }

      const queued = getQueued().slice(0, MAX_BATCH);

      if (queued.length === 0) {
        return;
      }

      inFlight.current = true;

      // deterministic idempotency key: a retry of the same rows reuses the same
      // server-side batch (and event id) instead of minting a duplicate
      const clientBatchId = `batch-${queued[0].ts}-${queued[queued.length - 1].ts}-${queued.length}`;

      try {
        await devicesControllerSyncDevice(deviceId, {
          clientBatchId,
          samples: queued.map((sample) => ({
            ts: new Date(sample.ts).toISOString(),
            metric: sample.metric,
            value: sample.value,
          })),
        });

        clearQueued(
          queued.map((sample) => sample.rowId),
          Date.now(),
        );

        queryClient.invalidateQueries({ queryKey: ['insights'] });
        queryClient.invalidateQueries({ queryKey: ['biomarkers'] });
        queryClient.invalidateQueries({ queryKey: ['devices'] });
      } catch {
        // keep the rows queued; next tick retries (offline-tolerant)
      } finally {
        inFlight.current = false;
      }
    };

    const interval = setInterval(flush, FLUSH_MS);

    return () => clearInterval(interval);
  }, [deviceId, queryClient]);
};
