import { describe, it, expect } from 'bun:test';
import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

import type { MastraModuleOptions } from '../mastra.module';
import {
  RouteHandlerService,
  ValidationError,
  type RouteHandlerParams,
} from '../services/route-handler.service';

function makeService(): RouteHandlerService {
  const mastra = { name: 'test-mastra' } as unknown as Mastra;
  const options = { prefix: '/mastra' } as MastraModuleOptions;
  return new RouteHandlerService(mastra, options);
}

function baseParams(
  overrides: Partial<RouteHandlerParams> = {},
): RouteHandlerParams {
  return {
    pathParams: {},
    queryParams: {},
    body: undefined,
    requestContext: new RequestContext(),
    abortSignal: new AbortController().signal,
    ...overrides,
  };
}

describe('RouteHandlerService.matchRoute', () => {
  const service = makeService();

  it('matches a real static GET route exactly', () => {
    const staticGet = service
      .getAllRoutes()
      .find((r) => r.method.toUpperCase() === 'GET' && !r.path.includes(':'));
    expect(staticGet).toBeDefined();

    const result = service.matchRoute('GET', staticGet!.path);
    expect(result).not.toBeNull();
    expect(result!.route.path).toBe(staticGet!.path);
    expect(result!.pathParams).toEqual({});
  });

  it('matches a parameterized route and extracts path params', () => {
    const param = service
      .getAllRoutes()
      .find((r) => r.method.toUpperCase() === 'GET' && r.path.includes(':'));
    expect(param).toBeDefined();

    // Substitute every :param segment with a concrete value.
    const segments = param!.path.split('/').map((seg) => {
      if (!seg.startsWith(':')) return seg;
      return `val-${seg.slice(1)}`;
    });
    const concretePath = segments.join('/');

    const result = service.matchRoute('GET', concretePath);
    expect(result).not.toBeNull();
    expect(result!.route.path).toBe(param!.path);

    for (const seg of param!.path.split('/')) {
      if (seg.startsWith(':')) {
        const name = seg.slice(1);
        expect(result!.pathParams[name]).toBe(`val-${name}`);
      }
    }
  });

  it('returns null when nothing matches', () => {
    expect(
      service.matchRoute('GET', '/definitely/not/a/mastra/route/xyz'),
    ).toBeNull();
  });

  it('throws BadRequestException for invalid percent-encoding in a param', () => {
    const param = service
      .getAllRoutes()
      .find((r) => r.method.toUpperCase() === 'GET' && r.path.includes(':'));
    expect(param).toBeDefined();

    const segments = param!.path
      .split('/')
      .map((seg) => (seg.startsWith(':') ? '%E0%A4%A' : seg)); // truncated escape
    const badPath = segments.join('/');

    expect(() => service.matchRoute('GET', badPath)).toThrow(
      BadRequestException,
    );
  });
});

describe('RouteHandlerService.findRoute', () => {
  const service = makeService();

  it('finds an exact registered route', () => {
    const any = service.getAllRoutes()[0];
    expect(service.findRoute(any.method, any.path)).toBeDefined();
  });

  it('returns undefined for an unknown route', () => {
    expect(service.findRoute('GET', '/nope/nope')).toBeUndefined();
  });
});

describe('RouteHandlerService.executeHandler', () => {
  const service = makeService();

  // A synthetic route exercising schema validation + handler param assembly,
  // independent of the real SERVER_ROUTES shapes.
  function syntheticRoute(
    handler: (params: Record<string, unknown>) => unknown,
  ): ServerRoute {
    return {
      method: 'POST',
      path: '/synthetic/:id',
      responseType: 'json',
      pathParamSchema: z.object({ id: z.string() }),
      queryParamSchema: z.object({ n: z.coerce.number() }),
      bodySchema: z.object({ name: z.string() }),
      handler,
    } as unknown as ServerRoute;
  }

  it('validates and returns a json result with handler-visible params', async () => {
    let seen: Record<string, unknown> = {};
    const route = syntheticRoute((params) => {
      seen = params;
      return { ok: true };
    });

    const result = await service.executeHandler(
      route,
      baseParams({
        pathParams: { id: 'abc' },
        queryParams: { n: '5' },
        body: { name: 'widget' },
      }),
    );

    expect(result.responseType).toBe('json');
    expect(result.data).toEqual({ ok: true });

    // Path param, coerced query (string "5" -> number 5), and body merged in.
    expect(seen.id).toBe('abc');
    expect(seen.n).toBe(5);
    expect(seen.name).toBe('widget');
    // ServerContext is spread into handler params.
    expect(seen.mastra).toBeDefined();
    expect(seen.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it('throws ValidationError when the body fails its schema', async () => {
    const route = syntheticRoute(() => ({ ok: true }));
    await expect(
      service.executeHandler(
        route,
        baseParams({
          pathParams: { id: 'abc' },
          queryParams: { n: '5' },
          body: { name: 123 }, // wrong type
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when a query param fails coercion', async () => {
    const route = syntheticRoute(() => ({ ok: true }));
    await expect(
      service.executeHandler(
        route,
        baseParams({
          pathParams: { id: 'abc' },
          queryParams: { n: 'not-a-number' },
          body: { name: 'widget' },
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('drops reserved keys supplied via the request body', async () => {
    let seen: Record<string, unknown> = {};
    // No bodySchema so the raw body flows through to the reserved-key filter.
    const route = {
      method: 'POST',
      path: '/synthetic',
      responseType: 'json',
      handler: (params: Record<string, unknown>) => {
        seen = params;
        return { ok: true };
      },
    } as unknown as ServerRoute;

    await service.executeHandler(
      route,
      baseParams({
        body: { mastra: 'attacker-supplied', safe: 'kept' },
      }),
    );

    // The injected ServerContext.mastra wins; the attacker value is ignored.
    expect(seen.mastra).not.toBe('attacker-supplied');
    expect(seen.safe).toBe('kept');
  });
});
