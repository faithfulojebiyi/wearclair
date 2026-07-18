import { InngestFunction } from 'inngest';

import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { deviceBatchSyncedEvent } from '@worker/modules/insights/queues/device-batch-synced.event';
import { refreshHealthInsightsEvent } from '@worker/modules/insights/queues/refresh-health-insights.event';
import { WorkerService } from '@worker/worker.service';

import { failedEvents } from './failed-events.function';
import { hello } from './hello.function';

// queue consumers are thin — they dispatch CQRS commands/queries onto the bus.
export const getInngestRegistry = ({
  workerService,
  commandBus,
  queryBus,
}: {
  workerService: WorkerService;
  commandBus: CommandBus;
  queryBus: QueryBus;
}): InngestFunction.Any[] => {
  return [
    hello({ workerService }),

    // insights
    deviceBatchSyncedEvent({ commandBus, queryBus }),
    refreshHealthInsightsEvent({ commandBus, queryBus }),

    failedEvents(),
  ];
};
