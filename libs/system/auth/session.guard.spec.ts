import { describe, expect, it, mock } from 'bun:test';

import { SessionGuard } from './session.guard';

describe('SessionGuard', () => {
  it('resolves sessions through the injected Better Auth instance', async () => {
    const session = {
      session: { id: 'session-1' },
      user: { id: 'user-1', email: 'demo@wearclair.dev' },
    };
    const getSession = mock(async () => session);
    const set = mock(() => undefined);
    const request = { headers: { authorization: 'Bearer token' } };
    const guard = new SessionGuard(
      { ctx: { set } } as never,
      { getAllAndOverride: mock(() => false) } as never,
      { auth: { api: { getSession } } },
    );
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    };

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith('userId', 'user-1');
    expect(request).toHaveProperty('session', session);
  });
});
