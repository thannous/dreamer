/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSetThemePreference = jest.fn();
const mockSetLanguagePreference = jest.fn();
const mockSetJournalLayoutPreference = jest.fn();
const mockUpdateLanguagePreference = jest.fn();
const mockEnsureOfflineSttModel = jest.fn();
const mockRouterPush = jest.fn();

const mockUseTheme = jest.fn();
const mockUseLanguage = jest.fn();
const mockUseJournalLayoutPreference = jest.fn();

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('@/context/LanguageContext', () => ({
  useLanguage: () => mockUseLanguage(),
}));

jest.mock('@/hooks/useJournalLayoutPreference', () => ({
  useJournalLayoutPreference: () => mockUseJournalLayoutPreference(),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/lib/languagePreference', () => ({
  updateLanguagePreference: (params: unknown) => mockUpdateLanguagePreference(params),
}));

jest.mock('@/services/nativeSpeechRecognition', () => ({
  ensureOfflineSttModel: (...args: unknown[]) => mockEnsureOfflineSttModel(...args),
}));

jest.mock('expo-router', () => ({
  router: { push: (href: unknown) => mockRouterPush(href) },
}));

const {
  useJournalLayoutSettingsPreference,
  useLanguageSettingsPreference,
  useRecordingGuideAction,
  useThemeSettingsPreference,
} = require('../useSettingsPreferences');

describe('settings preference controllers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({
      loaded: true,
      preference: 'auto',
      setPreference: mockSetThemePreference,
      systemMode: 'dark',
    });
    mockUseLanguage.mockReturnValue({
      language: 'fr',
      loaded: true,
      preference: 'fr',
      setPreference: mockSetLanguagePreference,
      systemLanguage: 'fr',
    });
    mockUseJournalLayoutPreference.mockReturnValue({
      loaded: true,
      preference: 'cards',
      setPreference: mockSetJournalLayoutPreference,
    });
    mockSetThemePreference.mockResolvedValue(undefined);
    mockUpdateLanguagePreference.mockResolvedValue(undefined);
    mockSetJournalLayoutPreference.mockResolvedValue(undefined);
  });

  it('exposes translated theme options and persists a selection', async () => {
    const { result } = renderHook(() => useThemeSettingsPreference());

    expect(result.current.loading).toBe(false);
    expect(result.current.currentLabel).toBe('settings.theme.option.auto.label');
    expect(result.current.options.map((option: { value: string; current: boolean }) => ({
      value: option.value,
      current: option.current,
    }))).toEqual([
      { value: 'auto', current: true },
      { value: 'light', current: false },
      { value: 'dark', current: false },
    ]);

    await act(async () => {
      await result.current.select('dark');
    });

    expect(mockSetThemePreference).toHaveBeenCalledWith('dark');
    expect(result.current.saving).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it('surfaces a persistence error without changing the context-backed current value', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSetThemePreference.mockRejectedValueOnce(new Error('storage unavailable'));
    const { result } = renderHook(() => useThemeSettingsPreference());

    await act(async () => {
      await result.current.set('light');
    });

    expect(result.current.value).toBe('auto');
    expect(result.current.error).toBe(true);
    expect(result.current.saving).toBe(false);
    consoleError.mockRestore();
  });

  it('reuses the shared language update flow including offline STT preparation', async () => {
    const { result } = renderHook(() => useLanguageSettingsPreference());

    expect(result.current.options.find((option: { value: string }) => option.value === 'fr').current)
      .toBe(true);

    await act(async () => {
      await result.current.select('de');
    });

    expect(mockUpdateLanguagePreference).toHaveBeenCalledWith({
      preference: 'de',
      systemLanguage: 'fr',
      setPreference: mockSetLanguagePreference,
      ensureOfflineModel: expect.any(Function),
    });
  });

  it('persists journal layout through the existing preference hook', async () => {
    const { result } = renderHook(() => useJournalLayoutSettingsPreference());

    expect(result.current.currentLabel).toBe('settings.journal_layout.option.cards.label');
    expect(result.current.options[0].testID).toBe('btn.settings.journalLayout.cards');

    await act(async () => {
      await result.current.select('compact');
    });

    expect(mockSetJournalLayoutPreference).toHaveBeenCalledWith('compact');
  });

  it('replays the recording guide on the same route and params as the existing card', async () => {
    const { result } = renderHook(() => useRecordingGuideAction());

    await act(async () => {
      await result.current.restart();
    });

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/recording',
      params: { replayGuide: '1' },
    });
    await waitFor(() => expect(result.current.saving).toBe(false));
  });
});
