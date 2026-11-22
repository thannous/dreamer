/* @jest-environment jsdom */

import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import type { LucidExperiment } from '@/lib/lucid/model';

// Saturday 21 November 2026 at 06:30 in Paris: the review covers 15 to 21 November.
const mockNow = Date.UTC(2026, 10, 21, 5, 30);
const mockSaveWeeklyReview = jest.fn();

function lucidCapture(id: string, occurredAt: number): LucidExperiment {
  return {
    id,
    occurredAt,
    updatedAt: occurredAt,
    technique: 'mild',
    preparationMinutes: 10,
    result: 'lucid',
    lucidityLevel: 3,
    recallLevel: 4,
    sleepQuality: 3,
    factors: [],
    captureMode: 'write',
    recallText: 'I knew I was dreaming.',
    cueOutcome: 'not_heard',
  };
}

const mockState = {
  // 14 November at 07:00 is within the last 168 hours but 7 calendar days back.
  experiments: [
    lucidCapture('outside', Date.UTC(2026, 10, 14, 6, 0)),
    lucidCapture('inside', Date.UTC(2026, 10, 16, 6, 0)),
  ],
  progress: [{ practiceDates: ['2026-11-14', '2026-11-17'] }],
  realityChecks: [{ id: 'rc', occurredAt: Date.UTC(2026, 10, 14, 19, 0) }],
  preferences: { timeZone: 'Europe/Paris' },
  onboarding: {},
};

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => false } }));
jest.mock('react-native', () => jest.requireActual('../react-native-stub'));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'dark' }) }));
jest.mock('@/hooks/useLucidNow', () => ({ useLucidNow: () => mockNow }));
jest.mock('@/context/LucidTrainerContext', () => {
  const { getLucidContent } = jest.requireActual('@/lib/lucid/content');
  return {
    useLucidTrainer: () => ({
      state: mockState,
      content: getLucidContent('en'),
      saveWeeklyReview: (...args: unknown[]) => mockSaveWeeklyReview(...args),
    }),
  };
});
jest.mock('@/components/lucid/LucidUI', () => ({
  LucidScreen: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  LucidButton: ({ label, onPress }: { label: string; onPress?: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
  LucidCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  LucidIconAction: ({ label }: { label: string }) => <button aria-label={label}>{label}</button>,
  LucidIconTile: () => null,
  LucidMetric: ({ label, value }: { label: string; value: string }) => (
    <span data-testid={`metric-${label}`}>{value}</span>
  ),
  LucidPill: ({ label }: { label: string }) => <span>{label}</span>,
}));

const { default: LucidWeeklyScreen } = require('@/routes/lucid/lucid/weekly');

describe('Lucid weekly review', () => {
  afterEach(() => {
    mockSaveWeeklyReview.mockReset();
    cleanup();
  });

  it('saves every figure over the same 7 calendar days, starting on its first counted date', async () => {
    mockSaveWeeklyReview.mockResolvedValue(undefined);
    render(<LucidWeeklyScreen />);

    expect(screen.getByTestId('metric-practice days').textContent).toBe('2');
    expect(screen.getByTestId('metric-recall days').textContent).toBe('1');
    expect(screen.getByTestId('metric-lucid dreams').textContent).toBe('1');

    fireEvent.click(screen.getByText('Continue'));
    fireEvent.click(screen.getByText('Review'));
    await act(async () => {
      fireEvent.click(screen.getByText('Save weekly review'));
    });

    expect(mockSaveWeeklyReview).toHaveBeenCalledWith(expect.objectContaining({
      weekStart: '2026-11-15',
      practiceDays: 2,
      recallDays: 1,
      lucidDreams: 1,
    }));
  });
});
