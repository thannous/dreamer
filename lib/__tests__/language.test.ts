import { describe, expect, it } from 'vitest';

import { normalizeAppLanguage, resolveEffectiveLanguage, SUPPORTED_APP_LANGUAGES } from '../language';

describe('language helpers', () => {
  it('normalizes supported app languages', () => {
    for (const code of SUPPORTED_APP_LANGUAGES) {
      expect(normalizeAppLanguage(code)).toBe(code);
    }
  });

  it('falls back to English for unsupported values', () => {
    expect(normalizeAppLanguage('de')).toBe('en');
    expect(normalizeAppLanguage(undefined)).toBe('en');
  });

  it('resolves effective language based on preference', () => {
    expect(resolveEffectiveLanguage('auto', 'fr')).toBe('fr');
    expect(resolveEffectiveLanguage('es', 'fr')).toBe('es');
  });
});
