import { z } from 'zod';

// ingest lifecycle for SyncBatch.status: RECEIVED (row exists, raw write pending)
// → RAW_WRITTEN (tsdb has the samples; derivation event may not have landed)
// → PUBLISHED (event accepted by inngest) → PROCESSED (worker derived insights).
// FAILED = raw write failed. the db column is a plain string (no ALTER TYPE
// migrations); this schema is the boundary validator and the source of the type.
export const SyncBatchStatusSchema = z
  .enum(['RECEIVED', 'RAW_WRITTEN', 'PUBLISHED', 'PROCESSED', 'FAILED'])
  .meta({ id: 'SyncBatchStatus' });

export type SyncBatchStatus = z.infer<typeof SyncBatchStatusSchema>;

export const SYNC_BATCH_STATUS = SyncBatchStatusSchema.enum;
