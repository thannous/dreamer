import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  extractInteractionImage,
  extractModelParts,
  GEMINI_FLASH_LITE_MODEL,
  GEMINI_FLASH_MODEL,
  isRetiredTextModel,
  resolveTextModel,
} from './gemini.ts';

Deno.test('text model constants point at current Interactions-era models', () => {
  assertEquals(GEMINI_FLASH_MODEL, 'gemini-3.6-flash');
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
    resolveTextModel(names, GEMINI_FLASH_LITE_MODEL, env({ GEMINI_CHAT_MODEL: 'gemini-3.6-flash', GEMINI_LITE_MODEL: 'custom-lite' })),
    'gemini-3.6-flash'
  );
  assertEquals(
    resolveTextModel(names, GEMINI_FLASH_LITE_MODEL, env({ GEMINI_CHAT_MODEL: 'gemini-2.5-flash-lite', GEMINI_LITE_MODEL: 'custom-lite' })),
    'custom-lite'
  );
  assertEquals(resolveTextModel(names, GEMINI_FLASH_LITE_MODEL, env({})), GEMINI_FLASH_LITE_MODEL);
});

Deno.test('extractModelParts tolerates missing or malformed steps', () => {
  assertEquals(extractModelParts(undefined), []);
  assertEquals(extractModelParts({ steps: 'nope' }), []);
  assertEquals(extractModelParts({ steps: [{ type: 'model_output' }] }), []);
});
