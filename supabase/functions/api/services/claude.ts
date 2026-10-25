import Anthropic from 'npm:@anthropic-ai/sdk@0.132.1';
import { type TextAnalysisRefundCode, isRefundableTextAnalysisFailure, isTerminalTextAnalysisFailure } from '../lib/textAnalysisRefund.ts';
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
// No automatic retry: the app explicitly retries a failed request with the same provider.
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
 * (refusal, max_tokens) so the caller reports a retryable failure.
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
 * caller rejects unsupported history instead of changing provider.
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
 * and returns a retryable error. `timeoutMs` bounds the entire stream, including
 * a stall after the first text.
 */
export const startClaudeTextStream = async (options: ClaudeTextOptions): Promise<ClaudeTextStream> => {
  const stream = createClient(options.apiKey, options.timeoutMs).messages.stream({
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
    if (first === null) {
      const final = await stream.finalMessage();
      throw new ClaudeStopError(final?.stop_reason ?? null);
    }
  } catch (error) {
    clearTimeout(timer);
    stream.abort();
    throw error;
  }
  let usage: ClaudeUsage | null = null;
  const firstText = first;
  async function* deltas() {
    try {
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
    } finally {
      clearTimeout(timer);
      stream.abort();
    }
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

/** Missing server configuration must never become a provider switch. */
export class ClaudeConfigurationError extends Error {
  readonly code = 'ANALYSIS_CONFIGURATION_ERROR';
  constructor() { super('Text AI is not configured: ANTHROPIC_API_KEY is required'); }
}

export class ClaudeRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: TextAnalysisRefundCode = status === 504 ? 'ANALYSIS_TIMEOUT' : 'ANALYSIS_PROVIDER_UNAVAILABLE'
  ) { super(status === 504 ? 'Request timeout, please retry' : 'Text AI unavailable, please retry'); }
}

export class ClaudeInvalidOutputError extends Error {}

/** Only known application codes cross this boundary; PostgREST errors are service failures. */
export const textAnalysisFailureCode = (error: unknown): string => {
  const candidate = error as { code?: unknown; status?: unknown; name?: unknown } | null;
  if (isRefundableTextAnalysisFailure(candidate?.code) || isTerminalTextAnalysisFailure(candidate?.code)) return candidate!.code as string;
  if (candidate?.code === '42501') return 'ANALYSIS_ACCESS_DENIED';
  if (typeof candidate?.code === 'string') return 'ANALYSIS_SERVER_ERROR';
  if (candidate?.name === 'AbortError') return 'ANALYSIS_CLIENT_CANCELLED';
  if (candidate?.name === 'TimeoutError' || candidate?.status === 504) return 'ANALYSIS_TIMEOUT';
  if (typeof candidate?.status === 'number') {
    return candidate.status >= 500 && candidate.status <= 599 ? 'ANALYSIS_SERVER_ERROR' : 'ANALYSIS_REQUEST_REJECTED';
  }
  return 'ANALYSIS_SERVER_ERROR';
};

const claudeProviderFailureCode = (error: unknown): TextAnalysisRefundCode => {
  if (error instanceof ClaudeConfigurationError) return error.code;
  if (error instanceof ClaudeRequestError) return error.code;
  if (error instanceof ClaudeStopError) {
    return error.stopReason === 'refusal' ? 'ANALYSIS_PROVIDER_REFUSED' : 'ANALYSIS_INVALID_OUTPUT';
  }
  if (error instanceof SyntaxError || error instanceof ClaudeInvalidOutputError) return 'ANALYSIS_INVALID_OUTPUT';
  const candidate = error as { status?: number; name?: string } | null;
  if (candidate?.status === 429 || candidate?.status === 529) return 'ANALYSIS_PROVIDER_OVERLOADED';
  if (candidate?.status === 401 || candidate?.status === 403) return 'ANALYSIS_CONFIGURATION_ERROR';
  if (error instanceof Anthropic.APIConnectionTimeoutError || /timeout|abort/i.test(candidate?.name ?? '') || candidate?.status === 504) return 'ANALYSIS_TIMEOUT';
  return 'ANALYSIS_PROVIDER_UNAVAILABLE';
};

export const requireAnthropicApiKey = (value = Deno.env.get('ANTHROPIC_API_KEY')): string => {
  const key = value?.trim();
  if (!key) throw new ClaudeConfigurationError();
  return key;
};

/** Provider credentials/errors are never exposed or mistaken for app authentication. */
export const classifyClaudeError = (error: unknown) => {
  if (error instanceof ClaudeConfigurationError) return { status: 503, userMessage: error.message, canRetry: true };
  const candidate = error as { name?: string; status?: number } | null;
  const status = error instanceof ClaudeRequestError ? error.status
    : error instanceof Anthropic.APIConnectionTimeoutError || /timeout|abort/i.test(candidate?.name ?? '') || candidate?.status === 504 ? 504 : 502;
  return { status, userMessage: status === 504 ? 'Request timeout, please retry' : 'Text AI unavailable, please retry', canRetry: true };
};

/** Parse and validate inside the callback: unusable output is also a retryable error. */
export const runClaudeOnly = async <T>(options: {
  route: string;
  anthropicApiKey?: string | null;
  config: { model: string; effort: ClaudeEffort };
  claude: (apiKey: string) => Promise<{ value: T; usage: ClaudeUsage | null }>;
}): Promise<T> => {
  const apiKey = requireAnthropicApiKey(options.anthropicApiKey ?? '');
  try {
    const { value, usage } = await options.claude(apiKey);
    logClaudeSpend(options.route, options.config.model, options.config.effort, usage);
    return value;
  } catch (error) {
    // Categorical diagnostics only: errors and responses may contain private dreams.
    const info = classifyClaudeError(error);
    console.warn('[api] text request failed', { route: options.route, status: info.status });
    throw new ClaudeRequestError(info.status, claudeProviderFailureCode(error));
  }
};
