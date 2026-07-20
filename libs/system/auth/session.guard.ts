import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyRequest } from 'fastify';

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AlsService } from '@system/als/als.service';

import { IS_PUBLIC_KEY } from './auth.decorators';
import { BetterAuthService } from './auth.service';

// global guard: every Nest route requires a Better Auth session unless marked @Public().
// resolves the session into ALS (identity) and attaches it to the request.
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly als: AlsService,
    private readonly reflector: Reflector,
    private readonly betterAuthService: BetterAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    const session = await this.betterAuthService.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      throw new UnauthorizedException();
    }

    (request as FastifyRequest & { session?: typeof session }).session =
      session;
    this.als.ctx.set('userId', session.user.id);

    return true;
  }
}
