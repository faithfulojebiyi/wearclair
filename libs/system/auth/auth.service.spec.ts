import { describe, expect, it } from 'bun:test';

import { BetterAuthService } from './auth.service';

describe('BetterAuthService', () => {
  it('builds Better Auth from the Prisma client managed by Nest', () => {
    const previousBaseUrl = process.env.BETTER_AUTH_URL;
    process.env.BETTER_AUTH_URL = 'http://localhost:3310';

    try {
      const prisma = {};
      const service = new BetterAuthService(prisma as never);

      expect(service.auth).toBeDefined();
    } finally {
      if (previousBaseUrl === undefined) {
        delete process.env.BETTER_AUTH_URL;
      } else {
        process.env.BETTER_AUTH_URL = previousBaseUrl;
      }
    }
  });
});
