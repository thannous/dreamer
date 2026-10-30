/**
 * Fixed provider answers for the local development backend. The real route
 * handlers, guards, quotas and storage run; only the paid model transport is
 * replaced, so nothing leaves the machine and nothing is billed. Answers follow
 * the JSON schema each route sends, so a new structured route works without a
 * fixture of its own.
 */

/** A 64x64 night-coloured PNG standing in for generated illustrations. */
export const LOCAL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAUElEQVR42u3PQQkAAAgEsEvi0xz2T2UE38JgBZaueS0CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApcFOk5AeeRqRpoAAAAASUVORK5CYII=';

export const LOCAL_CHAT_TEXT =
  'Réponse locale fixe : ce détail de ton rêve mérite qu’on s’y arrête. Qu’évoque-t-il pour toi ?';
export const LOCAL_TRANSCRIPT = 'Transcription locale fixe : je marchais dans un jardin la nuit.';

type Schema = Record<string, unknown>;

/** What the request says about the dream, so answers can quote it like a model would. */
export type PromptContext = { transcript: string; prompt: string };

const QUESTIONS = [
  'Et autour de toi, il y avait quoi ?',
  'Il ressemblait à quoi, cet endroit ?',
  'Et toi, tu faisais quoi à ce moment-là ?',
  'Qui d’autre était là ?',
  'Et ensuite, il s’est passé quoi ?',
];

/** The dream text a route sent, read from its JSON payload when it has one. */
export function promptContext(prompt: string): PromptContext {
  try {
    const data = JSON.parse(prompt);
    for (const key of ['transcript', 'dream', 'text', 'story']) {
      if (typeof data?.[key] === 'string' && data[key].trim()) return { transcript: data[key], prompt };
    }
  } catch { /* Free-form prompts quote the dream inline. */ }
  return { transcript: prompt, prompt };
}

/** A short verbatim excerpt of the dream, as routes require for anchors and quote sources. */
function excerpt(context: PromptContext): string {
  // Sliced from the text itself, never rejoined, so it stays verbatim.
  const words = /^\S+(?:\s+\S+){0,4}/.exec(context.transcript.trim())?.[0] ?? '';
  return words.replace(/[.,;:!?…]+$/, '');
}

/** A question the prompt does not already contain, picked from the dream's length. */
function questionFor(context: PromptContext): string {
  const start = context.transcript.length % QUESTIONS.length;
  for (let offset = 0; offset < QUESTIONS.length; offset++) {
    const candidate = QUESTIONS[(start + offset) % QUESTIONS.length];
    if (!context.prompt.includes(candidate)) return candidate;
  }
  return QUESTIONS[start];
}

const isRecord = (value: unknown): value is Schema =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Text chosen from the field name, so a screen shows something readable. */
function textFor(key: string, context?: PromptContext): string {
  const name = key.toLowerCase();
  if (context && (name.includes('anchor') || name.includes('excerpt') || name.includes('source'))) return excerpt(context);
  if (name.includes('question')) return context ? questionFor(context) : QUESTIONS[0];
  if (name.includes('title')) return 'Rêve local';
  if (name.includes('quote')) return 'Une lumière restait allumée au bout du jardin.';
  if (name.includes('prompt')) return 'A quiet night garden under a soft moon.';
  if (name.includes('transcript') || name.includes('story') || name.includes('text')) {
    return 'Je marchais dans un jardin la nuit, une lumière restait allumée au loin.';
  }
  if (name.includes('interpretation') || name.includes('letter') || name.includes('summary')) {
    return 'Interprétation locale fixe : ce rêve parle d’un lieu familier que tu revisites. Qu’est-ce qui t’y attire ?';
  }
  return 'Réponse locale fixe.';
}

function fitString(value: string, schema: Schema): string {
  const max = typeof schema.maxLength === 'number' ? schema.maxLength : undefined;
  const min = typeof schema.minLength === 'number' ? schema.minLength : 0;
  let text = value;
  while (text.length < min) text += ' ' + value;
  return max !== undefined && text.length > max ? text.slice(0, max) : text;
}

