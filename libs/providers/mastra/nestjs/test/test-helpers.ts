import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Shared fakes for the Fastify-flavored Mastra adapter unit tests. These build
 * structurally-minimal FastifyRequest/FastifyReply doubles (cast through
 * `unknown`) — the adapter only ever touches the handful of fields modeled here.
 */

export interface FakeRequestInit {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
  body?: unknown;
  ip?: string;
}

export function fakeRequest(init: FakeRequestInit = {}): FastifyRequest {
  const ip = init.ip ?? '127.0.0.1';
  return {
    method: init.method ?? 'GET',
    url: init.url ?? '/',
    headers: init.headers ?? {},
    query: init.query ?? {},
    body: init.body,
    ip,
    socket: { remoteAddress: ip },
  } as unknown as FastifyRequest;
}

export interface FakeReplyState {
  statusCode: number;
  body: unknown;
  headersSent: boolean;
}

export function fakeReply(headersSent = false): {
  reply: FastifyReply;
  state: FakeReplyState;
} {
  const state: FakeReplyState = { statusCode: 0, body: undefined, headersSent };
  const reply = {
    raw: {
      get headersSent() {
        return state.headersSent;
      },
    },
    status(code: number) {
      state.statusCode = code;
      return reply;
    },
    send(payload: unknown) {
      state.body = payload;
      return reply;
    },
  };
  return { reply: reply as unknown as FastifyReply, state };
}
