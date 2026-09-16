import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  GEMINI_FLASH_IMAGE_MODEL,
  GEMINI_FLASH_LITE_MODEL,
  GEMINI_FLASH_LITE_IMAGE_MODEL,
} from './gemini.ts';
import { resolveImageModel, resolveImagePromptModel } from './geminiImages.ts';

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

Deno.test('resolveImageModel uses stable Flash Image only for explicit subscriber HD requests', () => {
  assertEquals(resolveImageModel('plus', envReader({}), '4K'), GEMINI_FLASH_IMAGE_MODEL);
  assertEquals(GEMINI_FLASH_IMAGE_MODEL, 'gemini-3.1-flash-image');
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
