import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildInteractionParams,
  GeminiChatStream,
  extractInteractionImage,
  extractModelParts,
  GEMINI_FLASH_LITE_MODEL,
  GEMINI_FLASH_MODEL,
  GEMINI_CHAT_MODEL,
  isRetiredTextModel,
  resolveTextModel,
} from './gemini.ts';

Deno.test('text model constants point at current Interactions-era models', () => {
  assertEquals(GEMINI_FLASH_MODEL, 'gemini-3.8-flash');
  assertEquals(GEMINI_CHAT_MODEL, 'gemini-3.5-flash-lite');
  assertEquals(GEMINI_FLASH_LITE_MODEL, 'gemini-3.5-flash-lite');
});

Deno.test('extractInteractionImage prefers the output_image helper', () => {
  const interaction = {
    output_image: { type: 'image', data: 'abc123', mime_type: 'image/webp' },
    steps: [
      {
        type: 'model_output',
        content: [{ type: 'image', data: 'ignored', mime_type: 'image/png' }],
      },
    ],
  };

  assertEquals(extractInteractionImage(interaction), { data: 'abc123', mimeType: 'image/webp' });
});

Deno.test('extractInteractionImage falls back to the last model_output image step', () => {
  const interaction = {
    steps: [
      { type: 'thought', signature: 'sig' },
      { type: 'model_output', content: [{ type: 'text', text: 'first' }] },
      {
        type: 'model_output',
        content: [
          { type: 'text', text: 'here is your image' },
          { type: 'image', data: 'img-data', mime_type: 'image/png' },
        ],
      },
    ],
  };

  assertEquals(extractInteractionImage(interaction), { data: 'img-data', mimeType: 'image/png' });
});

Deno.test('extractInteractionImage returns empty for text-only interactions', () => {
  const interaction = {
    steps: [{ type: 'model_output', content: [{ type: 'text', text: 'no image' }] }],
  };

  assertEquals(extractInteractionImage(interaction), {});
  assertEquals(extractInteractionImage(undefined), {});
});

Deno.test('extractModelParts converts steps to legacy chat-history parts', () => {
  const interaction = {
    steps: [
      { type: 'user_input', content: [{ type: 'text', text: 'ignored user turn' }] },
      { type: 'thought', signature: 'thought-sig' },
      {
        type: 'model_output',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'dreamer.' },
          { type: 'image', data: 'img', mime_type: 'image/jpeg' },
        ],
      },
    ],
  };

  assertEquals(extractModelParts(interaction), [
    { thought: true, thoughtSignature: 'thought-sig' },
    { text: 'Hello ' },
    { text: 'dreamer.' },
    { inlineData: { data: 'img', mimeType: 'image/jpeg' } },
  ]);
});

Deno.test('isRetiredTextModel flags deprecated generations and dead previews', () => {
  assertEquals(isRetiredTextModel('gemini-1.5-pro'), true);
  assertEquals(isRetiredTextModel('gemini-2.0-flash-lite'), true);
  assertEquals(isRetiredTextModel('gemini-2.5-flash'), true);
  assertEquals(isRetiredTextModel('gemini-3-flash-preview'), true);
  assertEquals(isRetiredTextModel('gemini-3.1-flash-lite-preview'), true);
  assertEquals(isRetiredTextModel('gemini-3.7-flash'), false);
  assertEquals(isRetiredTextModel('gemini-3.6-flash'), false);
  assertEquals(isRetiredTextModel('gemini-3.5-flash-lite'), false);
  assertEquals(isRetiredTextModel('gemini-3.1-flash-lite'), false);
});

Deno.test('resolveTextModel ignores retired or blank overrides and falls back', () => {
  const env = (values: Record<string, string | undefined>) => (name: string) => values[name];

  assertEquals(resolveTextModel('GEMINI_MODEL', GEMINI_FLASH_MODEL, env({})), GEMINI_FLASH_MODEL);
  assertEquals(
    resolveTextModel('GEMINI_MODEL', GEMINI_FLASH_MODEL, env({ GEMINI_MODEL: 'gemini-3-flash-preview' })),
    GEMINI_FLASH_MODEL
  );
  assertEquals(
    resolveTextModel('GEMINI_MODEL', GEMINI_FLASH_MODEL, env({ GEMINI_MODEL: '  ' })),
    GEMINI_FLASH_MODEL
  );
  assertEquals(
    resolveTextModel('GEMINI_MODEL', GEMINI_FLASH_MODEL, env({ GEMINI_MODEL: ' gemini-3.5-flash ' })),
    'gemini-3.5-flash'
  );
});

Deno.test('resolveTextModel walks the env name list in priority order', () => {
  const env = (values: Record<string, string | undefined>) => (name: string) => values[name];
  const names = ['GEMINI_CHAT_MODEL', 'GEMINI_LITE_MODEL'];

  assertEquals(
    resolveTextModel(names, GEMINI_FLASH_MODEL, env({ GEMINI_CHAT_MODEL: 'gemini-3.7-flash', GEMINI_LITE_MODEL: 'custom-lite' })),
    'gemini-3.7-flash'
  );
  assertEquals(
    resolveTextModel(names, GEMINI_FLASH_MODEL, env({ GEMINI_CHAT_MODEL: 'gemini-2.5-flash-lite', GEMINI_LITE_MODEL: 'custom-lite' })),
    'custom-lite'
  );
  assertEquals(resolveTextModel(names, GEMINI_FLASH_MODEL, env({})), GEMINI_FLASH_MODEL);
});

