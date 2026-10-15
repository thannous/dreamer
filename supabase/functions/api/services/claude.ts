import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.132.1?target=deno';
import { withoutArrayBounds } from '../lib/schemas.ts';

export type ClaudeEffort = 'low' | 'medium' | 'high';

export type ClaudeUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/** A response that ended before a final answer (refusal, max_tokens...). */
export class ClaudeStopError extends Error {
  constructor(readonly stopReason: string | null) {
    super(`Claude stopped before a final answer: ${stopReason}`);
    this.name = 'ClaudeStopError';
  }
}

/**
 * One structured-output request to Claude. Throws on any non-final stop
 * (refusal, max_tokens) so the caller can fall back to another provider.
 * No retries and a short timeout: a slow or failing call must leave time for
 * the Gemini fallback inside the same job.
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
  // Explicit base URL: a local ANTHROPIC_BASE_URL must never receive this key.
  const client = new Anthropic({
    apiKey: options.apiKey,
    baseURL: 'https://api.anthropic.com',
    maxRetries: 0,
    timeout: options.timeoutMs ?? 45_000,
  });
  const response = await client.messages.create({
    model: options.model,
    max_tokens: 16000,
    system: options.system,
    messages: [{ role: 'user', content: options.prompt }],
    thinking: { type: 'adaptive' },
    output_config: {
      effort: options.effort,
      // Claude structured outputs reject array length bounds; the caller clamps counts.
      format: { type: 'json_schema', schema: withoutArrayBounds(options.schema) as Record<string, unknown> },
    },
  });
  if (response.stop_reason !== 'end_turn') {
    throw new ClaudeStopError(response.stop_reason);
  }
  // The esm.sh build resolves the SDK types loosely; type the blocks used here explicitly.
  const text = (response.content as { type: string; text?: string }[])
    .map((block) => (block.type === 'text' ? block.text ?? '' : ''))
    .join('');
  return { text, usage: (response.usage as ClaudeUsage | undefined) ?? null };
};
