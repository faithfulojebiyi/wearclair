import { describe, it, expect, beforeEach, mock } from 'bun:test';

import type { Mastra } from '@mastra/core/mastra';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

import type { MastraModuleOptions } from '../mastra.module';
import { fakeRequest } from './test-helpers';

// Isolate the adapter's auth bridge from the (Hono-centric) policy helpers.
const mockIsProtected = mock(() => true);
const mockCanAccessPublicly = mock(() => false);
const mockIsDevPlayground = mock(() => false);

mock.module('@mastra/server/auth', () => ({
  isProtectedPath: mockIsProtected,
  canAccessPublicly: mockCanAccessPublicly,
  isDevPlaygroundRequest: mockIsDevPlayground,
  checkRules: mock(() => false),
  defaultAuthConfig: { rules: [] },
}));

// Import after mock.module so AuthService binds to the mocked helpers.
const { AuthService } = await import('../services/auth.service');

interface AuthConfig {
  authenticateToken?: (token: string, request: unknown) => unknown;
  authorizeUser?: (
    user: unknown,
    request: unknown,
  ) => boolean | Promise<boolean>;
}

function makeService(
  authConfig: AuthConfig | undefined,
  options: Partial<MastraModuleOptions> = {},
) {
  const mastra = {
    getServer: () => (authConfig ? { auth: authConfig } : undefined),
  } as unknown as Mastra;
  return new AuthService(mastra, options as MastraModuleOptions);
}

beforeEach(() => {
  mockIsProtected.mockReset();
  mockIsProtected.mockReturnValue(true);
  mockCanAccessPublicly.mockReset();
  mockCanAccessPublicly.mockReturnValue(false);
  mockIsDevPlayground.mockReset();
  mockIsDevPlayground.mockReturnValue(false);
});

describe('AuthService.authenticate', () => {
  it('returns undefined when no auth config is present', async () => {
    const svc = makeService(undefined);
    await expect(svc.authenticate(fakeRequest())).resolves.toBeUndefined();
  });

  it('returns undefined for a dev playground request', async () => {
    mockIsDevPlayground.mockReturnValue(true);
    const svc = makeService({ authenticateToken: () => ({ id: 'u' }) });
    await expect(svc.authenticate(fakeRequest())).resolves.toBeUndefined();
  });

  it('returns undefined for an unprotected path', async () => {
    mockIsProtected.mockReturnValue(false);
    const svc = makeService({ authenticateToken: () => ({ id: 'u' }) });
    await expect(svc.authenticate(fakeRequest())).resolves.toBeUndefined();
  });

  it('returns undefined when the path can be accessed publicly', async () => {
    mockCanAccessPublicly.mockReturnValue(true);
    const svc = makeService({ authenticateToken: () => ({ id: 'u' }) });
    await expect(svc.authenticate(fakeRequest())).resolves.toBeUndefined();
  });

  it('throws Unauthorized when a protected route has no token', async () => {
    const svc = makeService({ authenticateToken: () => ({ id: 'u' }) });
    await expect(svc.authenticate(fakeRequest())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns the user for a valid Bearer token', async () => {
    const svc = makeService({ authenticateToken: () => ({ id: 'u1' }) });
    const req = fakeRequest({
      headers: { authorization: 'Bearer good-token' },
    });
    await expect(svc.authenticate(req)).resolves.toEqual({ id: 'u1' });
  });

  it('throws Unauthorized when token verification yields no user', async () => {
    const svc = makeService({ authenticateToken: () => null });
    const req = fakeRequest({ headers: { authorization: 'Bearer bad' } });
    await expect(svc.authenticate(req)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws Forbidden when authorizeUser denies access', async () => {
    const svc = makeService({
      authenticateToken: () => ({ id: 'u1' }),
      authorizeUser: () => false,
    });
    const req = fakeRequest({ headers: { authorization: 'Bearer good' } });
    await expect(svc.authenticate(req)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('accepts a query apiKey only when allowQueryApiKey is enabled', async () => {
    const svc = makeService(
      { authenticateToken: () => ({ id: 'q' }) },
      { auth: { allowQueryApiKey: true } },
    );
    const req = fakeRequest({ query: { apiKey: 'k1' } });
    await expect(svc.authenticate(req)).resolves.toEqual({ id: 'q' });

    const svcNoQuery = makeService({ authenticateToken: () => ({ id: 'q' }) });
    await expect(
      svcNoQuery.authenticate(fakeRequest({ query: { apiKey: 'k1' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
