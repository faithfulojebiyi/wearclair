import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  type ArgumentsHost,
} from '@nestjs/common';
import { z } from 'zod';

import { MastraExceptionFilter } from '../filters/mastra-exception.filter';
import { ValidationError } from '../services/route-handler.service';
import { fakeReply, fakeRequest, type FakeReplyState } from './test-helpers';

function makeHost(replyHeadersSent = false): {
  host: ArgumentsHost;
  state: FakeReplyState;
} {
  const { reply, state } = fakeReply(replyHeadersSent);
  const req = fakeRequest({ method: 'POST', url: '/mastra/agents' });
  const host = {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => req,
    }),
  } as unknown as ArgumentsHost;
  return { host, state };
}

function zodError(): z.ZodError {
  const parsed = z.object({ name: z.string() }).safeParse({ name: 123 });
  if (parsed.success) throw new Error('expected a zod failure');
  return parsed.error;
}

describe('MastraExceptionFilter', () => {
  // The filter logs every caught error; silence Nest's logger to keep the run clean.
  beforeAll(() => Logger.overrideLogger(false));
  afterAll(() => Logger.overrideLogger(true));

  const filter = new MastraExceptionFilter();

  it('passes a 4xx HttpException message through', () => {
    const { host, state } = makeHost();
    filter.catch(new BadRequestException('bad input'), host);
    expect(state.statusCode).toBe(400);
    const body = state.body as { error: string; code: string };
    expect(body.error).toBe('bad input');
    expect(body.code).toBe('BAD_REQUEST');
  });

  it('redacts 5xx HttpException details', () => {
    const { host, state } = makeHost();
    filter.catch(new InternalServerErrorException('db creds leaked'), host);
    expect(state.statusCode).toBe(500);
    const body = state.body as { error: string; code: string };
    expect(body.error).toBe('An internal error occurred');
    expect(body.code).toBe('INTERNAL_ERROR');
  });

  it('formats a ValidationError as a 400 with issues', () => {
    const { host, state } = makeHost();
    filter.catch(new ValidationError('Invalid request body', zodError()), host);
    expect(state.statusCode).toBe(400);
    const body = state.body as {
      error: string;
      code: string;
      issues: unknown[];
    };
    expect(body.error).toBe('Invalid request body');
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it('redacts a plain Error as a generic 500', () => {
    const { host, state } = makeHost();
    filter.catch(new Error('stack trace with secrets'), host);
    expect(state.statusCode).toBe(500);
    const body = state.body as { error: string; code: string };
    expect(body.error).toBe('An internal error occurred');
    expect(body.code).toBe('INTERNAL_ERROR');
  });

  it('attaches a request id from the x-request-id header', () => {
    const { reply, state } = fakeReply();
    const req = fakeRequest({
      method: 'GET',
      url: '/mastra/agents',
      headers: { 'x-request-id': 'req-123' },
    });
    const host = {
      switchToHttp: () => ({ getResponse: () => reply, getRequest: () => req }),
    } as unknown as ArgumentsHost;

    filter.catch(new BadRequestException('x'), host);
    const body = state.body as { requestId?: string; timestamp: string };
    expect(body.requestId).toBe('req-123');
    expect(typeof body.timestamp).toBe('string');
  });

  it('does not send a response when headers were already sent', () => {
    const { host, state } = makeHost(true);
    filter.catch(new Error('mid-stream'), host);
    expect(state.statusCode).toBe(0);
    expect(state.body).toBeUndefined();
  });
});
