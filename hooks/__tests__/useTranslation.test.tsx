/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock useLanguage
vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    locale: { languageTag: 'en-US' },
    setLanguage: vi.fn(),
  }),
}));

// Mock getTranslator
const mockTranslator = vi.fn((key: string) => `translated:${key}`);
vi.mock('../../lib/i18n', () => ({
  getTranslator: vi.fn(() => mockTranslator),
}));

import { useTranslation } from '../useTranslation';

describe('useTranslation', () => {
  it('returns t function and currentLang', () => {
    const { result } = renderHook(() => useTranslation());

    expect(result.current.t).toBeDefined();
    expect(result.current.currentLang).toBe('en');
  });

  it('t function translates keys', () => {
    const { result } = renderHook(() => useTranslation());

    const translated = result.current.t('some.key');

    expect(translated).toBe('translated:some.key');
  });

  it('memoizes translator based on language', () => {
    const { result, rerender } = renderHook(() => useTranslation());

    const firstT = result.current.t;
    rerender();
    const secondT = result.current.t;

    // Same language = same function reference (memoized)
    expect(firstT).toBe(secondT);
  });
});
