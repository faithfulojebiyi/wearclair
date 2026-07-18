import './load-env'; // must be first — populates process.env before the Inngest clients construct

import { serve } from 'inngest/fastify';
import { Logger } from 'nestjs-pino';
import { v7 as uuidv7 } from 'uuid';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';

import compression from '@fastify/compress';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';

import { inngest } from './modules/event-publisher/event-publisher.service';
import { getInngestRegistry } from './modules/event-publisher/inngest.registry';
import { WorkerModule } from './worker.module';
import { WorkerService } from './worker.service';

async function bootstrap() {
  process.env.APP_NAME ??= 'wearclair_worker';

  const app = await NestFactory.create<NestFastifyApplication>(
    WorkerModule,
    new FastifyAdapter({
      requestIdHeader: 'x-request-id',
      genReqId: () => uuidv7(),
    }),
    { rawBody: true, bufferLogs: true },
  );

  app.useLogger(app.get(Logger));

  // SIGTERM/SIGINT run onModuleDestroy — prisma (primary + replica) disconnects cleanly
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);

  await app.register(fastifyMultipart, {
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  const apiPrefix = configService.get<string>('API_PREFIX') || '/';

  app.setGlobalPrefix(apiPrefix);

  // no CORS: the worker serves only Inngest (server-to-server) — browsers never call it.

  await app.register(helmet);
  await app.register(cookie);
  await app.register(compression);

  // mount inngest on the underlying fastify instance — this is where the worker's
  // functions are served and synced against Inngest.
  const fastifyInstance = app.getHttpAdapter().getInstance();
  const workerService = app.get(WorkerService);
  const commandBus = app.get(CommandBus);
  const queryBus = app.get(QueryBus);
  fastifyInstance.route({
    method: ['GET', 'POST', 'PUT'],
    url: `${apiPrefix}api/inngest`,
    handler: serve({
      client: inngest,
      functions: getInngestRegistry({
        workerService,
        commandBus,
        queryBus,
      }),
    }),
  });

  await app.listen(process.env.PORT ?? 3311, '0.0.0.0');
}

void bootstrap();
