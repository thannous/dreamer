/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import type { LucidExperienceLevel, LucidExperiment, LucidGoal } from '@/lib/lucid/model';

const NOW = 1_700_000_000_000;

const mockCurrentExperiments = [
  { id: 'mild-1', occurredAt: NOW - 86_400_000, technique: 'mild', result: 'lucid', sleepQuality: 4 },
  { id: 'mild-2', occurredAt: NOW - 2 * 86_400_000, technique: 'mild', result: 'lucid', sleepQuality: 5 },
  { id: 'mild-3', occurredAt: NOW - 3 * 86_400_000, technique: 'mild', result: 'lucid', sleepQuality: 3 },
  { id: 'ssild-1', occurredAt: NOW - 86_400_000, technique: 'ssild', result: 'none', sleepQuality: 2 },
  { id: 'ssild-2', occurredAt: NOW - 2 * 86_400_000, technique: 'ssild', result: 'none', sleepQuality: 2 },
  { id: 'ssild-3', occurredAt: NOW - 3 * 86_400_000, technique: 'ssild', result: 'none', sleepQuality: 2 },
].map((item) => ({
  ...item,
  preparationMinutes: 5,
  lucidityLevel: item.result === 'lucid' ? 4 : 0,
  recallLevel: item.result === 'lucid' ? 4 : 0,
  factors: [],
  updatedAt: item.occurredAt,
}));

const mockStaleExperiment = {
  id: 'stale',
  occurredAt: NOW - 8 * 86_400_000,
  technique: 'wbtb',
  preparationMinutes: 5,
  result: 'none',
  lucidityLevel: 0,
  recallLevel: 0,
  sleepQuality: 0,
  factors: [],
  updatedAt: NOW - 8 * 86_400_000,
};

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => <span aria-hidden="true" /> }));

jest.mock('expo-image', () => ({
  Image: () => <img alt="" />,
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('react-native', () => {
  const native = jest.requireActual('../react-native-stub');
  const flattenStyle = (style: unknown): Record<string, unknown> =>
    (Array.isArray(style) ? style : [style]).reduce(
      (result, item) => ({ ...result, ...(item && typeof item === 'object' ? item : {}) }),
      {},
    );
  return {
    ...native,
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      disabled,
      onPress,
      style,
      testID,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { checked?: boolean; selected?: boolean; disabled?: boolean };
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
      style?: unknown;
      testID?: string;
    }) => (
      <button
        aria-checked={accessibilityState?.checked}
        aria-label={accessibilityLabel}
        aria-selected={accessibilityState?.selected}
        data-testid={testID}
        disabled={disabled}
        onClick={onPress}
        role={accessibilityRole}
        style={flattenStyle(style) as React.CSSProperties}
      >
        {children}
      </button>
    ),
    View: ({
      accessibilityLabel,
      children,
      style,
      testID,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      style?: unknown;
      testID?: string;
    }) => (
      <div
        aria-label={accessibilityLabel}
        data-testid={testID}
        style={flattenStyle(style) as React.CSSProperties}
      >
        {children}
      </div>
    ),
    Text: ({ children, style }: { children?: React.ReactNode; style?: unknown }) => (
      <span style={flattenStyle(style) as React.CSSProperties}>{children}</span>
    ),
  };
});

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'dark' }),
}));

jest.mock('@/constants/lucidTheme', () => ({
  ...jest.requireActual('@/constants/lucidTheme'),
  getLucidPalette: () => ({
    accent: '#123456',
    accentOn: '#8febd0',
    accentSoft: '#153039',
    amber: '#f3c37d',
    amberSoft: '#3a291e',
    background: '#06131a',
    border: '#1d343d',
    borderInteractive: '#abcdef',
    surface: '#0d2029',
    surfaceRaised: '#eeeeee',
    text: '#111111',
    textMuted: '#777777',
    textSecondary: '#555555',
  }),
}));

