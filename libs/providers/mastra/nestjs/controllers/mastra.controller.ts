import type { ServerRoute } from '@mastra/server/server-adapter';
import { normalizeQueryParams } from '@mastra/server/server-adapter';
import {
  All,
  Controller,
  Inject,
  NotFoundException,
  Req,
  Res,
  UseGuards,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { MASTRA_OPTIONS, MASTRA_ROUTE_BASE } from '../constants';
import { MastraExceptionFilter } from '../filters/mastra-exception.filter';
import { MastraRouteGuard } from '../guards/mastra-route.guard';
import { RequestTrackingInterceptor } from '../interceptors/request-tracking.interceptor';
import { StreamingInterceptor } from '../interceptors/streaming.interceptor';
import type { MastraModuleOptions } from '../mastra.module';
import { RequestContextService } from '../services/request-context.service';
import { RouteHandlerService } from '../services/route-handler.service';
import { parseMultipartFormData } from '../utils/parse-multipart';
import { getHeaderValue, getRequestPath } from '../utils/request';
import { getMastraRoutePath } from '../utils/route-path';

/**
 * Convert a Fastify request to a Web API Request for accessing headers, cookies, etc.
 */
function toWebRequest(req: FastifyRequest): globalThis.Request {
  const protocol = req.protocol || 'http';
  const host = getHeaderValue(req, 'host') || 'localhost';
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v));
    } else {
      headers.set(key, String(value));
    }
  }

  return new globalThis.Request(url, {
    method: req.method,
    headers,
    // Note: body is not needed as it's already parsed
  });
}

/**
 * Main Mastra controller that handles all Mastra routes dynamically.
 * Routes are matched against SERVER_ROUTES from @mastra/server.
 *
 * Scoped to a base path (`MASTRA_ROUTE_BASE`) rather than a root catch-all, so
 * the controller never shadows the rest of the wearclair app. The global
 * SessionGuard applies — every Mastra route requires a Better Auth session —
 * and MastraRouteGuard adds per-IP rate limiting (plus Mastra's own auth when
 * configured). Excluded from the OpenAPI doc so the catch-all never leaks into
 * generated API clients.
 */
@Controller(MASTRA_ROUTE_BASE)
@ApiExcludeController()
@UseInterceptors(RequestTrackingInterceptor, StreamingInterceptor)
@UseFilters(MastraExceptionFilter)
@UseGuards(MastraRouteGuard)
export class MastraController {
  constructor(
    @Inject(MASTRA_OPTIONS) private readonly options: MastraModuleOptions,
    @Inject(RouteHandlerService)
    private readonly routeHandler: RouteHandlerService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  /**
   * Catch-all handler that matches incoming requests to Mastra routes.
   * Uses `@Res()` (non-passthrough): the StreamingInterceptor owns sending the
   * response for every response type.
   */
  @All('*')
  async handleRequest(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<unknown> {
    const path = getRequestPath(req);
    const method = req.method.toUpperCase();

    // Detect client disconnection → abort in-flight Mastra work.
    reply.raw.on('close', () => {
      if (!reply.raw.writableFinished) {
        this.requestContext.abort();
      }
    });

    const routePath = getMastraRoutePath(path, this.options.prefix);

    if (!routePath) {
      throw new NotFoundException(`Route not found: ${method} ${path}`);
    }

    // Reject paths with double slashes (e.g., /api//agents)
    if (routePath.includes('//')) {
      throw new NotFoundException(`Route not found: ${method} ${path}`);
    }

    // Find matching route using RouteHandlerService's consolidated route matching
    const matchResult = this.routeHandler.matchRoute(method, routePath);

    if (!matchResult) {
      throw new NotFoundException(`Route not found: ${method} ${path}`);
    }

    const { route, pathParams } = matchResult;
    const queryParams = this.parseQueryParams(
      req.query as Record<string, unknown>,
    );
    const body = await this.parseBody(req, route);

    return this.routeHandler.executeHandler(route, {
      pathParams,
      queryParams,
      body,
      requestContext: this.requestContext.requestContext,
      abortSignal: this.requestContext.abortSignal,
      request: toWebRequest(req),
    });
  }

  /**
   * Parse and normalize query parameters.
   *
   * Values are forwarded as the raw strings (or string arrays) the HTTP layer
   * delivered. The route's `queryParamSchema` decides whether and how to parse
   * or coerce each field — exactly as in `@mastra/hono`, `@mastra/express`,
   * `@mastra/fastify`, and `@mastra/koa`. Users who want booleans, numbers, or
   * parsed JSON should opt in via `z.coerce.boolean()`, `z.coerce.number()`,
   * or a JSON preprocessor on the field. See #16114.
   */
  private parseQueryParams(
    query: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const dangerousKeys = new Set(['__proto__', 'prototype', 'constructor']);
    const normalizedQuery = normalizeQueryParams(query);

    for (const [key, value] of Object.entries(normalizedQuery)) {
      // Skip requestContext - it's handled separately
      if (key === 'requestContext') {
        continue;
      }
      if (dangerousKeys.has(key)) {
        continue;
      }

      result[key] = value;
    }

    return result;
  }

  /**
   * Parse request body, handling multipart/form-data and JSON.
   */
  private async parseBody(
    req: FastifyRequest,
    route: ServerRoute,
  ): Promise<unknown> {
    // Only parse body for methods that typically have bodies
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return undefined;
    }

    const contentType = getHeaderValue(req, 'content-type') || '';

    // Handle multipart/form-data
    if (contentType.includes('multipart/form-data')) {
      const maxFileSize =
        route.maxBodySize ?? this.options.bodyLimitOptions?.maxFileSize;
      const allowedMimeTypes = this.options.bodyLimitOptions?.allowedMimeTypes;

      return parseMultipartFormData(req, {
        maxFileSize,
        allowedMimeTypes,
      });
    }

    // JSON body is parsed natively by Fastify
    return req.body;
  }
}
