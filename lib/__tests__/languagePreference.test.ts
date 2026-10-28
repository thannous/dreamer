import { describe, expect, it, jest } from '@jest/globals';

import { updateLanguagePreference } from '../languagePreference';
import { getTranscriptionLocale } from '../locale';

jest.mock('../locale', () => ({
  getTranscriptionLocale: jest.fn((language: string) => `locale-${language}`),
}));

describe('updateLanguagePreference', () => {
  it('uses system language for auto preference and requests offline model for that locale', async () => {
    const ensureOfflineModel = jest.fn().mockResolvedValue(undefined);
    const setPreference = jest.fn().mockResolvedValue(undefined);

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
    const ensureOfflineModel = jest.fn().mockRejectedValue(new Error('offline error'));
    const setPreference = jest.fn().mockResolvedValue(undefined);

    await updateLanguagePreference({
      preference: 'fr',
      systemLanguage: 'en',
      setPreference,
      ensureOfflineModel,
    });

    expect(getTranscriptionLocale).toHaveBeenCalledWith('fr');
    expect(setPreference).toHaveBeenCalledWith('fr');
  });

  it('saves the language immediately while reporting when the optional model check settles', async () => {
    let finish!: () => void;
    const check = new Promise<void>((resolve) => { finish = resolve; });
    const setPreference = jest.fn().mockResolvedValue(undefined);
    const pending: boolean[] = [];

    await updateLanguagePreference({
      preference: 'fr',
      systemLanguage: 'en',
      setPreference,
      ensureOfflineModel: () => check,
      onOfflineModelPendingChange: (value) => pending.push(value),
    });
    expect(setPreference).toHaveBeenCalledWith('fr');
    expect(pending).toEqual([true]);
    finish();
    await check;
    await Promise.resolve();
    await Promise.resolve();
    expect(pending).toEqual([true, false]);
  });
});
