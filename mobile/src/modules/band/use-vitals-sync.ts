import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { devicesControllerSyncDevice } from '@/api/generated/devices/devices';
import { clearQueued, getQueued, quarantineQueued, store } from './local-store';
import { decideSyncFailure, syncErrorDetails } from './sync-policy';
import { batchKeyFor } from './utils';

const FLUSH_MS = 8000;
const MAX_BATCH = 500;
// fallback refetch of derived views when the realtime signal doesn't arrive
const DERIVED_FALLBACK_MS = 10_000;

// device-local IANA zone — the server stamps local_day on raw rows with it and
// falls back to UTC when omitted. read per flush so zone changes are picked up.
const deviceTimezone = (): string | undefined => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
};

// background sync engine: every FLUSH_MS, drain the local unsynced queue and push it
// to the REAL ingest endpoint (POST /devices/:id/sync -> hypertable -> Inngest ->
// worker insights). On success the rows are removed locally and the server-derived
// queries (insights, series) are invalidated so the UI reflects the new data. Runs
// app-wide (mounted once, behind auth) so streaming and syncing are decoupled.
export const useVitalsSync = (
  deviceId: string | undefined,
  userId: string | undefined,
  refreshSession?: () => void | Promise<unknown>,
): void => {
  const queryClient = useQueryClient();
  const inFlight = useRef(false);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttempt = useRef(0);
  const nextAttemptAt = useRef(0);

  useEffect(() => {
    if (!deviceId || !userId) {
      return;
    }

    retryAttempt.current = 0;
    nextAttemptAt.current = 0;
    store.delValue('syncPauseReason');

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

      if (
        store.getValue('syncPauseReason') !== undefined ||
        Date.now() < nextAttemptAt.current
      ) {
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
        const timezone = deviceTimezone();

        await devicesControllerSyncDevice(deviceId, {
          clientBatchId,
          ...(timezone ? { timezone } : {}),
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
        retryAttempt.current = 0;
        nextAttemptAt.current = 0;

        // raw-backed views update synchronously with the ingest write
        queryClient.invalidateQueries({ queryKey: ['biomarkers'] });
        queryClient.invalidateQueries({ queryKey: ['devices'] });

        scheduleDerivedRefetch();
      } catch (error) {
        const decision = decideSyncFailure(
          syncErrorDetails(error),
          retryAttempt.current + 1,
        );

        if (decision.kind === 'retry') {
          retryAttempt.current += 1;
          nextAttemptAt.current = Date.now() + decision.delayMs;
        } else if (decision.kind === 'pause') {
          store.setValue('syncPauseReason', decision.reason);

          if (decision.reason === 'auth') {
            void refreshSession?.();
          } else {
            queryClient.invalidateQueries({ queryKey: ['devices'] });
          }
        } else {
          quarantineQueued(
            queued.map((sample) => sample.rowId),
            decision.reason,
          );
          retryAttempt.current = 0;
          nextAttemptAt.current = 0;
        }
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
  }, [deviceId, userId, queryClient, refreshSession]);
};
