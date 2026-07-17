import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// payload for 'device/batch.synced' — published by the api after a batch lands in
// the tsdb; consumed by the worker to derive daily insights. Dates travel as ISO
// strings (event payloads are plain JSON). The publisher merges `user` in — don't
// add it here.
export const deviceBatchSyncedSchema = z
  .object({
    batchId: z.string(),
    deviceId: z.string(),
    userId: z.string(),
    windowStart: z.iso.datetime(),
    windowEnd: z.iso.datetime(),
    sampleCount: z.number().int(),
  })
  .meta({ id: 'DeviceBatchSynced' });

export class DeviceBatchSyncedDto extends createZodDto(
  deviceBatchSyncedSchema,
) {}
