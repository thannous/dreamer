import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    Version: 33,
  },
}));

const locale = 'fr-FR';

describe('ensureOfflineSttModel', () => {
  it('awaits the registered prompt handler before checking installation again', async () => {
    vi.resetModules();
    const getSupportedLocales = vi
      .fn()
      .mockResolvedValueOnce({ installedLocales: [] })
      .mockResolvedValueOnce({ installedLocales: [locale] });

    const show = vi.fn();
    let resolveShow: (() => void) | undefined;
    show.mockImplementation(() => new Promise<void>((resolve) => (resolveShow = resolve)));

    const mod = await import('./nativeSpeechRecognition');
    mod.__setCachedSpeechModuleForTests({ getSupportedLocales } as any);
    mod.registerOfflineModelPromptHandler({ isVisible: false, show });

    const promise = mod.ensureOfflineSttModel(locale);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith(locale);
    expect(getSupportedLocales).toHaveBeenCalledTimes(1);

    const raced = await Promise.race([promise.then(() => 'done'), Promise.resolve('pending')]);
    expect(raced).toBe('pending');

    resolveShow?.();

    await expect(promise).resolves.toBe(true);
    expect(getSupportedLocales).toHaveBeenCalledTimes(2);
  });

  it('returns false when no prompt handler is registered and the model is missing', async () => {
    vi.resetModules();
    const getSupportedLocales = vi.fn().mockResolvedValue({ installedLocales: [] });

    const mod = await import('./nativeSpeechRecognition');
    mod.__setCachedSpeechModuleForTests({ getSupportedLocales } as any);
    mod.registerOfflineModelPromptHandler(null);

    await expect(mod.ensureOfflineSttModel(locale)).resolves.toBe(false);
  });
});
