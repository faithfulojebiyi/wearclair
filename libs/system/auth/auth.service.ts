import { Injectable } from '@nestjs/common';

import { AppPrismaService } from '@system/database/database.service';

import { createAuth } from './auth';

// owns the Better Auth instance while Nest owns its shared Prisma dependency.
@Injectable()
export class BetterAuthService {
  readonly auth;

  constructor(appPrismaService: AppPrismaService) {
    this.auth = createAuth(appPrismaService);
  }
}
