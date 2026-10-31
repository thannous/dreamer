/* @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

import { OfflineModelDownloadSheet } from '@/components/recording/OfflineModelDownloadSheet';
import { loadTranslations } from '@/lib/i18n';

let mockLanguage = 'en';

jest.mock('react-native', () => ({
  ActivityIndicator: () => null,
  Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('expo-speech-recognition', () => ({ ExpoSpeechRecognitionModule: {} }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'dark' }) }));
jest.mock('@/constants/noctaliaDesign', () => ({ getNoctaliaDesignTokens: () => ({ accent: {} }) }));
jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: require('@/lib/i18n').getTranslator(mockLanguage) }),
}));
jest.mock('@/components/ui/StandardBottomSheet', () => ({
  StandardBottomSheet: ({ subtitle }: { subtitle?: string }) => <p data-testid="subtitle">{subtitle}</p>,
}));

describe('OfflineModelDownloadSheet', () => {
  it.each(['de', 'en', 'es', 'fr', 'it', 'pt'])('gives the pack size with one approximation sign in %s', async (language: string) => {
    await loadTranslations(language);
    mockLanguage = language;
    render(<OfflineModelDownloadSheet visible onClose={jest.fn()} locale="en-US" onDownloadComplete={jest.fn()} />);
    const subtitle = screen.getByTestId('subtitle').textContent ?? '';
    expect(subtitle).toContain('(~45 MB)');
    expect(subtitle).not.toContain('~~');
  });

  it.each([
    ['fr', 'en-US', 'vocalement en anglais,'],
    ['en', 'fr-FR', 'vocally in French,'],
    ['de', 'pt-BR', 'auf Portugiesisch per Sprache'],
    ['es', 'it-IT', 'vocalmente en italiano,'],
    ['it', 'de-DE', 'vocalmente in tedesco,'],
    ['pt', 'es-ES', 'por voz em espanhol,'],
  ])('names the language in %s rather than the %s code', async (language: string, locale: string, named: string) => {
    await loadTranslations(language);
    mockLanguage = language;
    render(<OfflineModelDownloadSheet visible onClose={jest.fn()} locale={locale} onDownloadComplete={jest.fn()} />);
    const subtitle = screen.getByTestId('subtitle').textContent ?? '';
    expect(subtitle).toContain(named);
    expect(subtitle).not.toContain(locale);
  });
});
