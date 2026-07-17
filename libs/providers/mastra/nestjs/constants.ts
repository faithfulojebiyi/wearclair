/**
 * Injection token for the Mastra instance.
 * Use with @Inject(MASTRA) to inject the Mastra instance.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class MyService {
 *   constructor(@Inject(MASTRA) private readonly mastra: Mastra) {}
 * }
 * ```
 */
export const MASTRA = Symbol('MASTRA');

/**
 * Injection token for the Mastra module options.
 * Used internally by MastraService.
 */
export const MASTRA_OPTIONS = Symbol('MASTRA_OPTIONS');

/**
 * Metadata key for the adapter's own @Public() decorator.
 * Routes marked as public skip the adapter's MastraAuthGuard.
 *
 * NOTE: this is distinct from wearclair's `@system/auth` IS_PUBLIC_KEY ('PUBLIC')
 * which the global SessionGuard reads. The MastraController is marked with
 * wearclair's @Public so the global SessionGuard defers to Mastra's own auth.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Metadata key for @MastraThrottle() decorator.
 * Custom rate limits per route.
 */
export const THROTTLE_KEY = 'mastraThrottle';

/**
 * Metadata key for route information.
 * Stores the Mastra route definition for the handler.
 */
export const MASTRA_ROUTE_KEY = 'mastraRoute';

/**
 * Static base path the MastraController is mounted under (relative to the app's
 * global prefix). Unlike the upstream Express adapter — which mounts a root
 * catch-all and strips the prefix — wearclair embeds Mastra inside an existing
 * app, so the controller is scoped to this base path to avoid clobbering other
 * routes. Keep the module's default `prefix` option aligned with this value.
 */
export const MASTRA_ROUTE_BASE = 'mastra';
