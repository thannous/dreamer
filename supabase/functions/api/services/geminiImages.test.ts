import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  GEMINI_FLASH_IMAGE_MODEL,
  GEMINI_FLASH_LITE_IMAGE_MODEL,
} from './gemini.ts';
import { resolveImageModel } from './geminiImages.ts';

const envReader = (values: Record<string, string | undefined>) => (name: string) => values[name];

Deno.test('resolveImageModel uses stable Flash Image for subscribers', () => {
  assertEquals(resolveImageModel('plus', envReader({})), GEMINI_FLASH_IMAGE_MODEL);
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
    IMAGEN_PLUS_MODEL: ' custom-plus ',
    IMAGEN_MODEL: 'legacy-plus',
    IMAGEN_FREE_MODEL: ' custom-free ',
  });

  assertEquals(resolveImageModel('plus', readEnv), 'custom-plus');
  assertEquals(resolveImageModel('free', readEnv), 'custom-free');
});

Deno.test('resolveImageModel supports the legacy subscriber override without charging free users', () => {
  const readEnv = envReader({ IMAGEN_MODEL: ' legacy-plus ' });

  assertEquals(resolveImageModel('plus', readEnv), 'legacy-plus');
  assertEquals(resolveImageModel('free', readEnv), GEMINI_FLASH_LITE_IMAGE_MODEL);
});

Deno.test('resolveImageModel ignores blank overrides', () => {
  const readEnv = envReader({
    IMAGEN_PLUS_MODEL: '   ',
    IMAGEN_MODEL: '',
    IMAGEN_FREE_MODEL: '\n',
  });

  assertEquals(resolveImageModel('plus', readEnv), GEMINI_FLASH_IMAGE_MODEL);
  assertEquals(resolveImageModel('free', readEnv), GEMINI_FLASH_LITE_IMAGE_MODEL);
});

Deno.test('resolveImageModel ignores retired preview overrides', () => {
  const readEnv = envReader({
    IMAGEN_PLUS_MODEL: 'gemini-3.1-flash-image-preview',
    IMAGEN_MODEL: 'gemini-3-pro-image-preview',
    IMAGEN_FREE_MODEL: 'gemini-2.5-flash-image-preview',
  });

  assertEquals(resolveImageModel('plus', readEnv), GEMINI_FLASH_IMAGE_MODEL);
  assertEquals(resolveImageModel('free', readEnv), GEMINI_FLASH_LITE_IMAGE_MODEL);
});
