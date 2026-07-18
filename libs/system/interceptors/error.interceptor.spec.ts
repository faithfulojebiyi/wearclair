import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { NotFoundException } from '@nestjs/common';

import { AllExceptionsFilter } from './error.interceptor';

const originalAppEnv = process.env.APP_ENV;

const makeHarness = () => {
  const reply = mock(() => undefined);
  const header = mock(() => undefined);

  const httpAdapterHost = {
    httpAdapter: {
      reply,
      getRequestUrl: () => '/test',
    },
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ id: 'req-1' }),
      getResponse: () => ({ header }),
    }),
  };

  // @ts-expect-error — minimal fakes for the filter under test
  const filter = new AllExceptionsFilter(httpAdapterHost);

  const body = () => {
    // @ts-expect-error — mock call args are loosely typed
    return reply.mock.calls[0]?.[1];
  };
  const status = () => {
    // @ts-expect-error — mock call args are loosely typed
    return reply.mock.calls[0]?.[2];
  };

  // @ts-expect-error — minimal host fake
  return { filter, host, body, status, header };
};

const prismaLikeError = () => {
  const error = new Error('column users.email violates constraint');
  error.name = 'PrismaClientKnownRequestError';
  Object.assign(error, { code: 'P2002', meta: { cause: 'db internal cause' } });

  return error;
};

describe('AllExceptionsFilter response sanitization', () => {
  beforeEach(() => {
    process.env.APP_ENV = 'production';
  });

  afterEach(() => {
    process.env.APP_ENV = originalAppEnv;
  });

  it('returns a generic message for unexpected 500s in production', () => {
    const { filter, host, body, status, header } = makeHarness();

    filter.catch(new Error('pg: connection to 10.0.0.1 refused'), host);

    expect(status()).toBe(500);
    expect(body()?.message).toBe('Internal server error');
    expect(header).toHaveBeenCalledWith('x-request-id', 'req-1');
  });

  it('keeps the raw message for unexpected errors in development', () => {
    process.env.APP_ENV = 'development';
    const { filter, host, body } = makeHarness();

    filter.catch(new Error('pg: connection refused'), host);

    expect(body()?.message).toBe('pg: connection refused');
  });

  it('hides prisma cause and code in production', () => {
    const { filter, host, body, status } = makeHarness();

    filter.catch(prismaLikeError(), host);

    expect(status()).toBe(400);
    expect(body()?.message).toBe('Database request failed');
    expect(body()?.code).toBeUndefined();
  });

  it('exposes prisma cause and code in development', () => {
    process.env.APP_ENV = 'development';
    const { filter, host, body } = makeHarness();

    filter.catch(prismaLikeError(), host);

    expect(body()?.message).toBe('db internal cause');
    expect(body()?.code).toBe('P2002');
  });

  it('keeps intentional 4xx messages in production', () => {
    const { filter, host, body, status } = makeHarness();

    filter.catch(new NotFoundException('device not found'), host);

    expect(status()).toBe(404);
    expect(body()?.message).toBe('device not found');
  });
});
