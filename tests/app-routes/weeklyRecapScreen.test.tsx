/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

jest.mock('@/lib/storeReview', () => ({
  canOpenStoreReviewPage: () => false,
  markStoreReviewPaywallSeen: jest.fn(),
  openStoreReviewPage: jest.fn(),
  recordStoreReviewAnalysisRead: jest.fn(async () => undefined),
  requestStoreReviewIfDue: jest.fn(async () => false),
}));
jest.mock('@/components/ui/DreamerBackground', () => ({ DreamerArtworkWindow: () => null, DreamerBackground: () => null }));

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockDreams: any[] = [];
let mockUser: { id: string } | null = { id: 'user-1' };
let mockQuota: { tier: string; usage: unknown; loading: boolean; error: Error | null } = {
  tier: 'free',
  usage: { analysis: { used: 1, limit: 3, remaining: 2 } },
  loading: false,
  error: null,
};

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
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock('@/hooks/useQuota', () => ({
  useQuota: () => mockQuota,
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
    mockUser = { id: 'user-1' };
    mockQuota = { tier: 'free', usage: { analysis: { used: 1, limit: 3, remaining: 2 } }, loading: false, error: null };
  });

  it('offers to record when the week is empty', () => {
    render(<WeeklyRecapScreen />);

    expect(screen.getByTestId(TID.Text.WeeklyRecapCount).textContent).toBe('0');
    fireEvent.click(screen.getByTestId(TID.Button.WeeklyRecapRecord));
    expect(mockPush).toHaveBeenCalledWith('/recording');
  });

  it('shows the week signals, the recurring emotion included, and links the dream to explore', () => {
    mockDreams = [
      analyzed({ id: NOW - DAY, theme: 'calm', symbols: [{ name: 'Water', meaning: '' }], emotions: [{ name: 'fear', insight: '' }] }),
      analyzed({ id: NOW - 2 * DAY, theme: 'calm', symbols: [{ name: 'water', meaning: '' }], emotions: [{ name: 'fear', insight: '' }] }),
    ];
    render(<WeeklyRecapScreen />);

    expect(screen.getByTestId(TID.Text.WeeklyRecapCount).textContent).toBe('2');
    expect(screen.getByTestId(TID.Text.WeeklyRecapTheme).textContent).toBe('dream.theme.calm');
    expect(screen.getByTestId(TID.Text.WeeklyRecapSymbol).textContent).toBe('weekly_recap.signals.symbol_value|Water,2');
    expect(screen.getByTestId(TID.Text.WeeklyRecapEmotion).textContent).toBe('stats.emotion.family.fear');

    fireEvent.click(screen.getByTestId(TID.Button.WeeklyRecapOpenDream));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/journal/[id]', params: { id: String(NOW - DAY) } });
  });

  it('opens the dream to analyse while free analyses remain', () => {
    mockDreams = [analyzed({ id: NOW - DAY, isAnalyzed: false, analysisStatus: 'none', interpretation: '', analyzedAt: undefined })];
    render(<WeeklyRecapScreen />);

    const button = screen.getByTestId(TID.Button.WeeklyRecapOpenDream);
    expect(button.textContent).toBe('weekly_recap.next.analyze_cta');
    fireEvent.click(button);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/journal/[id]', params: { id: String(NOW - DAY) } });
  });

  it('opens that dream\'s own Plus offer once the free analyses are used', () => {
    mockQuota = { ...mockQuota, usage: { analysis: { used: 3, limit: 3, remaining: 0 } } };
    mockDreams = [analyzed({ id: NOW - DAY, isAnalyzed: false, analysisStatus: 'none', interpretation: '', analyzedAt: undefined })];
    render(<WeeklyRecapScreen />);

    const button = screen.getByTestId(TID.Button.WeeklyRecapOpenDream);
    expect(button.textContent).toBe('weekly_recap.next.analyze_cta_plus');
    fireEvent.click(button);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/paywall',
      params: expect.objectContaining({ trigger: 'analysis_cta', dreamId: String(NOW - DAY), dreamOwnerId: 'user-1' }),
    });
  });

  it('keeps a failed request on its dream page, where it resumes without a new analysis', () => {
    mockQuota = { ...mockQuota, usage: { analysis: { used: 3, limit: 3, remaining: 0 } } };
    mockDreams = [analyzed({
      id: NOW - DAY,
      isAnalyzed: false,
      analysisStatus: 'failed',
      analysisRequestId: '8f14e45f-ceea-4e6b-9a3c-2b1d0f6a7c11',
      interpretation: '',
      analyzedAt: undefined,
    })];
    render(<WeeklyRecapScreen />);

    const button = screen.getByTestId(TID.Button.WeeklyRecapOpenDream);
    expect(button.textContent).toBe('weekly_recap.next.analyze_cta');
    fireEvent.click(button);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/journal/[id]', params: { id: String(NOW - DAY) } });
  });
});
