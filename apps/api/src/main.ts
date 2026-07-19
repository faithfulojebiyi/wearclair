import './load-env'; //

import { fromNodeHeaders } from 'better-auth/node';
import { serve } from 'inngest/fastify';
import { Logger } from 'nestjs-pino';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { v7 as uuidv7 } from 'uuid';

import { auth } from '@system/auth/auth';
import { parseTrustProxy } from '@system/env/trust-proxy';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { CommandBus } from '@nestjs/cqrs';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import compression from '@fastify/compress';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';

import { ApiModule } from './api.module';
import { ApiService } from './api.service';
import { inngest } from './modules/event-publisher/event-publisher.service';
import { getInngestRegistry } from './modules/event-publisher/inngest.registry';
import { sanitizeOpenApiDoc } from './openapi-sanitizer';

async function bootstrap() {
  process.env.APP_NAME ??= 'wearclair_api';

  const app = await NestFactory.create<NestFastifyApplication>(
    ApiModule,
    new FastifyAdapter({
      // use the upstream x-request-id as req.id, else a uuid v7
      requestIdHeader: 'x-request-id',
      genReqId: () => uuidv7(),
      // device batch ingest: 20k samples ≈ 1.5 MB JSON — fastify's 1 MB default is too low
      bodyLimit: 10 * 1024 * 1024,
      // behind the LB request.ip must come from x-forwarded-for, or every client
      // shares the proxy's IP (one abuser rate-limits everyone)
      trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
    }),
    { rawBody: true, bufferLogs: true },
  );

  app.useLogger(app.get(Logger));

  // SIGTERM/SIGINT run onModuleDestroy — prisma (primary + replica) disconnects cleanly
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);

  await app.register(fastifyMultipart, {
    // parts are buffered in memory downstream — cap counts, not just file size,
    // so a single many-part request can't balloon the heap
    limits: {
      fileSize: 50 * 1024 * 1024, // 50mb max file size
      files: 5,
      fields: 50,
      parts: 60,
      fieldSize: 1024 * 1024,
    },
  });

  const apiPrefix = configService.get<string>('API_PREFIX') || '/';

  app.setGlobalPrefix(apiPrefix);

  // credentialed CORS can't use a wildcard origin — reflect an explicit allowlist.
  // reuse the better-auth trusted origins (dashboard + api frontends).
  const allowedOrigins = (
    configService.get<string>('BETTER_AUTH_TRUSTED_ORIGINS') ?? ''
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // fail closed outside development: no configured origins → no cross-origin
  // access. never fall back to credentialed reflection of arbitrary origins.
  const isDev = configService.get<string>('APP_ENV') === 'development';

  app.enableCors({
    origin: allowedOrigins.length ? allowedOrigins : isDev,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    // set-auth-token: better-auth's bearer plugin returns the session token here on
    // sign-in; the web client must be able to read it cross-origin (see mobile auth).
    exposedHeaders: ['x-request-id', 'set-auth-token'],
  });

  await app.register(helmet);
  await app.register(cookie);
  await app.register(compression);

  // mount inngest on the underlying fastify instance
  const fastifyInstance = app.getHttpAdapter().getInstance();
  const apiService = app.get(ApiService);
  const commandBus = app.get(CommandBus);

  // mount Better Auth (handles /api/auth/*) on the underlying fastify instance —
  // a raw route bypasses the Nest pipe/interceptor/guard stack.
  fastifyInstance.route({
    method: ['GET', 'POST'],
    url: `${apiPrefix}api/auth/*`,
    handler: async (request, reply) => {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const headers = fromNodeHeaders(request.headers);

      // body is re-serialized from Fastify's parsed object, so drop the original
      // content-length (it no longer matches) and let undici recompute it.
      const hasBody = request.body != null && request.method !== 'GET';
      if (hasBody) {
        headers.delete('content-length');
      }

      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
      });

      const response = await auth.handler(req);

      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));

      return reply.send(response.body ? await response.text() : null);
    },
  });

  fastifyInstance.route({
    method: ['GET', 'POST', 'PUT'],
    url: `${apiPrefix}api/inngest`,
    handler: serve({
      client: inngest,
      functions: getInngestRegistry({ apiService, commandBus }),
    }),
  });

  // swagger / openapi
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Wearclair API')
    .setDescription('The Wearclair API')
    .setVersion('1.0')
    .build();

  const document = sanitizeOpenApiDoc(
    cleanupOpenApiDoc(SwaggerModule.createDocument(app, swaggerConfig)),
  );

  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3310, '0.0.0.0');
}

void bootstrap();
