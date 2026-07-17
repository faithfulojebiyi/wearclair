import {
  ExecutionContext,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';

import type { Auth } from './auth';

// mark a route (or whole controller) as open — SessionGuard skips auth for it.
export const IS_PUBLIC_KEY = 'PUBLIC';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

type Session = Awaited<ReturnType<Auth['api']['getSession']>>;
type SessionUser = NonNullable<Session>['user'];

// resolves the authenticated user (attached to the request by SessionGuard).
// `@CurrentUser()` → the user; `@CurrentUser('id')` → a single field.
export const CurrentUser = createParamDecorator(
  (field: keyof SessionUser | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ session?: NonNullable<Session> }>();
    const user = request.session?.user;

    return field ? user?.[field] : user;
  },
);
