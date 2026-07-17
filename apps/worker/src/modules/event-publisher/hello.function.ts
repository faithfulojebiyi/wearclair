import { WorkerService } from '@worker/worker.service';

import { EVENTS, INNGEST_OPTIONS } from '@system/queues/events.config';

import { inngest } from './event-publisher.service';

export const hello = (deps: { workerService: WorkerService }) => {
  return inngest.createFunction(
    { id: 'hello-world', ...INNGEST_OPTIONS, triggers: [EVENTS.HELLO_WORLD] },
    async ({ step }) => {
      return step.run('get-hello', async () => deps.workerService.getHello());
    },
  );
};
