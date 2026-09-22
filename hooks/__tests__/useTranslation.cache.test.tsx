/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { areTranslationsLoaded, loadTranslations } from '@/lib/i18n';
import { useTranslation } from '../useTranslation';

let mockLanguage = 'en';
jest.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ language: mockLanguage }),
}));

it.each(['en', 'fr'])('does not rerender after mounting with a cached %s pack', async (language) => {
  const pack = await loadTranslations(language);
  mockLanguage = language;
  let renders = 0;
  const { result } = renderHook(() => {
    renders += 1;
    return useTranslation();
  });

  await act(async () => { await Promise.resolve(); });

  expect(result.current.t('common.copy')).toBe(pack['common.copy']);
  expect(result.current.translationRevision).toBe(0);
  expect(renders).toBe(1);
});

it('updates fallback copy when an uncached pack finishes loading', async () => {
  const english = await loadTranslations('en');
  mockLanguage = 'de';
  expect(areTranslationsLoaded('de')).toBe(false);
  const { result } = renderHook(() => useTranslation());
  expect(result.current.t('common.copy')).toBe(english['common.copy']);

  let translatedCopy: string | undefined;
  await act(async () => {
    translatedCopy = (await loadTranslations('de'))['common.copy'];
  });

  expect(areTranslationsLoaded('de-DE')).toBe(true);
  expect(result.current.t('common.copy')).toBe(translatedCopy);
  expect(result.current.translationRevision).toBe(1);
});
