import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { DatabaseModule } from '@system/database/database.module';

import { BetterAuthService } from './auth.service';
import { SessionGuard } from './session.guard';

// api-only: Better Auth runs on the Fastify instance (see apps/api main.ts). This
// registers SessionGuard GLOBALLY — every Nest route requires a session unless
// marked @Public(). The worker must not import this (auth is HTTP-request-scoped).
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    BetterAuthService,
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [BetterAuthService],
})
export class AuthModule {}
