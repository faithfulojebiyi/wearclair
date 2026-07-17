import { MastraServerBase } from '@mastra/core/server';
import type { FastifyInstance } from 'fastify';

/**
 * Minimal Mastra server adapter wrapper for NestJS on Fastify.
 * Provides MastraServerBase compatibility so getServerApp() works.
 *
 * The upstream Express adapter parameterizes this with Express's `Application`;
 * the wearclair api runs on Fastify, so we wrap the FastifyInstance instead.
 */
export class NestMastraServer extends MastraServerBase<FastifyInstance> {
  constructor(app: FastifyInstance) {
    super({ app, name: 'NestMastraServer' });
  }
}
