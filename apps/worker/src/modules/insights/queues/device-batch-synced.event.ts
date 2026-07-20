import { InngestFunctionDto } from '@worker/modules/event-publisher/event-publisher.dto';
import { inngest } from '@worker/modules/event-publisher/event-publisher.service';
import { ClassifyAndUpsertInsightsCommand } from '@worker/modules/insights/commands/classify-and-upsert-insights';
import { MarkBatchProcessedCommand } from '@worker/modules/insights/commands/mark-batch-processed';
import { LoadDailyStatsQuery } from '@worker/modules/insights/queries/load-daily-stats';

import { EVENTS, INNGEST_OPTIONS } from '@system/queues/events.config';
import { userChannel } from '@system/queues/realtime.config';

// queue consumer for `device/batch.synced` — derive daily insight numbers from raw
// samples grouped by device-local day. Steps are independently retryable: a tsdb read
// failure never recomputes the app-db writes. The event id (device-batch-<id>) dedupes
// redeliveries, and the upsert-based derivation is idempotent on top of that. The AI
// narrative feed is a SEPARATE, debounced function (refresh-health-insights.event.ts).
export const deviceBatchSyncedEvent = ({
  commandBus,
  queryBus,
}: InngestFunctionDto) => {
  return inngest.createFunction(
    {
      id: 'compute-daily-insights',
      ...INNGEST_OPTIONS,
      triggers: [EVENTS.DEVICE_BATCH_SYNCED],
    },
    async ({ event, step }) => {
      const stats = await step.run('load-daily-stats', async () =>
        queryBus.execute(new LoadDailyStatsQuery(event.data)),
      );

      const { upserted } = await step.run('classify-and-upsert', async () =>
        commandBus.execute(
          new ClassifyAndUpsertInsightsCommand(event.data, stats),
        ),
      );

      await step.run('mark-batch-processed', async () =>
        commandBus.execute(new MarkBatchProcessedCommand(event.data.batchId)),
      );

      // push "derivation finished" — the ingest response returned before this ran
      await step.realtime.publish(
        'notify-batch-processed',
        userChannel({ userId: event.data.userId }).batches,
        { batchId: event.data.batchId, status: 'PROCESSED' },
      );

      return { upserted };
    },
  );
};
