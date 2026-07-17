import { RequestContext } from '@mastra/core/request-context';
import {
  MASTRA_CLIENT_TYPE_HEADER,
  MASTRA_IS_STUDIO_KEY,
  isReservedRequestContextKey,
  isStudioClientTypeHeader,
} from '@mastra/server/server-adapter';
import { Inject, Injectable, Logger, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { MASTRA_OPTIONS } from '../constants';
import type { MastraModuleOptions } from '../mastra.module';
import { getHeaderValue } from '../utils/request';

/**
 * REQUEST-scoped service that manages request context and abort signaling.
 * Created fresh for each HTTP request.
 *
 * Unlike the upstream Express adapter, abort wiring is NOT set up here: on
 * Fastify the injected REQUEST is a FastifyRequest which has no handle to the
 * reply. The MastraController (which receives the FastifyReply via @Res) wires
 * `reply.raw` 'close' → `this.abort()` to detect client disconnection.
 */
@Injectable({ scope: Scope.REQUEST })
export class RequestContextService {
  private readonly logger = new Logger(RequestContextService.name);
  private readonly abortController: AbortController;
  private readonly context: RequestContext;
  private isAborted = false;

  constructor(
    @Inject(REQUEST) private readonly request: FastifyRequest,
    @Inject(MASTRA_OPTIONS) private readonly options: MastraModuleOptions,
  ) {
    this.abortController = new AbortController();
    this.context = this.parseRequestContext();
  }

  /**
   * Get the abort signal for this request.
   * Use this to detect client disconnection.
   */
  get abortSignal(): AbortSignal {
    return this.abortController.signal;
  }

  /**
   * Get the parsed request context.
   */
  get requestContext(): RequestContext {
    return this.context;
  }

  /**
   * Set the authenticated user on the request context.
   * Should be called after successful authentication.
   */
  setUser(user: unknown): void {
    this.context.set('user', user);
  }

  /**
   * Parse request context from body or query parameters.
   */
  private parseRequestContext(): RequestContext {
    const context = new RequestContext();

    try {
      if (
        this.request.method === 'POST' ||
        this.request.method === 'PUT' ||
        this.request.method === 'PATCH'
      ) {
        const body = this.request.body as
          { requestContext?: Record<string, unknown> } | undefined;
        if (body?.requestContext) {
          this.mergeContext(context, body.requestContext);
        }
      }

      if (this.request.method === 'GET') {
        const query = this.request.query as
          { requestContext?: unknown } | undefined;
        const encodedContext = query?.requestContext;
        if (typeof encodedContext === 'string') {
          const parsed = this.parseEncodedContext(encodedContext);
          if (parsed) {
            this.mergeContext(context, parsed);
          }
        }
      }
    } catch (error) {
      if (this.options.contextOptions?.logWarnings !== false) {
        this.logger.warn(
          `Failed to parse request context: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // In strict mode, throw the error
      if (this.options.contextOptions?.strict) {
        throw error;
      }
    }

    this.applyRequestMetadata(context);
    return context;
  }

  /**
   * Parse encoded context from query parameter.
   * Supports both plain JSON and base64-encoded JSON.
   */
  private parseEncodedContext(encoded: string): Record<string, unknown> | null {
    // Try plain JSON first
    try {
      return JSON.parse(encoded) as Record<string, unknown>;
    } catch {
      // Try base64-encoded JSON
      try {
        const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
        return JSON.parse(decoded) as Record<string, unknown>;
      } catch {
        if (this.options.contextOptions?.logWarnings !== false) {
          this.logger.warn(
            'Failed to decode request context (tried JSON and base64)',
          );
        }
        return null;
      }
    }
  }

  /**
   * Merge parsed context values into the RequestContext.
   */
  private mergeContext(
    context: RequestContext,
    values: Record<string, unknown>,
  ): void {
    for (const [key, value] of Object.entries(values)) {
      if (isReservedRequestContextKey(key)) continue;
      context.set(key, value);
    }
  }

  private applyRequestMetadata(context: RequestContext): void {
    if (
      isStudioClientTypeHeader(
        getHeaderValue(this.request, MASTRA_CLIENT_TYPE_HEADER),
      )
    ) {
      context.set(MASTRA_IS_STUDIO_KEY, true);
    }
  }

  /**
   * Manually trigger abort (e.g., on client disconnect or during shutdown).
   * Wired from the controller via `reply.raw` 'close'.
   */
  abort(): void {
    if (!this.isAborted) {
      this.isAborted = true;
      try {
        this.abortController.abort();
      } catch {
        // Ignore abort errors
      }
    }
  }
}
