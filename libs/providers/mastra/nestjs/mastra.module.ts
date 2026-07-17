import type { ToolsInput } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { InMemoryTaskStore } from '@mastra/server/a2a/store';
import { Module } from '@nestjs/common';
import type { DynamicModule, Provider, Type } from '@nestjs/common';

import { MASTRA, MASTRA_OPTIONS, MASTRA_ROUTE_BASE } from './constants';
import { MastraController } from './controllers/mastra.controller';
import { MastraExceptionFilter } from './filters/mastra-exception.filter';
import { MastraAuthGuard } from './guards/mastra-auth.guard';
import { MastraRouteGuard } from './guards/mastra-route.guard';
import { MastraThrottleGuard } from './guards/mastra-throttle.guard';
import { RequestTrackingInterceptor } from './interceptors/request-tracking.interceptor';
import { StreamingInterceptor } from './interceptors/streaming.interceptor';
import { MastraService } from './mastra.service';
import { AuthService } from './services/auth.service';
import { RequestContextService } from './services/request-context.service';
import { RouteHandlerService } from './services/route-handler.service';
import { ShutdownService } from './services/shutdown.service';

/**
 * Default route prefix. Aligned with the MastraController's static base path so
 * `getMastraRoutePath` strips it correctly. If the app uses a global prefix,
 * pass `prefix` as `${globalPrefix}/${MASTRA_ROUTE_BASE}`.
 */
const DEFAULT_PREFIX = `/${MASTRA_ROUTE_BASE}`;

/**
 * Options for MastraModule configuration.
 */
export interface MastraModuleOptions {
  /** The Mastra instance to register */
  mastra: Mastra;

  /**
   * Register as a global module so MASTRA + MastraService are injectable
   * app-wide (e.g. from feature modules like HealthModule) without each
   * importing the adapter. Default: false (upstream @mastra/nestjs parity).
   */
  global?: boolean;

  /** Route prefix (default: `/mastra`) */
  prefix?: string;

  /** Request body / file size limits (file limits applied via @fastify/multipart) */
  bodyLimitOptions?: {
    /** Max body size in bytes (default: 10MB) — enforced via Fastify `bodyLimit` */
    maxSize?: number;
    /** Max per-file size in bytes (default: 50MB) */
    maxFileSize?: number;
    /** Temp directory for file uploads */
    tempDir?: string;
    /** Allowed MIME types for file uploads */
    allowedMimeTypes?: string[];
  };

  /**
   * Rate limiting options.
   * Rate limiting is ON by default - set enabled: false to disable.
   */
  rateLimitOptions?: {
    /** Enable/disable rate limiting (default: true) */
    enabled?: boolean;
    /** Default requests per window (default: 100) */
    defaultLimit?: number;
    /** Window size in ms (default: 60000 = 1 minute) */
    windowMs?: number;
    /** Stricter limit for /generate endpoints (default: 10) */
    generateLimit?: number;
  };

  /** Graceful shutdown options */
  shutdownOptions?: {
    /** Max wait time for in-flight requests in ms (default: 30000) */
    timeoutMs?: number;
    /** Send shutdown event to SSE clients (default: true) */
    notifyClients?: boolean;
  };

  /** Context parsing options */
  contextOptions?: {
    /** Fail on parse errors (default: false) */
    strict?: boolean;
    /** Log parse warnings (default: true) */
    logWarnings?: boolean;
  };

  /** Additional tools to register */
  tools?: ToolsInput;

  /** Task store for async operations */
  taskStore?: InMemoryTaskStore;

  /** Mastra-internal authentication configuration. Disabled by default.
   *  Most NestJS apps have their own global auth guards -- Mastra defers to those.
   *  Enable this only if you want Mastra's built-in token auth. */
  auth?: {
    /** Enable Mastra's internal auth (default: false) */
    enabled?: boolean;
    /** Allow `?apiKey=` query auth for backward compatibility (default: false) */
    allowQueryApiKey?: boolean;
  };

  /** Per-route auth configuration */
  customRouteAuthConfig?: Map<string, boolean>;

  /** Streaming configuration */
  streamOptions?: {
    /** Redact sensitive data from streams (default: true) */
    redact?: boolean;
    /** Send SSE heartbeats every N ms (default: disabled). Set <= 0 to disable. */
    heartbeatMs?: number;
  };

  /** MCP transport options */
  mcpOptions?: {
    /** Run in serverless mode */
    serverless?: boolean;
    /** Custom session ID generator */
    sessionIdGenerator?: () => string;
  };
}

/**
 * Options for async module configuration.
 */
