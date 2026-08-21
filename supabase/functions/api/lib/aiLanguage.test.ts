import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { AI_LANGUAGES, aiLanguageName, isAiLanguage, localizedForAi } from './aiLanguage.ts';
import { normalizeAiLanguage } from './aiRequestPolicy.ts';
import { buildDreamContextPrompt } from './prompts.ts';

Deno.test('every supported language has its own prompt language name', () => {
  const names = AI_LANGUAGES.map((lang) => aiLanguageName(lang));
  assertEquals(new Set(names).size, AI_LANGUAGES.length);
  assertEquals(aiLanguageName('pt'), 'Brazilian Portuguese');
});

Deno.test('unknown languages fall back to English', () => {
  assertEquals(aiLanguageName('nl'), 'English');
  assertEquals(isAiLanguage('nl'), false);
  assertEquals(localizedForAi('nl', { en: 1, fr: 2, es: 3, de: 4, it: 5, pt: 6 }), 1);
});

Deno.test('normalizeAiLanguage keeps every language the prompts can render', () => {
  for (const lang of AI_LANGUAGES) {
    assertEquals(normalizeAiLanguage(lang), lang);
    assertEquals(normalizeAiLanguage(`${lang}-BR`), lang);
  }
});

Deno.test('the dream context prompt is localized for every supported language', () => {
  const dream = {
    transcript: 'I was swimming in a dark ocean.',
    title: 'Dark Ocean',
    interpretation: 'The ocean mirrors your emotions.',
    shareable_quote: 'The water knew my name.',
    dream_type: 'Symbolic Dream',
    theme: 'mystical',
  };

  const english = buildDreamContextPrompt(dream, 'en').prompt;

  for (const lang of AI_LANGUAGES) {
    const { prompt } = buildDreamContextPrompt(dream, lang);
    // The transcript and the safety fence are language-independent.
    assertEquals(prompt.includes('<<<BEGIN_DREAM_TRANSCRIPT>>>'), true);
    assertEquals(prompt.includes(dream.transcript), true);
    // Every non-English language must produce different surrounding wording:
    // this is what silently regressed for de/it/pt before.
    if (lang !== 'en') assertNotEquals(prompt, english);
  }
});

Deno.test('the empty-transcript prompt is localized for every supported language', () => {
  const dream = {
    transcript: '',
    title: 'Untitled',
    interpretation: '',
    shareable_quote: '',
    dream_type: 'Dream',
  };

  const english = buildDreamContextPrompt(dream, 'en').prompt;

  for (const lang of AI_LANGUAGES) {
    const { prompt } = buildDreamContextPrompt(dream, lang);
    if (lang !== 'en') assertNotEquals(prompt, english);
  }
});
