// batch.synced retry schedule: due STALE_AFTER_MS * 2^attempts, capped at ~7 days
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
