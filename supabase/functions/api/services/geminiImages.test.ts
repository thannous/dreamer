import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  GEMINI_FLASH_IMAGE_MODEL,
  GEMINI_FLASH_LITE_MODEL,
  GEMINI_FLASH_LITE_IMAGE_MODEL,
} from './gemini.ts';
import {
  generateImageFromPrompt,
  IMAGE_CONTENT_RULE,
  resolveImageModel,
  resolveImagePromptModel,
} from './geminiImages.ts';

const envReader = (values: Record<string, string | undefined>) => (name: string) => ({ HD_ILLUSTRATIONS_ENABLED: 'true', ...values })[name];

Deno.test('disabled or missing HD flag forces Lite for every tier and ignores premium overrides', () => {
  for (const flag of [undefined, 'false', 'TRUE', '1']) {
    for (const tier of ['free', 'plus', 'guest']) {
      const readEnv = envReader({ HD_ILLUSTRATIONS_ENABLED: flag, IMAGEN_PLUS_MODEL: 'expensive', IMAGEN_MODEL: 'legacy-expensive', IMAGEN_FREE_MODEL: 'custom' });
      assertEquals(resolveImageModel(tier, readEnv, '4K'), GEMINI_FLASH_LITE_IMAGE_MODEL);
      assertEquals(resolveImageModel(tier, readEnv, '1K'), GEMINI_FLASH_LITE_IMAGE_MODEL);
    }
  }
});

Deno.test('resolveImageModel uses the HD image model only for explicit subscriber HD requests', () => {
  assertEquals(resolveImageModel('plus', envReader({}), '4K'), GEMINI_FLASH_IMAGE_MODEL);
  assertEquals(GEMINI_FLASH_IMAGE_MODEL, 'gemini-nano-banana-2.1');
});

Deno.test('resolveImageModel uses stable Flash Lite Image for every non-subscriber tier', () => {
  assertEquals(resolveImageModel('free', envReader({})), GEMINI_FLASH_LITE_IMAGE_MODEL);
  assertEquals(resolveImageModel('guest', envReader({})), GEMINI_FLASH_LITE_IMAGE_MODEL);
  assertEquals(resolveImageModel('premium', envReader({})), GEMINI_FLASH_LITE_IMAGE_MODEL);
  assertEquals(resolveImageModel(undefined, envReader({})), GEMINI_FLASH_LITE_IMAGE_MODEL);
  assertEquals(resolveImageModel('unexpected', envReader({})), GEMINI_FLASH_LITE_IMAGE_MODEL);
  assertEquals(GEMINI_FLASH_LITE_IMAGE_MODEL, 'gemini-3.1-flash-lite-image');
});

Deno.test('resolveImageModel keeps subscriber and free overrides isolated', () => {
  const readEnv = envReader({
    IMAGEN_HD_MODEL: ' custom-plus ',
    IMAGEN_MODEL: 'legacy-plus',
    IMAGEN_FREE_MODEL: ' custom-free ',
  });

  assertEquals(resolveImageModel('plus', readEnv, '2K'), 'custom-plus');
  assertEquals(resolveImageModel('free', readEnv), 'custom-free');
});

Deno.test('HD model is independent of legacy Lite overrides', () => {
  const readEnv = envReader({ IMAGEN_MODEL: GEMINI_FLASH_LITE_IMAGE_MODEL, IMAGEN_PLUS_MODEL: GEMINI_FLASH_LITE_IMAGE_MODEL });

  assertEquals(resolveImageModel('plus', readEnv, '2K'), GEMINI_FLASH_IMAGE_MODEL);
  assertEquals(resolveImageModel('free', readEnv), GEMINI_FLASH_LITE_IMAGE_MODEL);
});

Deno.test('resolveImageModel ignores blank overrides', () => {
  const readEnv = envReader({
    IMAGEN_HD_MODEL: '   ',
    IMAGEN_MODEL: '',
    IMAGEN_FREE_MODEL: '\n',
  });

  assertEquals(resolveImageModel('plus', readEnv, '2K'), GEMINI_FLASH_IMAGE_MODEL);
  assertEquals(resolveImageModel('free', readEnv), GEMINI_FLASH_LITE_IMAGE_MODEL);
});

