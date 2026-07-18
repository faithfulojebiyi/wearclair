import { InngestFunctionDto } from '@worker/modules/event-publisher/event-publisher.dto';
import { inngest } from '@worker/modules/event-publisher/event-publisher.service';
import { ClassifyAndUpsertHealthInsightsCommand } from '@worker/modules/insights/commands/classify-and-upsert-health-insights';
import { LoadDailyStatsQuery } from '@worker/modules/insights/queries/load-daily-stats';

import { EVENTS, INNGEST_OPTIONS } from '@system/queues/events.config';

// the AI-generated Insights feed, decoupled from ingest. debounce coalesces a burst
// of syncs into ONE run per user (timeout caps the delay for continuous syncers), and
// the command's signature gate skips Opus entirely when the day's numbers are unchanged.
export const refreshHealthInsightsEvent = ({
  commandBus,
  queryBus,
}: InngestFunctionDto) => {
  return inngest.createFunction(
    {
      id: 'refresh-health-insights',
      ...INNGEST_OPTIONS,
      debounce: { period: '10m', timeout: '30m', key: 'event.data.userId' },
      triggers: [EVENTS.DEVICE_BATCH_SYNCED],
    },
    async ({ event, step }) => {
      // fresh load: debounce delivers the LAST event in the window
      const stats = await step.run('load-daily-stats', async () =>
        queryBus.execute(new LoadDailyStatsQuery(event.data)),
      );

      return step.run('refresh-health-insights', async () =>
        commandBus.execute(
          new ClassifyAndUpsertHealthInsightsCommand(event.data, stats),
        ),
      );
    },
  );
};
