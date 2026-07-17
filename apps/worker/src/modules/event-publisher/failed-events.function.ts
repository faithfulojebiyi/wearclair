import { Logger } from '@nestjs/common';

import { EVENT_KEYS, INNGEST_OPTIONS } from '@system/queues/events.config';

import { inngest } from './event-publisher.service';

const logger = new Logger('FailedEvents');

// fired by inngest when any function exhausts its retries. log it so failures
// are visible; wire up alerting (slack/sentry/etc) here as needed.
export const failedEvents = () => {
  return inngest.createFunction(
    {
      id: 'failed-events',
      ...INNGEST_OPTIONS,
      triggers: { event: EVENT_KEYS.FAILED_EVENT },
    },
    async ({ event }) => {
      logger.error(
        `inngest function failed: ${event.data.function_id}`,
        event.data.error?.stack,
      );
    },
  );
};
