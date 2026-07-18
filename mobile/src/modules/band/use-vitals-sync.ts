import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { devicesControllerSyncDevice } from '@/api/generated/devices/devices';
import { clearQueued, getQueued, store } from './local-store';
import { batchKeyFor } from './utils';

const FLUSH_MS = 8000;
const MAX_BATCH = 500;
// fallback refetch of derived views when the realtime signal doesn't arrive
const DERIVED_FALLBACK_MS = 10_000;

// background sync engine: every FLUSH_MS, drain the local unsynced queue and push it
// to the REAL ingest endpoint (POST /devices/:id/sync -> hypertable -> Inngest ->
// worker insights). On success the rows are removed locally and the server-derived
// queries (insights, series) are invalidated so the UI reflects the new data. Runs
// app-wide (mounted once, behind auth) so streaming and syncing are decoupled.
export const useVitalsSync = (
  deviceId: string | undefined,
  userId: string | undefined,
): void => {
  const queryClient = useQueryClient();
  const inFlight = useRef(false);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!deviceId || !userId) {
      return;
    }

    /**
     * derived views are computed AFTER the sync response — the realtime signal
     * (use-sync-updates) refetches them; this timer covers realtime being down.
     */
    const scheduleDerivedRefetch = () => {
      if (fallbackTimer.current) {
        clearTimeout(fallbackTimer.current);
      }

      fallbackTimer.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['insights'] });
        queryClient.invalidateQueries({ queryKey: ['cycle'] });
      }, DERIVED_FALLBACK_MS);
    };

    const flush = async () => {
      if (inFlight.current) {
        return;
      }

      // never upload a queue this account doesn't own
      if (store.getValue('ownerUserId') !== userId) {
        return;
      }

      const queued = getQueued().slice(0, MAX_BATCH);

      if (queued.length === 0) {
        return;
      }

      inFlight.current = true;

      // content-derived idempotency key — retries reuse the batch, different rows never collide
      const clientBatchId = batchKeyFor(queued);

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

        // raw-backed views update synchronously with the ingest write
        queryClient.invalidateQueries({ queryKey: ['biomarkers'] });
        queryClient.invalidateQueries({ queryKey: ['devices'] });

        scheduleDerivedRefetch();
      } catch {
        // keep the rows queued; next tick retries (offline-tolerant)
      } finally {
        inFlight.current = false;
      }
    };

    const interval = setInterval(flush, FLUSH_MS);

    return () => {
      clearInterval(interval);

      if (fallbackTimer.current) {
        clearTimeout(fallbackTimer.current);
        fallbackTimer.current = null;
      }
    };
  }, [deviceId, userId, queryClient]);
};