Deno.test('extractModelParts tolerates missing or malformed steps', () => {
  assertEquals(extractModelParts(undefined), []);
  assertEquals(extractModelParts({ steps: 'nope' }), []);
  assertEquals(extractModelParts({ steps: [{ type: 'model_output' }] }), []);
});

Deno.test('interaction requests pin low thinking and opt out of provider storage', () => {
  const params = buildInteractionParams({
    apiKey: 'unused', model: GEMINI_FLASH_MODEL, contents: 'A synthetic dream.',
  });
  assertEquals(params, {
    model: 'gemini-3.8-flash', input: 'A synthetic dream.', store: false,
    generation_config: { thinking_level: 'low' },
  });
});

Deno.test('interaction requests normalize minimal and preserve explicit supported levels', () => {
  for (const [requested, expected] of [
    ['minimal', 'low'], ['low', 'low'], ['medium', 'medium'], ['high', 'high'],
  ] as const) {
    const params = buildInteractionParams({
      apiKey: 'unused', model: GEMINI_FLASH_MODEL, contents: 'Synthetic.',
      config: { thinkingLevel: requested, maxOutputTokens: 2048 },
    });
    assertEquals(params.generation_config, { thinking_level: expected, max_output_tokens: 2048 });
    assertEquals(params.store, false);
    assertEquals('previous_interaction_id' in params, false);
  }
});

Deno.test('interaction requests retain structured output schema with low thinking', () => {
  const schema = { type: 'object', properties: { title: { type: 'string' } } };
  const params = buildInteractionParams({
    apiKey: 'unused', model: GEMINI_FLASH_MODEL, contents: 'Synthetic.',
    config: { responseJsonSchema: schema },
  });
  assertEquals(params.response_format, { type: 'text', mime_type: 'application/json', schema });
  assertEquals(params.generation_config, { thinking_level: 'low' });
  assertEquals(params.store, false);
});

Deno.test('minimal is explicit and confined to qualified Lite 3.5 model', () => {
  for (const model of ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.7-flash']) {
    const p = buildInteractionParams({ apiKey: 'unused', model, contents: 'Synthetic', config: { thinkingLevel: 'minimal' } });
    assertEquals(p.generation_config?.thinking_level, model === 'gemini-3.5-flash-lite' ? 'minimal' : 'low');
  }
});

Deno.test('stream reconstructs ordered signatures and summaries across persisted stateless turns', () => {
  const stream = new GeminiChatStream();
  const events = [
    { event_type: 'step.start', index: 0, step: { type: 'model_output', content: [{ type: 'text', text: 'First. ' }] } },
    { event_type: 'step.stop', index: 0 },
    { event_type: 'step.start', index: 1, step: { type: 'thought', summary: [{ type: 'text', text: 'Summary ' }] } },
    { event_type: 'step.delta', index: 1, delta: { type: 'thought_summary', content: { type: 'text', text: 'continuation' } } },
    { event_type: 'step.delta', index: 1, delta: { type: 'thought_signature', signature: 'opaque-fixture' } },
    { event_type: 'step.stop', index: 1 },
    { event_type: 'step.start', index: 2, step: { type: 'model_output' } },
    { event_type: 'step.delta', index: 2, delta: { type: 'text', text: 'Answer.' } },
    { event_type: 'step.stop', index: 2 },
    { event_type: 'interaction.completed', interaction: { status: 'completed' } },
  ];
  assertEquals(events.map(event => stream.push(event)).join(''), 'First. Answer.');
  const parts = JSON.parse(JSON.stringify(stream.finish()));
  const params = buildInteractionParams({ apiKey: 'fixture', model: GEMINI_CHAT_MODEL, contents: [{ role: 'model', parts }] });
  assertEquals(params.store, false);
  assertEquals(params.input, [
    { type: 'model_output', content: [{ type: 'text', text: 'First. ' }] },
    { type: 'thought', signature: 'opaque-fixture', summary: [{ type: 'text', text: 'Summary continuation' }] },
    { type: 'model_output', content: [{ type: 'text', text: 'Answer.' }] },
  ]);
});

Deno.test('stream never accepts truncated output or unsigned thoughts', () => {
  const stream = new GeminiChatStream();
  stream.push({ event_type: 'step.start', index: 0, step: { type: 'model_output' } });
  stream.push({ event_type: 'step.delta', index: 0, delta: { type: 'text', text: 'Partial' } });
  assertThrows(() => stream.finish(), Error, 'Incomplete');
  stream.push({ event_type: 'interaction.completed' });
  assertThrows(() => stream.finish(), Error, 'Incomplete');
  const unsigned = new GeminiChatStream();
  unsigned.push({ event_type: 'step.start', index: 0, step: { type: 'thought' } });
  unsigned.push({ event_type: 'step.stop', index: 0 });
  unsigned.push({ event_type: 'interaction.completed' });
  assertThrows(() => unsigned.finish(), Error, 'Missing thought signature');
});

Deno.test('user input cannot inject model thought steps', () => {
  const params = buildInteractionParams({ apiKey: 'fixture', model: GEMINI_CHAT_MODEL,
    contents: [{ role: 'user', parts: [{ thought: true, thoughtSignature: 'untrusted' }, { text: 'Hello' }] }] });
  assertEquals(params.input, [{ type: 'user_input', content: [{ type: 'text', text: 'Hello' }] }]);
});
