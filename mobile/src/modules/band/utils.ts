import { QueuedSample } from './local-store';

// sync idempotency key derived from the batch CONTENT, not just its shape:
// first/last ts + count alone collide when a middle row differs (e.g. pruning
// between retries), and the server rejects a reused key whose stored content
// hash no longer matches (409) — the key must change whenever the rows do.
export const batchKeyFor = (rows: QueuedSample[]): string => {
  const input = rows
    .map((row) => `${row.ts}|${row.metric}|${row.value}`)
    .join('\n');

  // fnv1a — same tiny deterministic hash the band simulator seeds with
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  const content = (hash >>> 0).toString(16).padStart(8, '0');

  return `batch-${rows[0].ts}-${rows[rows.length - 1].ts}-${rows.length}-${content}`;
};

// fine-grained "Ns / N min / N h ago" for recent sync timestamps (millis).
export const relativeTimeMs = (ms: number): string => {
  const seconds = Math.round((Date.now() - ms) / 1000);

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.round(seconds / 60);

  return minutes < 60
    ? `${minutes} min ago`
    : `${Math.round(minutes / 60)} h ago`;
};
