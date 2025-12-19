/* @vitest-environment happy-dom */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetLanguagePreference = vi.fn();
const mockSaveLanguagePreference = vi.fn();
const mockUseLocales = vi.fn();

vi.mock('expo-localization', () => ({
  useLocales: () => mockUseLocales(),
}));

vi.mock('../../services/storageService', () => ({
  getLanguagePreference: mockGetLanguagePreference,
  saveLanguagePreference: mockSaveLanguagePreference,
}));

const { LanguageProvider, useLanguage } = await import('../LanguageContext');

type MockLocale = {
  languageCode: string;
  languageTag: string;
  regionCode: string;
  textDirection: 'ltr' | 'rtl';
};

const buildLocales = (overrides?: Partial<MockLocale>) => ([
  {
    languageCode: 'en',
    languageTag: 'en-US',
    regionCode: 'US',
    textDirection: 'ltr',
    ...overrides,
  },
]);

describe('LanguageContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocales.mockReturnValue(buildLocales());
    mockGetLanguagePreference.mockResolvedValue('auto');
  });

  it('uses the initial preference without loading storage', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LanguageProvider initialPreference="es">{children}</LanguageProvider>
    );

    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.loaded).toBe(true);
    expect(result.current.preference).toBe('es');
    expect(result.current.language).toBe('es');
    expect(result.current.systemLanguage).toBe('en');
    expect(mockGetLanguagePreference).not.toHaveBeenCalled();
  });

  it('loads stored preference when not provided', async () => {
    mockGetLanguagePreference.mockResolvedValue('fr');
    mockUseLocales.mockReturnValue(buildLocales({ languageCode: 'es', languageTag: 'es-ES' }));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LanguageProvider>{children}</LanguageProvider>
    );

    const { result } = renderHook(() => useLanguage(), { wrapper });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.preference).toBe('fr');
    expect(result.current.language).toBe('fr');
    expect(result.current.systemLanguage).toBe('es');
  });

  it('marks loaded even if storage fails', async () => {
    mockGetLanguagePreference.mockRejectedValue(new Error('storage error'));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LanguageProvider>{children}</LanguageProvider>
    );

    const { result } = renderHook(() => useLanguage(), { wrapper });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.preference).toBe('auto');
    expect(result.current.language).toBe('en');
  });

  it('persists preference updates', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LanguageProvider>{children}</LanguageProvider>
    );

    const { result } = renderHook(() => useLanguage(), { wrapper });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    await act(async () => {
      await result.current.setPreference('es');
    });

    expect(mockSaveLanguagePreference).toHaveBeenCalledWith('es');
    expect(result.current.preference).toBe('es');
    expect(result.current.language).toBe('es');
  });

  it('throws when hook is used outside provider', () => {
    expect(() => renderHook(() => useLanguage())).toThrow(
      'useLanguage must be used within LanguageProvider'
    );
  });
});
