import { channel } from 'inngest/realtime';
import { z } from 'zod';

// per-user realtime push channel (inngest realtime). The worker publishes
// lifecycle completions here and clients subscribe via an api-minted token, so
// server-derived views refresh the moment background derivation lands instead of
// racing it with an immediate refetch. Cross-app boundary — schema lives with the
// other queue contracts.
export const SyncBatchProcessedSchema = z
  .object({
    batchId: z.string(),
    status: z.literal('PROCESSED'),
  })
  .meta({ id: 'SyncBatchProcessed' });

export type SyncBatchProcessed = z.infer<typeof SyncBatchProcessedSchema>;

export const userChannel = channel({
  name: ({ userId }: { userId: string }) => `user:${userId}`,
  topics: {
    batches: { schema: SyncBatchProcessedSchema },
  },
});

export const USER_CHANNEL_TOPICS = ['batches'] as const;
