import { eventType } from 'inngest';

import {
  DeviceBatchSyncedDto,
  deviceBatchSyncedSchema,
} from './dto/device-batch-synced.dto';
import { HelloWorldDto, helloWorldSchema } from './dto/hello-world.dto';

export const EVENT_KEYS = {
  HELLO_WORLD: 'job/hello.world',
  DEVICE_BATCH_SYNCED: 'device/batch.synced',

  // inngest's built-in event fired when a function exhausts its retries
  FAILED_EVENT: 'inngest/function.failed',
} as const;

// typed map of event name -> payload shape. add an entry per event so types
// flow through the publisher and consumers.
export type EventsRecord = {
  [EVENT_KEYS.HELLO_WORLD]: {
    data: HelloWorldDto;
  };
  [EVENT_KEYS.DEVICE_BATCH_SYNCED]: {
    data: DeviceBatchSyncedDto;
  };
};

export const INNGEST_OPTIONS = {
  retries: 1 as const,
};

// the inngest event registry — pairs each event key with its zod schema so
// `createFunction({ triggers: [EVENTS.X] })` and `sendEvent` stay type-safe.
export const EVENTS = {
  HELLO_WORLD: eventType(EVENT_KEYS.HELLO_WORLD, { schema: helloWorldSchema }),
  DEVICE_BATCH_SYNCED: eventType(EVENT_KEYS.DEVICE_BATCH_SYNCED, {
    schema: deviceBatchSyncedSchema,
  }),
};
