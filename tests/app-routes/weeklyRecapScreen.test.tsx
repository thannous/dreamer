/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockDreams: any[] = [];
let mockIsPlus = false;

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

jest.mock('react-native', () => ({
  ...jest.requireActual('../react-native-stub'),
}));
jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => true,
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/inspiration/AtmosphericBackground', () => ({
  AtmosphericBackground: () => null,
}));
jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-icon={name} />,
}));
jest.mock('@/context/ThemeContext', () => {
  const { LightTheme } = require('@/constants/journalTheme');
  return { useTheme: () => ({ colors: LightTheme, mode: 'light', shadows: { lg: {} } }) };
});
jest.mock('@/context/DreamsContext', () => ({
  useDreamsData: () => ({ dreams: mockDreams, loaded: true }),
}));
jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ isActive: mockIsPlus }),
}));
jest.mock('@/hooks/useLocaleFormatting', () => ({
  useLocaleFormatting: () => ({ formatDate: (date: Date) => date.toISOString().slice(5, 10) }),
}));
jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, replacements?: Record<string, string | number>) =>
      replacements ? `${key}|${Object.values(replacements).join(',')}` : key,
  }),
}));

const { TID } = require('@/lib/testIDs');
const { WeeklyRecapScreen } = require('@/components/recap/WeeklyRecapScreen');

const analyzed = (overrides: Record<string, unknown>) => ({
  id: NOW - DAY,
  transcript: 'A quiet shore at night.',
  title: 'Quiet shore',
  interpretation: 'A full reading.',
  shareableQuote: '',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  isAnalyzed: true,
  analysisStatus: 'done',
  analyzedAt: NOW,
  ...overrides,
});

describe('WeeklyRecapScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
    mockDreams = [];
    mockIsPlus = false;
  });

  it('offers to record when the week is empty', () => {
    render(<WeeklyRecapScreen />);

    expect(screen.getByTestId(TID.Text.WeeklyRecapCount).textContent).toBe('0');
    fireEvent.click(screen.getByTestId(TID.Button.WeeklyRecapRecord));
    expect(mockPush).toHaveBeenCalledWith('/recording');
  });

  it('shows the week signals, locks the emotion for free users and links the dream to explore', () => {
    mockDreams = [
      analyzed({ id: NOW - DAY, theme: 'calm', symbols: [{ name: 'Water', meaning: '' }], emotions: [{ name: 'fear', insight: '' }] }),
      analyzed({ id: NOW - 2 * DAY, theme: 'calm', symbols: [{ name: 'water', meaning: '' }], emotions: [{ name: 'fear', insight: '' }] }),
    ];
    render(<WeeklyRecapScreen />);

    expect(screen.getByTestId(TID.Text.WeeklyRecapCount).textContent).toBe('2');
    expect(screen.getByTestId(TID.Text.WeeklyRecapTheme).textContent).toBe('dream.theme.calm');
    expect(screen.getByTestId(TID.Text.WeeklyRecapSymbol).textContent).toBe('weekly_recap.signals.symbol_value|Water,2');
    expect(screen.queryByTestId(TID.Text.WeeklyRecapEmotion)).toBeNull();

    fireEvent.click(screen.getByTestId(TID.Button.WeeklyRecapUnlockEmotion));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/paywall', params: { trigger: 'stats_profile' } });

    fireEvent.click(screen.getByTestId(TID.Button.WeeklyRecapOpenDream));
    expect(mockPush).toHaveBeenCalledWith(`/journal/${NOW - DAY}`);
  });

  it('reveals the recurring emotion for Plus subscribers', () => {
    mockIsPlus = true;
    mockDreams = [
      analyzed({ id: NOW - DAY, emotions: [{ name: 'fear', insight: '' }] }),
      analyzed({ id: NOW - 2 * DAY, emotions: [{ name: 'fear', insight: '' }] }),
    ];
    render(<WeeklyRecapScreen />);

    expect(screen.getByTestId(TID.Text.WeeklyRecapEmotion).textContent).toBe('stats.emotion.family.fear');
  });
});
