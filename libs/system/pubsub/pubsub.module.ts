import { Global, Module } from '@nestjs/common';

import { PubSubService } from './pubsub.service';

// @Global so both the api (SSE subscribe) and worker (publish) resolve one
// PubSubService without re-importing.
@Global()
@Module({
  providers: [PubSubService],
  exports: [PubSubService],
})
export class PubSubModule {}
