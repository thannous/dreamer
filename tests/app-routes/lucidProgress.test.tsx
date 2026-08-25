/* @jest-environment jsdom */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';

const mockPush = jest.fn();
const mockDeleteExperiment = jest.fn();
const NOW = Date.UTC(2026, 7, 25, 12);
const DAY = 24 * 60 * 60 * 1000;

function experiment(overrides: Record<string, unknown>) {
  return {
    id: 'experiment',
    occurredAt: NOW - DAY,
    technique: 'mild',
    preparationMinutes: 10,
    result: 'none',
    lucidityLevel: 1,
    recallLevel: 3,
    sleepQuality: 3,
    factors: [],
    updatedAt: NOW,
    ...overrides,
  };
}

const state = {
  experiments: [] as ReturnType<typeof experiment>[],
  weeklyReviews: [] as {
    id: string;
    weekStart: string;
    completedAt: number;
    practiceDays: number;
    recallDays: number;
    lucidDreams: number;
    recommendedTechnique: 'mild' | 'ssild' | 'wbtb' | null;
    notes?: string;
    updatedAt: number;
  }[],
};

jest.mock('react-native', () => jest.requireActual('../react-native-stub'));

jest.mock('expo-router', () => ({
  router: { push: mockPush },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span />,
}));

jest.mock('@/constants/lucidTheme', () => ({
  getLucidPalette: () => ({
    accent: '#7654d4',
    accentSoft: '#eee8ff',
    amber: '#9a6200',
    background: '#fff',
    border: '#ccc',
    cyan: '#087f8c',
    danger: '#b42318',
    surface: '#fff',
    surfaceRaised: '#f4f4f4',
    text: '#111',
    textMuted: '#777',
    textSecondary: '#555',
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'light' }),
}));

jest.mock('@/hooks/useLucidNow', () => ({
  useLucidNow: () => Date.UTC(2026, 7, 25, 12),
}));

jest.mock('@/context/LucidTrainerContext', () => {
  const { getLucidContent } = jest.requireActual('@/lib/lucid/content');
  return {
    useLucidTrainer: () => ({
      state,
      content: getLucidContent('en'),
      deleteExperiment: mockDeleteExperiment,
    }),
  };
});

jest.mock('@/components/lucid/LucidUI', () => ({
  LucidScreen: ({ children, testID }: { children: React.ReactNode; testID?: string }) => (
    <main data-testid={testID}>{children}</main>
  ),
  LucidCard: ({
    children,
    testID,
    accessibilityLabel,
  }: {
    children: React.ReactNode;
    testID?: string;
    accessibilityLabel?: string;
  }) => (
    <section aria-label={accessibilityLabel} data-testid={testID}>
      {children}
    </section>
  ),
  LucidPill: ({ label }: { label: string }) => <span>{label}</span>,
  LucidSectionHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
  LucidButton: ({
    label,
    onPress,
  }: {
    label: string;
    onPress: () => void;
  }) => <button onClick={onPress}>{label}</button>,
  LucidMetric: ({ value, label }: { value: string; label: string }) => (
    <div>
      <span>{value}</span>
      <span>{label}</span>
    </div>
  ),
}));

const { default: LucidProgressScreen } = require('@/app/lucid/(tabs)/progress');

describe('Lucid Trainer progress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    state.experiments = [];
    state.weeklyReviews = [];
  });

  afterEach(cleanup);

  it('uses the rolling 7-day sleep average instead of all-time experiments', () => {
    state.experiments = [
      experiment({
        id: 'old',
        occurredAt: NOW - 10 * DAY,
        sleepQuality: 1,
        result: 'none',
      }),
      experiment({
        id: 'recent',
        occurredAt: NOW - DAY,
        sleepQuality: 5,
        result: 'lucid',
        technique: 'ssild',
      }),
    ];

    render(<LucidProgressScreen />);

    expect(screen.getByText('sleep quality / 5')).toBeTruthy();
    expect(screen.getByText('5.0')).toBeTruthy();
    expect(screen.queryByText('3.0')).toBeNull();
  });

  it('renders saved weekly reviews without inventing rows or mixing morning experiences', () => {
    state.experiments = [
      experiment({
        id: 'morning-1',
        occurredAt: NOW - DAY,
        notes: 'morning private notes',
      }),
    ];
    state.weeklyReviews = [
      {
        id: 'week-recent',
        weekStart: '2026-08-18',
        completedAt: 2,
        practiceDays: 4,
        recallDays: 3,
        lucidDreams: 1,
        recommendedTechnique: 'mild',
        notes: 'MILD felt easier',
        updatedAt: 2,
      },
      {
        id: 'week-older',
        weekStart: '2026-08-04',
        completedAt: 1,
        practiceDays: 2,
        recallDays: 1,
        lucidDreams: 0,
        recommendedTechnique: null,
        notes: 'protected sleep',
        updatedAt: 1,
      },
    ];

    render(<LucidProgressScreen />);

    expect(screen.getByText('Saved weekly reviews')).toBeTruthy();
    expect(screen.getByTestId('lucid-weekly-history-week-recent')).toBeTruthy();
    expect(screen.getByTestId('lucid-weekly-history-week-older')).toBeTruthy();
    expect(screen.getByText('practice days: 4')).toBeTruthy();
    expect(screen.getByText('recall days: 3')).toBeTruthy();
    expect(screen.getByText('Suggested focus: MILD')).toBeTruthy();
    expect(screen.getByText('MILD felt easier')).toBeTruthy();
    expect(screen.getByText('protected sleep')).toBeTruthy();
    expect(screen.getByText('morning private notes')).toBeTruthy();
    expect(screen.queryByTestId('lucid-weekly-history-empty')).toBeNull();
  });

  it('keeps an empty weekly history empty until a review is saved', () => {
    render(<LucidProgressScreen />);

    expect(screen.getByTestId('lucid-weekly-history-empty')).toBeTruthy();
    expect(
      screen.getByText('Saved weekly reviews will appear here after you complete one.'),
    ).toBeTruthy();
    expect(screen.getByText('Your morning reviews will appear here.')).toBeTruthy();
  });
});
