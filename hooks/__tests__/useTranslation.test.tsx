/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock LanguageContext
const mockLanguage = vi.hoisted(() => ({ current: 'en' }));

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: mockLanguage.current,
    setLanguage: vi.fn(),
    locale: { languageTag: `${mockLanguage.current}-US` },
  }),
}));

// Mock i18n getTranslator
vi.mock('../../lib/i18n', () => ({
  getTranslator: (lang: string) => {
    const translations: Record<string, Record<string, string>> = {
      en: {
        'common.hello': 'Hello',
        'common.greeting': 'Hello, {name}!',
        'common.count': 'You have {count} items',
        'common.cancel': 'Cancel',
      },
      fr: {
        'common.hello': 'Bonjour',
        'common.greeting': 'Bonjour, {name}!',
        'common.count': 'Vous avez {count} articles',
        'common.cancel': 'Annuler',
      },
      es: {
        'common.hello': 'Hola',
        'common.greeting': 'Hola, {name}!',
        'common.count': 'Tienes {count} artículos',
        'common.cancel': 'Cancelar',
      },
    };

    return (key: string, replacements?: Record<string, string | number>) => {
      const langTranslations = translations[lang] || translations.en;
      let result = langTranslations[key] || key;

      if (replacements) {
        for (const [k, v] of Object.entries(replacements)) {
          result = result.replace(`{${k}}`, String(v));
        }
      }

      return result;
    };
  },
  loadTranslations: () => new Promise(() => {}),
}));

import { useTranslation } from '../useTranslation';

describe('useTranslation', () => {
  describe('translation function', () => {
    it('given English language when translating key then returns English text', () => {
      mockLanguage.current = 'en';
      const { result } = renderHook(() => useTranslation());

      expect(result.current.t('common.hello')).toBe('Hello');
    });

    it('given French language when translating key then returns French text', () => {
      mockLanguage.current = 'fr';
      const { result } = renderHook(() => useTranslation());

      expect(result.current.t('common.hello')).toBe('Bonjour');
    });

    it('given Spanish language when translating key then returns Spanish text', () => {
      mockLanguage.current = 'es';
      const { result } = renderHook(() => useTranslation());

      expect(result.current.t('common.hello')).toBe('Hola');
    });

    it('given unknown key when translating then returns key as fallback', () => {
      mockLanguage.current = 'en';
      const { result } = renderHook(() => useTranslation());

      expect(result.current.t('unknown.key')).toBe('unknown.key');
    });

    it('given key with placeholder when providing replacement then interpolates value', () => {
      mockLanguage.current = 'en';
      const { result } = renderHook(() => useTranslation());

      const translated = result.current.t('common.greeting', { name: 'World' });

      expect(translated).toBe('Hello, World!');
    });

    it('given key with numeric placeholder when providing number then interpolates', () => {
      mockLanguage.current = 'en';
      const { result } = renderHook(() => useTranslation());

      const translated = result.current.t('common.count', { count: 5 });

      expect(translated).toBe('You have 5 items');
    });

    it('given French with placeholder when providing replacement then interpolates in French', () => {
      mockLanguage.current = 'fr';
      const { result } = renderHook(() => useTranslation());

      const translated = result.current.t('common.greeting', { name: 'Monde' });

      expect(translated).toBe('Bonjour, Monde!');
    });
  });

  describe('currentLang', () => {
    it('given English language when getting currentLang then returns en', () => {
      mockLanguage.current = 'en';
      const { result } = renderHook(() => useTranslation());

      expect(result.current.currentLang).toBe('en');
    });

    it('given French language when getting currentLang then returns fr', () => {
      mockLanguage.current = 'fr';
      const { result } = renderHook(() => useTranslation());

      expect(result.current.currentLang).toBe('fr');
    });

    it('given Spanish language when getting currentLang then returns es', () => {
      mockLanguage.current = 'es';
      const { result } = renderHook(() => useTranslation());

      expect(result.current.currentLang).toBe('es');
    });
  });

  describe('memoization', () => {
    it('given same language when re-rendering then returns stable reference', () => {
      mockLanguage.current = 'en';
      const { result, rerender } = renderHook(() => useTranslation());

      const firstT = result.current.t;
      rerender();
      const secondT = result.current.t;

      expect(firstT).toBe(secondT);
    });
  });

  describe('multiple translations', () => {
    it('translates multiple keys correctly', () => {
      mockLanguage.current = 'en';
      const { result } = renderHook(() => useTranslation());

      expect(result.current.t('common.hello')).toBe('Hello');
      expect(result.current.t('common.cancel')).toBe('Cancel');
    });

    it('handles language switch across translations', () => {
      mockLanguage.current = 'en';
      const { result: enResult } = renderHook(() => useTranslation());
      expect(enResult.current.t('common.cancel')).toBe('Cancel');

      mockLanguage.current = 'fr';
      const { result: frResult } = renderHook(() => useTranslation());
      expect(frResult.current.t('common.cancel')).toBe('Annuler');
    });
  });
});