/** A value that satisfies `schema`, built without randomness. */
export function synthesize(schema: unknown, key = '', depth = 0, context?: PromptContext): unknown {
  if (!isRecord(schema) || depth > 12) return null;
  if ('const' in schema) return schema.const;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  for (const combinator of ['anyOf', 'oneOf']) {
    const branches = schema[combinator];
    if (Array.isArray(branches) && branches.length) {
      const chosen = branches.find((branch) => isRecord(branch) && branch.type !== 'null') ?? branches[0];
      return synthesize(chosen, key, depth + 1, context);
    }
  }
  if (Array.isArray(schema.allOf) && schema.allOf.length) {
    return synthesize(Object.assign({}, ...schema.allOf.filter(isRecord)), key, depth + 1, context);
  }
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const type = types.find((candidate) => candidate !== 'null') ?? (isRecord(schema.properties) ? 'object' : 'string');
  switch (type) {
    case 'object': {
      const properties = isRecord(schema.properties) ? schema.properties : {};
      const required = Array.isArray(schema.required) ? new Set(schema.required as string[]) : null;
      const value: Record<string, unknown> = {};
      for (const [name, child] of Object.entries(properties)) {
        if (required && !required.has(name)) continue;
        value[name] = synthesize(child, name, depth + 1, context);
      }
      return value;
    }
    case 'array': {
      const min = typeof schema.minItems === 'number' ? schema.minItems : 1;
      const max = typeof schema.maxItems === 'number' ? schema.maxItems : Math.max(min, 1);
      const count = Math.min(Math.max(min, 1), max);
      return Array.from({ length: count }, () => synthesize(schema.items, key.replace(/s$/, ''), depth + 1, context));
    }
    case 'integer':
    case 'number': {
      const min = typeof schema.minimum === 'number' ? schema.minimum : 1;
      const max = typeof schema.maximum === 'number' ? schema.maximum : min;
      return Math.min(Math.max(min, 1), max);
    }
    case 'boolean':
      // `done`-like flags stay false so a conversation keeps going.
      return false;
    default:
      if (schema.format === 'date-time') return '2026-01-01T00:00:00.000Z';
      return fitString(textFor(key, context), schema);
  }
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
});

/** The last user turn's text, from a string or text blocks. */
function lastUserText(messages: unknown): string {
  if (!Array.isArray(messages)) return '';
  const last = [...messages].reverse().find((message) => isRecord(message) && message.role === 'user');
  if (!isRecord(last)) return '';
  if (typeof last.content === 'string') return last.content;
  return Array.isArray(last.content)
    ? last.content.map((block) => (isRecord(block) && typeof block.text === 'string' ? block.text : '')).join('\n')
    : '';
}

function claudeMessage(body: Schema): Response {
  const format = isRecord(body.output_config) && isRecord(body.output_config.format) ? body.output_config.format : null;
  const context = promptContext(lastUserText(body.messages));
  const answer = format?.type === 'json_schema' ? JSON.stringify(synthesize(format.schema, '', 0, context)) : LOCAL_CHAT_TEXT;
  const message = {
    id: `msg_local_${crypto.randomUUID()}`, type: 'message', role: 'assistant', model: body.model,
    content: [{ type: 'text', text: answer }], stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
  };
  if (!body.stream) return json(message);
  const frames = [
    { type: 'message_start', message: { ...message, content: [], stop_reason: null } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: answer } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 0 } },
    { type: 'message_stop' },
  ];
  return new Response(frames.map((frame) => `event: ${frame.type}\ndata: ${JSON.stringify(frame)}\n\n`).join(''), {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function geminiInteraction(body: Schema): Response {
  if (body.stream) {
    // The streamed Interactions format is not reproduced: the route reports a
    // provider failure, the same path as a real outage.
    return json({ error: { code: 503, message: 'Local backend: streamed Gemini is not simulated', status: 'UNAVAILABLE' } }, 503);
  }
  const format = isRecord(body.response_format) ? body.response_format : null;
  const content = format?.type === 'image'
    ? [{ type: 'image', data: LOCAL_PNG_BASE64, mime_type: 'image/png' }]
    : [{ type: 'text', text: format?.schema ? JSON.stringify(synthesize(format.schema, '', 0, promptContext(JSON.stringify(body.input ?? '')))) : LOCAL_CHAT_TEXT }];
  return json({
    id: `interaction_local_${crypto.randomUUID()}`, status: 'completed', model: body.model,
    steps: [{ type: 'model_output', content }],
  });
}

/**
 * The provider answer for `request`, or null when it is not a model call.
 * Callers block every other external destination.
 */
export async function answerProviderRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.hostname === 'api.anthropic.com' && url.pathname === '/v1/messages') {
    return claudeMessage(await request.json());
  }
  if (url.hostname === 'generativelanguage.googleapis.com' && url.pathname.includes('/interactions')) {
    return geminiInteraction(await request.json());
  }
  if (url.hostname === 'speech.googleapis.com') {
    return json({ results: [{ alternatives: [{ transcript: LOCAL_TRANSCRIPT, confidence: 1 }] }] });
  }
  return null;
}
