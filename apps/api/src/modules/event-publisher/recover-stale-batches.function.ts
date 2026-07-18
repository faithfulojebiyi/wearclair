import { CommandBus } from '@nestjs/cqrs';

import { RepublishStaleBatchesCommand } from '@api/modules/devices/commands/republish-stale-batches';
import { INNGEST_OPTIONS } from '@system/queues/events.config';

import { inngest } from './event-publisher.service';

// recovery sweep for the ingest outbox: batches whose raw tsdb write landed but
// whose derivation event never reached inngest stay RAW_WRITTEN — republish them
// on a schedule so raw data is never left underived.
export const recoverStaleBatches = (deps: { commandBus: CommandBus }) => {
  return inngest.createFunction(
    {
      id: 'recover-stale-batches',
      ...INNGEST_OPTIONS,
      triggers: [{ cron: '*/10 * * * *' }],
    },
    async ({ step }) => {
      return step.run('republish-stale-batches', async () =>
        deps.commandBus.execute(new RepublishStaleBatchesCommand()),
      );
    },
  );
};
