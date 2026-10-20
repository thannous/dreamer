import Anthropic from 'npm:@anthropic-ai/sdk@0.132.1';
import { toClaudeSchema } from '../lib/schemas.ts';

export type ClaudeEffort = 'low' | 'medium' | 'high';

export type ClaudeUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

export type ClaudeMessage = { role: 'user' | 'assistant'; content: { type: 'text'; text: string }[] };

/** A response that ended before a final answer (refusal, max_tokens...). */
export class ClaudeStopError extends Error {
  constructor(readonly stopReason: string | null) {
    super(`Claude stopped before a final answer: ${stopReason}`);
    this.name = 'ClaudeStopError';
  }
}

// Explicit base URL: a local ANTHROPIC_BASE_URL must never receive this key.
// No retries: a slow or failing call must leave time for the Gemini fallback.
const createClient = (apiKey: string, timeoutMs: number) => new Anthropic({
  apiKey,
  baseURL: 'https://api.anthropic.com',
  maxRetries: 0,
  timeout: timeoutMs,
});

// The esm.sh build resolves the SDK types loosely; type the blocks used here explicitly.
const textOf = (content: unknown): string => (content as { type: string; text?: string }[])
  .map((block) => (block.type === 'text' ? block.text ?? '' : ''))
  .join('');

/**
 * One structured-output request to Claude. Throws on any non-final stop
 * (refusal, max_tokens) so the caller can fall back to another provider.
 */
export const requestClaudeJson = async (options: {
  apiKey: string;
  model: string;
  effort: ClaudeEffort;
  system: string;
  prompt: string;
  schema: unknown;
  timeoutMs?: number;
}): Promise<{ text: string; usage: ClaudeUsage | null }> => {
  const response = await createClient(options.apiKey, options.timeoutMs ?? 45_000).messages.create({
    model: options.model,
    max_tokens: 16000,
    system: options.system,
    messages: [{ role: 'user', content: options.prompt }],
    thinking: { type: 'adaptive' },
    output_config: {
      effort: options.effort,
      format: { type: 'json_schema', schema: toClaudeSchema(options.schema) as Record<string, unknown> },
    },
  });
  if (response.stop_reason !== 'end_turn') {
    throw new ClaudeStopError(response.stop_reason);
  }
  return { text: textOf(response.content), usage: (response.usage as ClaudeUsage | undefined) ?? null };
};

/**
 * Text-only Claude history from Gemini-shaped contents: thought parts and
 * signatures are dropped and consecutive turns of one role are merged. Null when
 * a turn carries media, or the history cannot open and end on the user, so the
 * caller stays on Gemini.
 */
export const toClaudeMessages = (
  contents: readonly { role?: string; parts: readonly { text?: string; thought?: boolean; inlineData?: unknown }[] }[]
): ClaudeMessage[] | null => {
  const messages: ClaudeMessage[] = [];
  for (const content of contents) {
    if (content.parts.some((part) => part.inlineData)) return null;
    const text = content.parts.filter((part) => !part.thought).map((part) => part.text ?? '').join('');
    if (!text.trim()) continue;
    const role = content.role === 'model' ? 'assistant' : 'user';
    const last = messages.at(-1);
    if (last?.role === role) last.content.push({ type: 'text', text });
    else messages.push({ role, content: [{ type: 'text', text }] });
  }
  return messages[0]?.role === 'user' && messages.at(-1)?.role === 'user' ? messages : null;
};

type ClaudeTextOptions = {
  apiKey: string;
  model: string;
  effort: ClaudeEffort;
  system: string;
  messages: ClaudeMessage[];
  timeoutMs: number;
  /** Thinking and text together. */
  maxTokens?: number;
};

/** One plain-text reply. Throws on any non-final stop or an empty answer. */
export const requestClaudeText = async (options: ClaudeTextOptions): Promise<{ text: string; usage: ClaudeUsage | null }> => {
  const response = await createClient(options.apiKey, options.timeoutMs).messages.create({
    model: options.model,
    max_tokens: options.maxTokens ?? 16000,
    system: options.system,
    messages: options.messages,
    thinking: { type: 'adaptive' },
    output_config: { effort: options.effort },
  });
  if (response.stop_reason !== 'end_turn') throw new ClaudeStopError(response.stop_reason);
  const text = textOf(response.content).trim();
  if (!text) throw new ClaudeStopError('empty');
  return { text, usage: (response.usage as ClaudeUsage | undefined) ?? null };
};

