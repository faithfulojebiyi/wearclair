import { z } from 'zod';

import { dateToString } from '@system/schema/utils';
import { biomarkerSampleSchema } from '@system/timeseries/timeseries.schema';

export const RegisterDeviceSchema = z
  .object({
    name: z.string().min(1).max(100),
    model: z.string().min(1).max(100).optional(),
  })
  .meta({ id: 'RegisterDevice' });

export const DeviceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    model: z.string(),
    lastSyncedAt: dateToString.nullable(),
    createdAt: dateToString,
  })
  .meta({ id: 'Device' });

export const DeviceListSchema = z
  .object({
    devices: z.array(DeviceSchema),
  })
  .meta({ id: 'DeviceList' });

const isIanaTimezone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });

    return true;
  } catch {
    return false;
  }
};

// the real ingest contract — what a BLE-synced device batch looks like on the wire.
// 20k samples ≈ a full day of 5 metrics at 5-minute resolution, with headroom.
// clientBatchId: client-generated idempotency key — retries of the same batch reuse
// the SyncBatch row and event id instead of minting duplicates.
// timezone: device-local IANA zone — stamps local_day on raw rows and refreshes
// User.timezone; omitted (old clients) falls back to UTC.
export const IngestBatchSchema = z
  .object({
    samples: z.array(biomarkerSampleSchema).min(1).max(20000),
    clientBatchId: z.string().min(8).max(128).optional(),
    timezone: z
      .string()
      .max(64)
      .refine(isIanaTimezone, 'invalid IANA timezone')
      .optional(),
  })
  .meta({ id: 'IngestBatch' });

export const SyncResultSchema = z
  .object({
    batchId: z.string(),
    accepted: z.number().int(),
    windowStart: dateToString,
    windowEnd: dateToString,
  })
  .meta({ id: 'SyncResult' });

// subscription token for the user's inngest realtime channel: apiBaseUrl is where
// the client opens the websocket (dev server locally, inngest cloud in prod).
export const RealtimeTokenSchema = z
  .object({
    key: z.string(),
    apiBaseUrl: z.string(),
    channel: z.string(),
    topics: z.array(z.string()),
  })
  .meta({ id: 'RealtimeToken' });