jest.mock('@/hooks/useLucidNow', () => ({ useLucidNow: () => NOW }));

const mockTrainerState = {
  onboarding: {
    goal: 'first_lucid_dream' as LucidGoal,
    experience: 'beginner' as LucidExperienceLevel,
  },
  experiments: [...mockCurrentExperiments, mockStaleExperiment] as LucidExperiment[],
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

jest.mock('@/context/LucidTrainerContext', () => {
  const { getLucidContent } = jest.requireActual('@/lib/lucid/content');
  return {
    useLucidTrainer: () => ({
      state: mockTrainerState,
      content: getLucidContent('en'),
      deleteExperiment: jest.fn(),
    }),
  };
});

jest.mock('@/components/lucid/LucidUI', () => ({
  LUCID_TAB_BAR_INSET: 92,
  LucidScreen: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  LucidButton: ({ label }: { label: string }) => <button>{label}</button>,
  LucidIconAction: ({ label }: { label: string }) => (
    <button aria-label={label}>{label}</button>
  ),
}));

const { default: LucidProgressScreen } = require('@/app/lucid/(tabs)/progress');

const originalExperiments = [...mockTrainerState.experiments];

describe('Lucid Trainer progress screen', () => {
  afterEach(() => {
    mockTrainerState.onboarding.goal = 'first_lucid_dream';
    mockTrainerState.onboarding.experience = 'beginner';
    mockTrainerState.weeklyReviews = [];
    mockTrainerState.experiments = [...originalExperiments];
    cleanup();
  });

  it('uses the same seven-day window for sleep quality and visually distinguishes the leader', () => {
    render(<LucidProgressScreen />);

    expect(screen.getByTestId('metric-sleep quality / 5').textContent).toContain('3.0');
    expect(screen.getByTestId('lucid-progress-method-mild').getAttribute('aria-label')).toBe('MILD. 3 attempts · 100%');
    expect(screen.getByTestId('lucid-progress-method-ssild').getAttribute('aria-label')).toBe('SSILD. 3 attempts · 0%');
    expect(screen.getByTestId('lucid-progress-method-wbtb').getAttribute('aria-label')).toBe('WBTB. No attempts yet');
  });

  it('exposes MILD, SSILD and WBTB on the constellation without hiding them from assistive tech', () => {
    render(<LucidProgressScreen />);

    expect(screen.getByLabelText('MILD. 3 attempts · 100%')).not.toBeNull();
    expect(screen.getByLabelText('SSILD. 3 attempts · 0%')).not.toBeNull();
    expect(screen.getByLabelText('WBTB. No attempts yet')).not.toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('keeps method bars behind an accessible disclosure so the constellation is not duplicated', () => {
    render(<LucidProgressScreen />);

    expect(screen.getByTestId('lucid-progress-methods-toggle')).not.toBeNull();
    expect(screen.queryAllByText('3 attempts · 100%')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('lucid-progress-methods-toggle'));
    expect(screen.queryAllByText('3 attempts · 100%').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Early signal').length).toBeGreaterThan(0);
  });

  it('leads with recall when the persisted goal is remembering dreams', () => {
    mockTrainerState.onboarding.goal = 'improve_recall';
    mockTrainerState.onboarding.experience = 'occasional';
    render(<LucidProgressScreen />);

    expect(screen.getAllByText('Remember more')).toHaveLength(1);
    const metricIds = screen
      .getAllByTestId(/metric-/)
      .map((node) => node.getAttribute('data-testid'));
    expect(metricIds).toEqual([
      'metric-recall rate',
      'metric-attempts',
      'metric-lucid dreams',
      'metric-sleep quality / 5',
    ]);
    expect(screen.getByTestId('metric-sleep quality / 5').textContent).toContain('3.0');
    expect(screen.getByTestId('metric-recall rate').textContent).toContain('50%');
  });

  it('leads with sleep when the persisted goal is staying lucid calmly', () => {
    mockTrainerState.onboarding.goal = 'stabilize_lucidity';
    mockTrainerState.onboarding.experience = 'experienced';
    render(<LucidProgressScreen />);

    expect(screen.getByText('Stay calm')).not.toBeNull();
    const metricIds = screen
      .getAllByTestId(/metric-/)
      .map((node) => node.getAttribute('data-testid'));
    expect(metricIds).toEqual([
      'metric-sleep quality / 5',
      'metric-lucid dreams',
      'metric-attempts',
      'metric-recall rate',
    ]);
    expect(screen.getByTestId('metric-lucid dreams').textContent).toContain('3');
    expect(screen.getByTestId('metric-attempts').textContent).toContain('6');
  });

  it('renders saved weekly reviews newest first without mixing them with morning entries', () => {
    mockTrainerState.weeklyReviews = [
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
    ];

    render(<LucidProgressScreen />);

    expect(screen.getByText('Saved weekly reviews')).not.toBeNull();
    expect(screen.getByText('practice days: 4')).not.toBeNull();
    expect(screen.getByText('recall days: 3')).not.toBeNull();
    expect(screen.getByText('Suggested focus: MILD')).not.toBeNull();
    expect(screen.getByText('MILD felt easier')).not.toBeNull();
    expect(screen.getByText('protected sleep')).not.toBeNull();
    expect(screen.getAllByTestId(/lucid-weekly-history-/).map((item) => item.dataset.testid)).toEqual([
      'lucid-weekly-history-week-recent',
      'lucid-weekly-history-week-older',
    ]);
  });

  it('keeps weekly history empty until a review is saved', () => {
    render(<LucidProgressScreen />);

    expect(screen.getByTestId('lucid-weekly-history-empty')).not.toBeNull();
    expect(
      screen.getByText('Saved weekly reviews will appear here after you complete one.'),
    ).not.toBeNull();
  });

  it('renders a write capture with linked practice without treating it as a reported method or null scores', () => {
    mockTrainerState.experiments = [
      {
        id: 'write-1',
        occurredAt: NOW,
        technique: null,
        preparationMinutes: null,
        result: null,
        lucidityLevel: null,
        recallLevel: null,
        sleepQuality: null,
        factors: [],
        updatedAt: NOW,
        captureMode: 'write',
        recallText: 'a staircase that kept rearranging',
        cueOutcome: 'heard_in_dream',
        techniqueAutoLink: {
          technique: 'ssild',
          source: 'program_practice',
          practiceDate: '2026-08-26',
        },
      },
    ];

    render(<LucidProgressScreen />);

    expect(screen.getByText('Linked practice: SSILD')).not.toBeNull();
    expect(screen.getByText(/Cue heard in the dream/)).not.toBeNull();
    expect(screen.getByText('a staircase that kept rearranging')).not.toBeNull();
    expect(screen.queryByText('null/5')).toBeNull();
    expect(screen.getByLabelText(/Delete: Linked practice: SSILD/)).not.toBeNull();
    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(/No lucidity/);
  });

  it('renders nothing-for-now as open-ended capture rather than no dream or no recall', () => {
    mockTrainerState.experiments = [
      {
        id: 'deferred-1',
        occurredAt: NOW,
        technique: null,
        preparationMinutes: null,
        result: null,
        lucidityLevel: null,
        recallLevel: null,
        sleepQuality: null,
        factors: [],
        updatedAt: NOW,
        captureMode: 'nothing_for_now',
        cueOutcome: 'not_heard',
      },
    ];

    render(<LucidProgressScreen />);

    expect(screen.getByText('Nothing for now')).not.toBeNull();
    expect(screen.getByText(/Cue not heard/)).not.toBeNull();
    expect(screen.queryByText('null/5')).toBeNull();
    const body = (document.body.textContent ?? '').toLowerCase();
    expect(body).not.toMatch(/did not dream|no dream|no recall/);
  });
});