export interface MastraModuleAsyncOptions {
  /** Register as a global module (see MastraModuleOptions.global). Default: false. */
  global?: boolean;
  /** Modules to import for dependency injection */
  imports?: DynamicModule['imports'];
  /** Factory function to create module options */
  useFactory?: (
    ...args: unknown[]
  ) => Promise<MastraModuleOptions> | MastraModuleOptions;
  /** Dependencies to inject into the factory function */

  inject?: any[];
  /** Use an existing provider */
  useExisting?: Type<MastraModuleOptionsFactory>;
  /** Use a class to create options */
  useClass?: Type<MastraModuleOptionsFactory>;
}

/**
 * Interface for async options factory.
 */
export interface MastraModuleOptionsFactory {
  createMastraOptions(): Promise<MastraModuleOptions> | MastraModuleOptions;
}

const SHARED_PROVIDERS: Provider[] = [
  MastraService,
  RouteHandlerService,
  RequestContextService,
  ShutdownService,
  AuthService,
  // Guards are available for use but NOT registered as APP_GUARD
  // to avoid affecting other modules in the user's app.
  // MastraRouteGuard applies auth + rate limiting only for Mastra routes.
  MastraAuthGuard,
  MastraThrottleGuard,
  MastraRouteGuard,
  StreamingInterceptor,
  RequestTrackingInterceptor,
  MastraExceptionFilter,
];

/**
 * Fastify-flavored NestJS module for integrating Mastra into your application.
 *
 * This is wearclair's own adapter — the upstream `@mastra/nestjs` is Express-only
 * and fails fast on Fastify. It mirrors that adapter's structure, adapted to
 * Fastify (`reply.raw` streaming + hijack, `@fastify/multipart`, native JSON +
 * `bodyLimit`). The TracingInterceptor and SystemController are intentionally
 * omitted: wearclair bans OpenTelemetry and ships its own HealthModule.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     MastraModule.register({ mastra, prefix: '/mastra' }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class MastraModule {
  /**
   * Register Mastra with the NestJS application.
   */
  static register(options: MastraModuleOptions): DynamicModule {
    const normalizedOptions: MastraModuleOptions = {
      prefix: DEFAULT_PREFIX,
      ...options,
    };

    const optionsProvider: Provider = {
      provide: MASTRA_OPTIONS,
      useValue: normalizedOptions,
    };

    const mastraProvider: Provider = {
      provide: MASTRA,
      useValue: normalizedOptions.mastra,
    };

    return {
      module: MastraModule,
      global: options.global,
      controllers: [MastraController],
      providers: [optionsProvider, mastraProvider, ...SHARED_PROVIDERS],
      exports: [MASTRA, MastraService],
    };
  }

  /**
   * Register Mastra asynchronously for when configuration depends on other services.
   */
  static registerAsync(options: MastraModuleAsyncOptions): DynamicModule {
    if (!options.useFactory && !options.useClass && !options.useExisting) {
      throw new Error(
        'MastraModule.registerAsync() requires one of: useFactory, useClass, or useExisting',
      );
    }

    const providers: Provider[] = [];

    if (options.useFactory) {
      providers.push({
        provide: MASTRA_OPTIONS,
        useFactory: async (...args: unknown[]) => {
          const resolved = await options.useFactory!(...args);
          return { prefix: DEFAULT_PREFIX, ...resolved };
        },
        inject: options.inject || [],
      });
    } else if (options.useClass) {
      providers.push(
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
        {
          provide: MASTRA_OPTIONS,
          useFactory: async (factory: MastraModuleOptionsFactory) => {
            const resolved = await factory.createMastraOptions();
            return { prefix: DEFAULT_PREFIX, ...resolved };
          },
          inject: [options.useClass],
        },
      );
    } else if (options.useExisting) {
      providers.push({
        provide: MASTRA_OPTIONS,
        useFactory: async (factory: MastraModuleOptionsFactory) => {
          const resolved = await factory.createMastraOptions();
          return { prefix: DEFAULT_PREFIX, ...resolved };
        },
        inject: [options.useExisting],
      });
    }

    // Provide MASTRA by extracting from options
    providers.push({
      provide: MASTRA,
      useFactory: (opts: MastraModuleOptions) => {
        if (!opts.mastra) {
          throw new Error(
            'MastraModule: "mastra" instance is required in MastraModuleOptions',
          );
        }
        return opts.mastra;
      },
      inject: [MASTRA_OPTIONS],
    });

    return {
      module: MastraModule,
      global: options.global,
      imports: options.imports || [],
      controllers: [MastraController],
      providers: [...providers, ...SHARED_PROVIDERS],
      exports: [MASTRA, MastraService],
    };
  }
}
