import type { Mastra } from '@mastra/core/mastra';
import type { MastraAuthConfig } from '@mastra/core/server';
import {
  isProtectedPath,
  canAccessPublicly,
  isDevPlaygroundRequest,
  checkRules,
  defaultAuthConfig,
} from '@mastra/server/auth';
import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { MASTRA, MASTRA_OPTIONS } from '../constants';
import type { MastraModuleOptions } from '../mastra.module';
import { getHeaderValue, getRequestPath } from '../utils/request';

type AuthConfigBridge = {
  authenticateToken?: (token: string, request: unknown) => unknown;
  authorizeUser?: (
    user: unknown,
    request: unknown,
  ) => Promise<boolean> | boolean;
  authorize?: (
    path: string,
    method: string,
    user: unknown,
    context: unknown,
  ) => Promise<boolean> | boolean;
  rules?: unknown[];
};

/**
 * Service that handles authentication for Mastra routes.
 * Called after route matching to check if auth is required.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(MASTRA) private readonly mastra: Mastra,
    @Inject(MASTRA_OPTIONS) private readonly options: MastraModuleOptions,
  ) {}

  /**
   * Check authentication for a request based on the matched route.
   * Returns the authenticated user if auth succeeds, undefined if no auth required.
   * Throws UnauthorizedException or ForbiddenException if auth fails.
   *
   * Type assertions are used because `@mastra/server/auth` types are
   * Hono-centric. The runtime values work with Fastify requests.
   */
  async authenticate(request: FastifyRequest): Promise<unknown> {
    const authConfig = this.mastra.getServer()?.auth as
      AuthConfigBridge | undefined;
    const customRouteAuthConfig = this.options.customRouteAuthConfig;
    const method = request.method;
    const path = getRequestPath(request);

    // No auth config means no authentication required
    if (!authConfig) {
      return undefined;
    }

    // `@mastra/server/auth` helpers are typed against the Hono-flavored
    // MastraAuthConfig. AuthConfigBridge is the Fastify-flavored equivalent
    // — runtime-compatible but not structurally assignable. Cast through
    // unknown to bridge the typing without changing runtime behavior.
    const helperAuthConfig = authConfig as unknown as MastraAuthConfig;

    const getHeader = (name: string): string | undefined =>
      getHeaderValue(request, name);

    // Check if this is a dev playground request (skip auth in dev mode)
    if (
      isDevPlaygroundRequest(
        path,
        method,
        getHeader,
        helperAuthConfig,
        customRouteAuthConfig,
      )
    ) {
      return undefined;
    }

    // Check if this path needs protection
    if (
      !isProtectedPath(path, method, helperAuthConfig, customRouteAuthConfig)
    ) {
      return undefined;
    }

    // Check if the route can be accessed publicly
    if (canAccessPublicly(path, method, helperAuthConfig)) {
      return undefined;
    }

    // Auth is required - authenticate the request
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      // Validate token using Mastra's auth system
      let user: unknown;

      if (typeof authConfig?.authenticateToken === 'function') {
        // Mastra auth hooks are adapter-agnostic at runtime; Nest passes the
        // underlying Fastify request object for parity with the Express adapter.
        user = await authConfig.authenticateToken(token, request);
      } else {
        throw new Error('No token verification method configured');
      }

      if (!user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      // FastifyRequest doesn't have a `user` property natively
      (request as FastifyRequest & { user?: unknown }).user = user;

      // Perform authorization check
      await this.authorize(request, path, method, user, authConfig);

      return user;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.error(
        'Authentication error:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Check authorization for an authenticated user.
   */
  private async authorize(
    request: FastifyRequest,
    path: string,
    method: string,
    user: unknown,
    authConfig: AuthConfigBridge,
  ): Promise<void> {
    // Client-provided authorizeUser function
    if (typeof authConfig.authorizeUser === 'function') {
      const isAuthorized = await authConfig.authorizeUser(user, request);
      if (!isAuthorized) {
        throw new ForbiddenException('Access denied');
      }
      return;
    }

    // Client-provided authorize function
    if (typeof authConfig.authorize === 'function') {
      // Build a context object similar to the Express adapter
      const context = {
        get: (key: string) => {
          if (key === 'mastra') return this.mastra;
          if (key === 'customRouteAuthConfig')
            return this.options.customRouteAuthConfig;
          return undefined;
        },
        req: request,
      };

      const isAuthorized = await authConfig.authorize(
        path,
        method,
        user,
        context,
      );
      if (!isAuthorized) {
        throw new ForbiddenException('Access denied');
      }
      return;
    }

    // Custom rule-based authorization
    if (
      'rules' in authConfig &&
      authConfig.rules &&
      authConfig.rules.length > 0
    ) {
      const isAuthorized = await checkRules(
        authConfig.rules as MastraAuthConfig['rules'],
        path,
        method,
        user,
      );
      if (!isAuthorized) {
        throw new ForbiddenException('Access denied');
      }
      return;
    }

    // Default rule-based authorization
    if (defaultAuthConfig.rules && defaultAuthConfig.rules.length > 0) {
      const isAuthorized = await checkRules(
        defaultAuthConfig.rules,
        path,
        method,
        user,
      );
      if (!isAuthorized) {
        throw new ForbiddenException('Access denied');
      }
    }
  }

  /**
   * Extract authentication token from request.
   * Supports Authorization header (Bearer token) and API key query param.
   */
  private extractToken(request: FastifyRequest): string | undefined {
    // Check Authorization header first
    const authHeader = getHeaderValue(request, 'authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // Optional backward-compatibility path for legacy integrations.
    if (this.options.auth?.allowQueryApiKey) {
      const query = request.query as { apiKey?: unknown } | undefined;
      const apiKey = query?.apiKey;
      if (typeof apiKey === 'string') {
        return apiKey;
      }
      if (Array.isArray(apiKey)) {
        const firstApiKey = apiKey.find(
          (value): value is string => typeof value === 'string',
        );
        if (firstApiKey) {
          return firstApiKey;
        }
      }
    }

    return undefined;
  }
}