export type ClaudeTextStream = { deltas: AsyncGenerator<string>; usage: () => ClaudeUsage | null };

/**
 * Opens a streamed reply and waits for its first text, so connection, auth,
 * overload, refusal and a slow start all surface before the caller sends a byte
 * and can still fall back. `timeoutMs` bounds that first text only; afterwards a
 * failure ends the iteration with an error.
 */
export const startClaudeTextStream = async (options: ClaudeTextOptions): Promise<ClaudeTextStream> => {
  // The overall bound only stops a stream that hangs after its first text.
  const stream = createClient(options.apiKey, 120_000).messages.stream({
    model: options.model,
    max_tokens: options.maxTokens ?? 16000,
    system: options.system,
    messages: options.messages,
    thinking: { type: 'adaptive' },
    output_config: { effort: options.effort },
  });
  const iterator = (stream as AsyncIterable<any>)[Symbol.asyncIterator]();
  const textDelta = (event: any): string | null =>
    event?.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text ? event.delta.text : null;
  const timer = setTimeout(() => stream.abort(), options.timeoutMs);
  let first: string | null = null;
  try {
    while (first === null) {
      const { value, done } = await iterator.next();
      if (done) break;
      first = textDelta(value);
    }
  } finally {
    clearTimeout(timer);
  }
  if (first === null) {
    const final = await stream.finalMessage();
    throw new ClaudeStopError(final?.stop_reason ?? null);
  }
  let usage: ClaudeUsage | null = null;
  const firstText = first;
  async function* deltas() {
    yield firstText;
    for (;;) {
      const { value, done } = await iterator.next();
      if (done) break;
      const delta = textDelta(value);
      if (delta) yield delta;
    }
    const final = await stream.finalMessage();
    usage = (final?.usage as ClaudeUsage | undefined) ?? null;
    if (final?.stop_reason !== 'end_turn') throw new ClaudeStopError(final?.stop_reason ?? null);
  }
  return { deltas: deltas(), usage: () => usage };
};

/** Spend telemetry: categorical and token counts only, never content. */
export const logClaudeSpend = (route: string, model: string, effort: string, usage: ClaudeUsage | null) => {
  console.log('[ai-spend] text', {
    route, provider: 'anthropic', model, effort,
    inputTokens: usage?.input_tokens ?? null,
    outputTokens: usage?.output_tokens ?? null,
    cacheReadTokens: usage?.cache_read_input_tokens ?? null,
    cacheWriteTokens: usage?.cache_creation_input_tokens ?? null,
  });
};

/** Never logs the error message or a response body: they can carry dream content. */
export const logClaudeFallback = (route: string, error: unknown) => {
  const status = (error as { status?: unknown })?.status;
  console.warn(`[api] ${route}: Claude failed, falling back to Gemini`, {
    status: typeof status === 'number' ? status : null,
    stopReason: error instanceof ClaudeStopError ? error.stopReason : null,
    invalidJson: error instanceof SyntaxError,
  });
};

/**
 * Runs `claude` when a key is set and returns its value; on any failure there, or
 * without a key, runs `fallback` (the Gemini path). `claude` should parse and
 * validate its answer so an unusable one also falls back.
 */
export const runClaudeFirst = async <T>(options: {
  route: string;
  anthropicApiKey?: string | null;
  config: { model: string; effort: ClaudeEffort };
  claude: (apiKey: string) => Promise<{ value: T; usage: ClaudeUsage | null }>;
  fallback: () => Promise<T>;
}): Promise<T> => {
  const apiKey = options.anthropicApiKey?.trim();
  if (apiKey) {
    try {
      const { value, usage } = await options.claude(apiKey);
      logClaudeSpend(options.route, options.config.model, options.config.effort, usage);
      return value;
    } catch (error) {
      logClaudeFallback(options.route, error);
    }
  }
  return options.fallback();
};
