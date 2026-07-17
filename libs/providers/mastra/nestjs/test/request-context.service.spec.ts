import { describe, it, expect } from 'bun:test';
import { MASTRA_IS_STUDIO_KEY } from '@mastra/server/server-adapter';

import type { MastraModuleOptions } from '../mastra.module';
import { RequestContextService } from '../services/request-context.service';
import { fakeRequest } from './test-helpers';

function makeService(
  reqInit: Parameters<typeof fakeRequest>[0],
  options: Partial<MastraModuleOptions> = {},
): RequestContextService {
  return new RequestContextService(
    fakeRequest(reqInit),
    options as MastraModuleOptions,
  );
}

// RequestContext.get's default-generic return is typed `undefined`; read through
// an unknown-typed helper so bun's strict expect() accepts concrete comparisons.
const ctxValue = (svc: RequestContextService, key: string): unknown =>
  svc.requestContext.get(key);

describe('RequestContextService', () => {
  it('merges requestContext from a POST/PUT/PATCH body', () => {
    const svc = makeService({
      method: 'POST',
      body: { requestContext: { tenant: 'acme', region: 'us' } },
    });
    expect(ctxValue(svc, 'tenant')).toBe('acme');
    expect(ctxValue(svc, 'region')).toBe('us');
  });

  it('skips reserved context keys when merging', () => {
    const svc = makeService({
      method: 'POST',
      body: { requestContext: { mastra__authToken: 'secret', tenant: 'acme' } },
    });
    expect(ctxValue(svc, 'mastra__authToken')).toBeUndefined();
    expect(ctxValue(svc, 'tenant')).toBe('acme');
  });

  it('parses a plain-JSON requestContext from a GET query', () => {
    const svc = makeService({
      method: 'GET',
      query: { requestContext: JSON.stringify({ tenant: 'acme' }) },
    });
    expect(ctxValue(svc, 'tenant')).toBe('acme');
  });

  it('parses a base64-encoded requestContext from a GET query', () => {
    const encoded = Buffer.from(JSON.stringify({ tenant: 'b64' })).toString(
      'base64',
    );
    const svc = makeService({
      method: 'GET',
      query: { requestContext: encoded },
    });
    expect(ctxValue(svc, 'tenant')).toBe('b64');
  });

  it('does not throw on an unparseable context in non-strict mode', () => {
    expect(() =>
      makeService(
        { method: 'GET', query: { requestContext: '%%%not-json%%%' } },
        { contextOptions: { logWarnings: false } },
      ),
    ).not.toThrow();
  });

  it('flags studio requests via the client-type header', () => {
    const svc = makeService({
      method: 'GET',
      headers: { 'x-mastra-client-type': 'studio' },
    });
    expect(ctxValue(svc, MASTRA_IS_STUDIO_KEY)).toBe(true);
  });

  it('does not flag studio for a non-studio client type', () => {
    const svc = makeService({
      method: 'GET',
      headers: { 'x-mastra-client-type': 'js' },
    });
    expect(ctxValue(svc, MASTRA_IS_STUDIO_KEY)).toBeUndefined();
  });

  it('setUser stores the authenticated user on the context', () => {
    const svc = makeService({ method: 'GET' });
    svc.setUser({ id: 'u1' });
    expect(ctxValue(svc, 'user')).toEqual({ id: 'u1' });
  });

  it('abort() trips the signal and is idempotent', () => {
    const svc = makeService({ method: 'GET' });
    expect(svc.abortSignal.aborted).toBe(false);
    svc.abort();
    expect(svc.abortSignal.aborted).toBe(true);
    expect(() => svc.abort()).not.toThrow();
    expect(svc.abortSignal.aborted).toBe(true);
  });
});
