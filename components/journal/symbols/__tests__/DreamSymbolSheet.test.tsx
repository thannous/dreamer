/* @jest-environment jsdom */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

import { DreamSymbolSheet } from '@/components/journal/symbols/DreamSymbolSheet';
import { buildSymbolIndex } from '@/lib/symbolLinks';
import type { DreamAnalysis } from '@/lib/types';

// Isolation control: in the web journey the dreamer's own symbol is always opened from its
// first reading before Tendances lists it, so a symbol never opened is not reached there;
// its mock analysis never names two dictionary neighbours, and no reading predates keys.

const mockUpdateDream = jest.fn((_dream: DreamAnalysis) => Promise.resolve());

jest.mock('react-native', () => {
  const React = require('react');
  return {
    Platform: { OS: 'web', select: (options: Record<string, unknown>) => options.web ?? options.default },
    StyleSheet: { create: (styles: Record<string, unknown>) => styles, absoluteFill: {} },
    Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <span data-testid={testID}>{children}</span>
    ),
    View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <div data-testid={testID}>{children}</div>
    ),
  };
});
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: { View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> },
    cubicBezier: () => 'ease',
    useReducedMotion: () => true,
  };
});
jest.mock('react-native-svg', () => ({ __esModule: true, default: () => null, Path: () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/motion', () => ({
  PressableScale: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
    <button type="button" data-testid={testID}>{children}</button>
  ),
}));
jest.mock('@/components/motion/motion', () => ({ EASE: { out: 'ease-out' } }));
jest.mock('@/components/journal/JournalBook', () => ({
  BookStar: () => null,
  BookSubheading: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
}));
jest.mock('@/components/journal/symbols/SymbolMedallion', () => ({ SymbolMedallion: () => null }));
jest.mock('@/components/ui/StandardBottomSheet', () => ({
  StandardBottomSheet: ({ visible, headerContent, children }: {
    visible: boolean;
    headerContent?: React.ReactNode;
    children?: React.ReactNode;
  }) => (visible ? <section>{headerContent}{children}</section> : null),
}));
jest.mock('@/context/DreamsContext', () => ({
  useDreamsActions: () => ({ updateDream: mockUpdateDream }),
}));
jest.mock('@/context/ThemeContext', () => {
  const { DarkTheme } = require('@/constants/journalTheme');
  return { useTheme: () => ({ colors: DarkTheme, mode: 'dark' }) };
});
jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ currentLang: 'en', t: (key: string) => key }),
}));
jest.mock('@/hooks/useLocaleFormatting', () => ({
  useLocaleFormatting: () => ({ formatDate: (value: number) => new Date(value).toISOString().slice(0, 10) }),
}));

const night = (day: number): DreamAnalysis => ({
  id: Date.UTC(2026, 9, day, 6),
  transcript: 'x',
  title: `Dream ${day}`,
  interpretation: 'Reading',
  shareableQuote: '',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  isAnalyzed: true,
  analysisStatus: 'done',
  symbols: [{ name: 'Lamp', meaning: 'Mine.', key: 'grandmother-lamp' }],
});

const dreams = [night(10), night(12)];

function openSymbol(journal: DreamAnalysis[], linkKey: string, dream: DreamAnalysis | null) {
  render(
    <DreamSymbolSheet index={buildSymbolIndex(journal, 'en')} dream={dream} linkKey={linkKey}
      onSelect={() => undefined} onClose={() => undefined} />,
  );
}

const openLamp = (dream: DreamAnalysis | null) => openSymbol(dreams, 'p:grandmother-lamp', dream);

describe('DreamSymbolSheet', () => {
  it('tells the birth of the dreamer’s own symbol from the reading it was born in', () => {
    openLamp(dreams[0]);

    expect(screen.getByText('journal.symbols.born.eyebrow')).toBeTruthy();
  });

  it('does not tell a birth from a later reading: the symbol has already come back', () => {
    openLamp(dreams[1]);

    expect(screen.getByText('journal.symbols.kind.personal')).toBeTruthy();
    expect(screen.queryByText('journal.symbols.born.eyebrow')).toBeNull();
  });

  it('makes a symbol theirs through a keyed reading when its first dream named it before keys', async () => {
    mockUpdateDream.mockClear();
    const older = { ...night(8), symbols: [{ name: 'Lamp', meaning: 'Before keys.' }] };
    openSymbol([older, ...dreams], 'p:grandmother-lamp', older);

    expect(screen.getByText('journal.symbols.born.eyebrow')).toBeTruthy();
    await waitFor(() => expect(mockUpdateDream).toHaveBeenCalledTimes(1));
    expect(mockUpdateDream.mock.calls[0][0].id).toBe(dreams[1].id);
  });

  it('shows the dictionary neighbours the dreamer has dreamed, even in other dreams', () => {
    const journal = [
      { ...night(10), symbols: [{ name: 'Water', meaning: 'Deep.', symbolId: 'water' }] },
      { ...night(12), symbols: [{ name: 'Rain', meaning: 'Again.', symbolId: 'rain' }] },
      { ...night(14), symbols: [{ name: 'Door', meaning: 'Shut.', symbolId: 'door' }] },
    ];
    openSymbol(journal, 'd:water', journal[0]);

    expect(screen.getByText('journal.symbols.related.header')).toBeTruthy();
    expect(screen.getByTestId('dreamSymbol.related.d.rain')).toBeTruthy();
    expect(screen.queryByTestId('dreamSymbol.related.d.door')).toBeNull();
  });

  it('opened outside a reading, makes a returning symbol theirs without telling a birth', async () => {
    mockUpdateDream.mockClear();
    openLamp(null);

    expect(screen.getByText('journal.symbols.kind.personal')).toBeTruthy();
    expect(screen.queryByText('journal.symbols.born.eyebrow')).toBeNull();
    expect(screen.queryByText('journal.symbols.born.body')).toBeNull();
    await waitFor(() => expect(mockUpdateDream).toHaveBeenCalledTimes(1));
    const saved = mockUpdateDream.mock.calls[0][0];
    expect(saved.id).toBe(dreams[1].id);
    expect(saved.symbols?.[0].confirmedAt).toEqual(expect.any(Number));
  });
});
