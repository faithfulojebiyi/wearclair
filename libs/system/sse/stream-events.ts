// the compact SSE event shape a streaming chat UI consumes. We translate Mastra's
// rich `fullStream` ChunkType into just what the UI renders: streamed text, and tool
// activity (so we can show "Reading…", "Searching…", etc.). Shared infra for any
// streaming chat SSE.
export type ChatStreamEvent =
  | { type: 'text'; text: string }
  // detail: a short human-readable hint from the call args (doc label, query, title)
  | { type: 'tool-call'; tool: string; detail?: string }
  // data: a small whitelisted slice of the tool result (only for tools whose
  // outcome the UI renders, e.g. the created review's link card) — never the
  // full result payload (read_document returns entire documents).
  | { type: 'tool-result'; tool: string; data?: Record<string, unknown> }
  // HITL: a `requireApproval` tool paused the run (Agent mode, later phase). The chat
  // shows an approve/decline card; approving resumes the same run.
  | { type: 'approval'; runId: string; toolCallId: string; tool: string }
  | { type: 'error'; error: string }
  | { type: 'done' };

// Mastra chunks are a discriminated union on `type` with a per-type `payload`; we read
// the few fields we need defensively (payload is unknown across the union boundary).
export type Chunk = { type: string; payload?: unknown };

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

// A `requireApproval`/`suspend()` tool surfaces as a `tool-call-approval` chunk (or a
// `tool-call-suspended` one). We pull the toolName + toolCallId; the caller adds the
// run id (it lives on the stream, not the chunk) to build the `approval` event.
export function readApprovalChunk(
  chunk: Chunk,
): { tool: string; toolCallId: string } | null {
  if (
    chunk.type !== 'tool-call-approval' &&
    chunk.type !== 'tool-call-suspended'
  ) {
    return null;
  }

  const payload = asRecord(chunk.payload);
  const tool = typeof payload.toolName === 'string' ? payload.toolName : 'tool';
  const toolCallId =
    typeof payload.toolCallId === 'string' ? payload.toolCallId : '';

  return { tool, toolCallId };
}

// the short "what is it working on" hint for the timeline, from the call args.
// (exported for history replay, which rebuilds the same timeline from memory)
export function toolCallDetail(
  args: Record<string, unknown>,
): string | undefined {
  const parts: string[] = [];

  if (typeof args.doc_id === 'string') {
    parts.push(args.doc_id);
  }

  if (Array.isArray(args.doc_ids)) {
    parts.push(args.doc_ids.filter((d) => typeof d === 'string').join(', '));
  }

  if (typeof args.query === 'string') {
    parts.push(args.query);
  }

  if (typeof args.title === 'string') {
    parts.push(args.title);
  }

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

// whitelist per tool: return the small slice of a tool result the UI should render
// (e.g. a link card). Nothing is whitelisted by default — add tools as features land,
// so full tool payloads never cross the wire implicitly.
export function toolResultData(
  _tool: string,
  _result: Record<string, unknown>,
): Record<string, unknown> | undefined {
  return undefined;
}

export function toChatStreamEvent(chunk: Chunk): ChatStreamEvent | null {
  const payload = asRecord(chunk.payload);

  switch (chunk.type) {
    case 'text-delta':
      return typeof payload.text === 'string'
        ? { type: 'text', text: payload.text }
        : null;

    case 'tool-call':
      return typeof payload.toolName === 'string'
        ? {
            type: 'tool-call',
            tool: payload.toolName,
            detail: toolCallDetail(asRecord(payload.args)),
          }
        : null;

    case 'tool-result':
      return typeof payload.toolName === 'string'
        ? {
            type: 'tool-result',
            tool: payload.toolName,
            data: toolResultData(payload.toolName, asRecord(payload.result)),
          }
        : null;

    case 'error':
      return { type: 'error', error: String(payload.error ?? 'Agent error') };

    default:
      return null;
  }
}