Deno.test('resolveImageModel ignores retired preview overrides', () => {
  const readEnv = envReader({
    IMAGEN_HD_MODEL: 'gemini-3.1-flash-image-preview',
    IMAGEN_MODEL: 'gemini-3-pro-image-preview',
    IMAGEN_FREE_MODEL: 'gemini-2.5-flash-image-preview',
  });

  assertEquals(resolveImageModel('plus', readEnv, '2K'), GEMINI_FLASH_IMAGE_MODEL);
  assertEquals(resolveImageModel('free', readEnv), GEMINI_FLASH_LITE_IMAGE_MODEL);
  // The deprecated previous HD default, as copied from the old .env.example.
  assertEquals(resolveImageModel('plus', envReader({ IMAGEN_HD_MODEL: 'gemini-3.1-flash-image' }), '2K'), GEMINI_FLASH_IMAGE_MODEL);
});

Deno.test('resolveImagePromptModel uses the stable default when no override is configured', () => {
  assertEquals(resolveImagePromptModel(envReader({})), GEMINI_FLASH_LITE_MODEL);
});

Deno.test('resolveImagePromptModel ignores the retired preview previously used by image jobs', () => {
  assertEquals(
    resolveImagePromptModel(envReader({ GEMINI_LITE_MODEL: 'gemini-3.1-flash-lite-preview' })),
    GEMINI_FLASH_LITE_MODEL
  );
});

Deno.test('resolveImagePromptModel ignores blank overrides and preserves valid custom models', () => {
  assertEquals(
    resolveImagePromptModel(envReader({ GEMINI_LITE_MODEL: '   ' })),
    GEMINI_FLASH_LITE_MODEL
  );
  assertEquals(
    resolveImagePromptModel(envReader({ GEMINI_LITE_MODEL: ' gemini-3.5-flash ' })),
    'gemini-3.5-flash'
  );
});

Deno.test('Plus standard illustrations also use Lite despite premium overrides', () => {
  assertEquals(resolveImageModel('plus', envReader({ IMAGEN_PLUS_MODEL: 'costly-model' })), GEMINI_FLASH_LITE_IMAGE_MODEL);
  assertEquals(resolveImageModel('free', envReader({}), '4K'), GEMINI_FLASH_LITE_IMAGE_MODEL);
});

Deno.test('Lite cannot be configured as the HD model after reactivation', () => {
  assertEquals(resolveImageModel('plus', envReader({ IMAGEN_HD_MODEL: GEMINI_FLASH_LITE_IMAGE_MODEL }), '4K'), GEMINI_FLASH_IMAGE_MODEL);
});

// The provider cannot be asked from a journey which rule it received, so this
// control reads the outgoing request: a prompt written by the client or by the
// analysis must still reach the image model with the content rule.
Deno.test('generateImageFromPrompt sends the content rule with every prompt', async () => {
  const originalFetch = globalThis.fetch;
  const bodies: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    assertEquals(new URL(request.url).hostname, 'generativelanguage.googleapis.com');
    bodies.push(await request.text());
    return new Response(
      JSON.stringify({ id: 'interaction-1', status: 'completed', output_image: { data: 'aW1hZ2U=', mime_type: 'image/png' } }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  }) as typeof fetch;

  try {
    const result = await generateImageFromPrompt({ prompt: 'A lighthouse made of glass  ', apiKey: 'test-key', model: GEMINI_FLASH_LITE_IMAGE_MODEL });
    assertEquals(result.imageBase64, 'aW1hZ2U=');
    assertEquals(bodies.length, 1);
    const sent = JSON.stringify(JSON.parse(bodies[0]));
    assertEquals(sent.includes(JSON.stringify(`A lighthouse made of glass\n\n${IMAGE_CONTENT_RULE}`).slice(1, -1)), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
