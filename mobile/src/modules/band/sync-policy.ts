import { isAxiosError } from 'axios';

const RETRY_BASE_MS = 8_000;
const RETRY_MAX_MS = 5 * 60_000;

export interface SyncErrorDetails {
  status?: number;
  retryAfter?: string;
}

export type SyncFailureDecision =
  | { kind: 'retry'; delayMs: number }
  | { kind: 'pause'; reason: 'auth' | 'device' }
  | { kind: 'quarantine'; reason: string };

const retryAfterMs = (
  value: string | undefined,
  now: number,
): number | undefined => {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);
  const delay = Number.isFinite(seconds)
    ? seconds * 1_000
    : Date.parse(value) - now;

  if (!Number.isFinite(delay)) {
    return undefined;
  }

  return Math.min(RETRY_MAX_MS, Math.max(1_000, delay));
};

export const syncErrorDetails = (error: unknown): SyncErrorDetails => {
  if (!isAxiosError(error)) {
    return {};
  }

  const rawRetryAfter = error.response?.headers?.['retry-after'];
  const retryAfter = Array.isArray(rawRetryAfter)
    ? String(rawRetryAfter[0])
    : rawRetryAfter === undefined
      ? undefined
      : String(rawRetryAfter);

  return { status: error.response?.status, retryAfter };
};

export const decideSyncFailure = (
  details: SyncErrorDetails,
  attempt: number,
  now: number = Date.now(),
  random: () => number = Math.random,
): SyncFailureDecision => {
  if (details.status === 401 || details.status === 403) {
    return { kind: 'pause', reason: 'auth' };
  }

  if (details.status === 404) {
    return { kind: 'pause', reason: 'device' };
  }

  const retryable =
    details.status === undefined ||
    details.status === 408 ||
    details.status === 429 ||
    details.status >= 500;

  if (!retryable) {
    return {
      kind: 'quarantine',
      reason: 'Server rejected these readings.',
    };
  }

  const headerDelay =
    details.status === 429 ? retryAfterMs(details.retryAfter, now) : undefined;
  const exponential = RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1);
  const jittered = exponential * (0.75 + random() * 0.5);

  return {
    kind: 'retry',
    delayMs: headerDelay ?? Math.min(RETRY_MAX_MS, Math.round(jittered)),
  };
};
