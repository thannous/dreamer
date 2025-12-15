import { describe, expect, it, vi } from 'vitest';

import { updateLanguagePreference } from '../languagePreference';
import { getTranscriptionLocale } from '../locale';

vi.mock('../locale', () => ({
  getTranscriptionLocale: vi.fn((language: string) => `locale-${language}`),
}));

describe('updateLanguagePreference', () => {
  it('uses system language for auto preference and requests offline model for that locale', async () => {
    const ensureOfflineModel = vi.fn().mockResolvedValue(undefined);
    const setPreference = vi.fn().mockResolvedValue(undefined);

    const result = await updateLanguagePreference({
      preference: 'auto',
      systemLanguage: 'es',
      setPreference,
      ensureOfflineModel,
    });

    expect(getTranscriptionLocale).toHaveBeenCalledWith('es');
    expect(ensureOfflineModel).toHaveBeenCalledWith('locale-es');
    expect(setPreference).toHaveBeenCalledWith('auto');
    expect(result).toEqual({ effectiveLanguage: 'es', locale: 'locale-es' });
  });

  it('swallows offline model errors while still saving preference', async () => {
    const ensureOfflineModel = vi.fn().mockRejectedValue(new Error('offline error'));
    const setPreference = vi.fn().mockResolvedValue(undefined);

    await updateLanguagePreference({
      preference: 'fr',
      systemLanguage: 'en',
      setPreference,
      ensureOfflineModel,
    });

    expect(getTranscriptionLocale).toHaveBeenCalledWith('fr');
    expect(setPreference).toHaveBeenCalledWith('fr');
  });
});
