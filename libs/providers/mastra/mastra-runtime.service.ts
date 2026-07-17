import { Injectable } from '@nestjs/common';

import { getMastra } from './mastra';

// Minimal DI accessor over the Mastra runtime for the worker, which runs
// background jobs and must NOT mount the HTTP adapter (@providers/mastra/nestjs)
// — that serves /mastra/* agent routes and needs the Fastify HttpAdapterHost.
// The api uses the nestjs adapter's MastraService instead; this is the non-HTTP
// counterpart for resolving agents/workflows inside jobs.
//
// The Mastra instance is resolved lazily via getMastra() so its PostgresStore is
// built after ConfigModule has populated APP_DATABASE_URL, never at import time.
@Injectable()
export class MastraRuntimeService {
  get instance() {
    return getMastra();
  }

  getAgent(id: Parameters<ReturnType<typeof getMastra>['getAgent']>[0]) {
    return getMastra().getAgent(id);
  }
}
