import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { devicesControllerGetRealtimeToken } from '@/api/generated/devices/devices';

const RETRY_MIN_MS = 1_000;
const RETRY_MAX_MS = 30_000;

// data frame for our topic (the wire also carries lifecycle frames)
const isBatchProcessedMessage = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  'kind' in value &&
  value.kind === 'data' &&
  'topic' in value &&
  value.topic === 'batches';

/**
 * "derivation finished" push: subscribe to the user's inngest realtime channel
 * (native WebSocket — the SDK's subscribe() needs ReadableStream, which Hermes
 * lacks) and invalidate derived views when a batch is PROCESSED. reconnects
 * with backoff; a fresh token per attempt.
 */
export const useSyncUpdates = (enabled: boolean): void => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryMs = RETRY_MIN_MS;
    let closed = false;

    const scheduleRetry = () => {
      if (closed || retryTimer) {
        return;
      }

      retryTimer = setTimeout(() => {
        retryTimer = null;
        void connect();
      }, retryMs);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    };

    const connect = async () => {
      try {
        const token = await devicesControllerGetRealtimeToken();

        if (closed) {
          return;
        }

        // string-built ws url: react-native's URL has no working searchParams
        const base = token.apiBaseUrl
          .replace(/^http/, 'ws')
          .replace(/\/+$/, '');
        ws = new WebSocket(
          `${base}/v1/realtime/connect?token=${encodeURIComponent(token.key)}`,
        );

        ws.onopen = () => {
          retryMs = RETRY_MIN_MS;
        };

        ws.onmessage = (event) => {
          let message: unknown;

          try {
            message = JSON.parse(String(event.data));
          } catch {
            return;
          }

          if (isBatchProcessedMessage(message)) {
            queryClient.invalidateQueries({ queryKey: ['insights'] });
            queryClient.invalidateQueries({ queryKey: ['cycle'] });
            // the worker re-derives local-day insights from the raw samples
            queryClient.invalidateQueries({ queryKey: ['biomarkers'] });
          }
        };

        ws.onclose = () => scheduleRetry();
        ws.onerror = () => ws?.close();
      } catch {
        scheduleRetry();
      }
    };

    void connect();

    return () => {
      closed = true;

      if (retryTimer) {
        clearTimeout(retryTimer);
      }

      ws?.close();
    };
  }, [enabled, queryClient]);
};
