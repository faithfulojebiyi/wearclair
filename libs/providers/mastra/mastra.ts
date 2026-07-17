import type { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { PostgresStore } from '@mastra/pg';
import { RedisStreamsPubSub } from '@mastra/redis-streams';

import { helloAgent } from './agents/hello.agent';

// the Mastra runtime (mirrors a `src/mastra/index.ts`). Storage lives in its OWN
// Postgres database (MASTRA_DATABASE_URL) — fully separate from the Prisma-managed
// app database, so Mastra's runtime DDL never collides with `prisma migrate`.
// Tables are created by PostgresStore at first boot.
//
// Built lazily: `PostgresStore` reads MASTRA_DATABASE_URL, which is only populated
// once ConfigModule has loaded the app's .env. Constructing at import time would
// run before that and throw `MASTRA_STORAGE_PG_INITIALIZATION_FAILED`. Callers
// resolve it via getMastra() (DI factories / accessors), never at import time.
let instance: Mastra | undefined;

// `extraAgents` lets the app register DI-built domain agents (e.g. the legal
// assistant, whose tools inject wearclair services) into the runtime. The api
// passes them; the worker (workflows only) calls getMastra() with none.
export function getMastra(extraAgents?: Record<string, Agent>): Mastra {
  if (!instance) {
    const connectionString = process.env.MASTRA_DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'MASTRA_DATABASE_URL is required to initialize the Mastra PostgresStore',
      );
    }

    const storage = new PostgresStore({
      id: 'wearclair-mastra',
      connectionString,
    });

    // Distributed pub/sub over Valkey so workflow run/step events propagate across
    // processes (api/agent triggers ⇄ worker executes) — the default in-process
    // EventEmitterPubSub can't bridge processes, so cross-process run results /
    // streamed progress would never arrive. Falls back to the default when no
    // Redis URL is configured.
    const redisUrl = process.env.APP_REDIS_URL;
    const pubsub = redisUrl
      ? new RedisStreamsPubSub({ url: redisUrl, keyPrefix: 'wearclair-mastra' })
      : undefined;

    instance = new Mastra({
      agents: { hello: helloAgent, ...(extraAgents ?? {}) },
      storage,
      ...(pubsub ? { pubsub } : {}),
    });
  }

  return instance;
}
