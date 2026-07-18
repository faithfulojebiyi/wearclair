import { InngestFunction } from 'inngest';

import { CommandBus } from '@nestjs/cqrs';

import { ApiService } from '@api/api.service';

import { failedEvents } from './failed-events.function';
import { hello } from './hello.function';
import { recoverStaleBatches } from './recover-stale-batches.function';

export const getInngestRegistry = ({
  apiService,
  commandBus,
}: {
  apiService: ApiService;
  commandBus: CommandBus;
}): InngestFunction.Any[] => {
  return [
    hello({ apiService }),
    recoverStaleBatches({ commandBus }),
    failedEvents(),
  ];
};
