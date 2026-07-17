import { ConfigService } from '@nestjs/config';

import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  type ChatStreamEvent,
  type Chunk,
  readApprovalChunk,
  toChatStreamEvent,
} from './stream-events';

// the slice of a Mastra agent stream we consume: the run id (for resume) + the chunks.
export interface AgentStream {
  runId: string;
  fullStream: AsyncIterable<Chunk>;
}

// credentialed CORS headers for a hijacked SSE response. `reply.hijack()` takes
// the socket over before Fastify's CORS plugin runs, so we must echo the allowed
// origin ourselves — otherwise the browser blocks the cross-origin stream.
export function sseCorsHeaders(
  request: FastifyRequest,
  configService: ConfigService,
): Record<string, string> {
  const origin = request.headers.origin;

  if (!origin) {
    return {};
  }

  const allowed = (
    configService.get<string>('BETTER_AUTH_TRUSTED_ORIGINS') ?? ''
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (allowed.length > 0 && !allowed.includes(origin)) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

// hijack the reply and open the event stream; returns the frame writer.
export function openSseStream(
  request: FastifyRequest,
  reply: FastifyReply,
  configService: ConfigService,
): (event: ChatStreamEvent) => void {
  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    ...sseCorsHeaders(request, configService),
  });

  return (event: ChatStreamEvent) =>
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
}

// drain an agent stream to SSE. Returns at the first approval gate (Agent mode,
// later phase) instead of `done`; otherwise emits `done` when the run finishes.
export async function pipeAgentStream(
  stream: AgentStream,
  send: (event: ChatStreamEvent) => void,
): Promise<void> {
  for await (const chunk of stream.fullStream) {
    const approval = readApprovalChunk(chunk);

    if (approval) {
      send({
        type: 'approval',
        runId: stream.runId,
        toolCallId: approval.toolCallId,
        tool: approval.tool,
      });

      return;
    }

    const event = toChatStreamEvent(chunk);

    if (event) {
      send(event);
    }
  }

  send({ type: 'done' });
}
