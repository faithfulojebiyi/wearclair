import { SetMetadata } from '@nestjs/common';

import { IS_PUBLIC_KEY } from '../constants';

/**
 * Decorator to mark a route as public for the adapter's MastraAuthGuard
 * (no Mastra authentication required).
 *
 * NOTE: this is the *adapter's* public marker (key 'isPublic'), used only by
 * MastraAuthGuard for protecting custom routes. To make wearclair's global
 * SessionGuard skip a route, use `@Public` from `@system/auth/auth.decorators`
 * (key 'PUBLIC') instead.
 *
 * @example
 * ```typescript
 * @Controller('health')
 * export class HealthController {
 *   @Get()
 *   @Public()
 *   check() {
 *     return { status: 'ok' };
 *   }
 * }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
