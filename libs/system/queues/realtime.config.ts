import { channel } from 'inngest/realtime';
import { z } from 'zod';

/**
 * per-user realtime channel: worker publishes lifecycle completions, clients
 * subscribe via an api-minted token.
 */
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
