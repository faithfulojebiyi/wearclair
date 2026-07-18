// retry schedule for the batch.synced derivation event. a batch becomes due
// STALE_AFTER_MS * 2^attempts after each (re)publish attempt — retries never
// stop, they back off, capped at ~7-day intervals (2^10 * 10min).
export const STALE_AFTER_MS = 10 * 60 * 1000;
export const MAX_BACKOFF_EXPONENT = 10;

export const nextPublishAttemptAt = (
  publishAttempts: number,
  from = new Date(),
): Date =>
  new Date(
    from.getTime() +
      STALE_AFTER_MS * 2 ** Math.min(publishAttempts, MAX_BACKOFF_EXPONENT),
  );
