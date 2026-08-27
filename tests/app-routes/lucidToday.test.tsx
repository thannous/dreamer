/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

const mockPush = jest.fn();
let mockProgress: {
  technique: 'mild';
  status: 'active' | 'paused';
  currentDay: number;
  completedExerciseIds: string[];
}[] = [];
let mockNow = Date.UTC(2026, 7, 24, 12, 0);
let mockExperiments: {
  id: string;
  occurredAt: number;
  updatedAt: number;
  captureMode?: 'speak' | 'write' | 'nothing_for_now';
  recallText?: string;
  recallLevel?: number | null;
  result?: 'none' | 'pre_lucid' | 'lucid' | null;
  sleepQuality?: number | null;
  factors?: string[];
  cueOutcome?: 'not_heard' | 'heard_in_dream' | 'heard_woke' | 'indeterminate' | null;
}[] = [];
let mockOnboarding: {
  goal: 'improve_recall' | 'first_lucid_dream' | 'more_frequent_lucidity' | 'stabilize_lucidity';
  experience: 'beginner' | 'occasional' | 'experienced';
  weeklyTarget: number;
  audioSafetyAccepted: boolean;
  sleepSchedule: { bedtime: string; wakeTime: string; timeZone: string };
} = {
  goal: 'improve_recall',
  experience: 'beginner',
  weeklyTarget: 3,
  audioSafetyAccepted: true,
  sleepSchedule: { bedtime: '22:30', wakeTime: '07:00', timeZone: 'UTC' },
};

jest.mock('expo-router', () => ({ router: { push: mockPush } }));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => <span aria-hidden="true" /> }));

jest.mock('expo-image', () => ({
  Image: () => <img alt="" data-testid="lucid-today-artwork" />,
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 24, left: 0 }),
}));

jest.mock('react-native', () => {
  const native = jest.requireActual('../react-native-stub');
  return {
    ...native,
    StyleSheet: {
      ...native.StyleSheet,
      hairlineWidth: 1,
    },
    Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <span data-testid={testID}>{children}</span>
    ),
    View: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityValue,
      children,
      testID,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityValue?: { max?: number; min?: number; now?: number; text?: string };
      children?: React.ReactNode;
      testID?: string;
    }) => (
      <div
        aria-label={accessibilityLabel}
        aria-valuemax={accessibilityValue?.max}
        aria-valuemin={accessibilityValue?.min}
        aria-valuenow={accessibilityValue?.now}
        aria-valuetext={accessibilityValue?.text}
        data-testid={testID}
        role={accessibilityRole}
      >
        {children}
      </div>
    ),
  };
});

jest.mock('@/components/lucid/LucidUI', () => ({
  LUCID_TAB_BAR_INSET: 92,
  LucidScreen: ({ children, testID }: { children: React.ReactNode; testID?: string }) => (
    <main data-testid={testID}>{children}</main>
  ),
}));

jest.mock('@/components/motion', () => ({
  PressableScale: ({
    accessibilityLabel,
    accessibilityState,
    children,
    onPress,
    testID,
  }: {
    accessibilityLabel: string;
    accessibilityState?: { expanded?: boolean };
    children: React.ReactNode;
    onPress: () => void;
    testID?: string;
  }) => (
    <button
      aria-expanded={accessibilityState?.expanded}
      aria-label={accessibilityLabel}
      data-testid={testID}
      onClick={onPress}
    >
      {children}
    </button>
  ),
  Reveal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'dark' }),
}));

jest.mock('@/hooks/useLucidNow', () => ({
  useLucidNow: () => mockNow,
}));

jest.mock('@/context/LucidTrainerContext', () => {
  const { getLucidContent } = jest.requireActual('@/lib/lucid/content');
  return {
    useLucidTrainer: () => ({
      state: { onboarding: mockOnboarding, progress: mockProgress, experiments: mockExperiments },
      content: getLucidContent('fr'),
    }),
  };
});

const { default: LucidTodayScreen } = require('@/app/lucid/(tabs)/index');

function rememberedExperiments() {
  return [
    { id: 'a', occurredAt: 1, updatedAt: 1, recallText: 'hallway', recallLevel: 3, result: 'pre_lucid' as const },
    { id: 'b', occurredAt: 2, updatedAt: 2, recallText: 'garden', recallLevel: 4, result: 'lucid' as const },
  ];
}

function usePracticeOnboarding() {
  mockOnboarding = {
    ...mockOnboarding,
    goal: 'first_lucid_dream',
    experience: 'occasional',
  };
  mockExperiments = rememberedExperiments();
}


describe('Lucid Trainer today screen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
    mockProgress = [];
    mockExperiments = [];
    mockNow = Date.UTC(2026, 7, 24, 12, 0);
    mockOnboarding = {
      goal: 'improve_recall',
      experience: 'beginner',
      weeklyTarget: 3,
      audioSafetyAccepted: true,
      sleepSchedule: { bedtime: '22:30', wakeTime: '07:00', timeZone: 'UTC' },
    };
  });

  it('turns the onboarding recall goal into a morning capture instead of a night program', () => {
    render(<LucidTodayScreen />);

    expect(screen.getByText('Renforcer le rappel')).not.toBeNull();
    expect(screen.getByText('Gardez le fil de vos rêves')).not.toBeNull();
    expect(screen.getByText('Notez ce qui reste avant d’entraîner cette nuit.')).not.toBeNull();
    expect(screen.getByLabelText('3 nuits / semaine')).not.toBeNull();
    expect(screen.queryByText('Formuler une intention précise')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByTestId('lucid-today-why').getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByTestId('lucid-today-why').textContent).toBe('Pourquoi ?');
    expect(screen.queryByTestId('lucid-today-why-reason')).toBeNull();

    fireEvent.click(screen.getByTestId('lucid-today-primary'));
    expect(mockPush).toHaveBeenCalledWith('/lucid/morning');
  });

  it('features the action that matches the current sleep-window phase', () => {
    render(<LucidTodayScreen />);

    const featured = screen.getByTestId('lucid-today-context-primary');
    expect(within(featured).getByRole('button', { name: 'Faire un test conscient' })).not.toBeNull();
    expect(within(featured).getByText('Maintenant')).not.toBeNull();
    expect(within(featured).getByText('Test de réalité')).not.toBeNull();
  });

  it('prioritizes the morning review during the configured wake window', () => {
    mockNow = Date.UTC(2026, 7, 24, 8, 0);
    render(<LucidTodayScreen />);

    expect(
      within(screen.getByTestId('lucid-today-context-primary')).getByRole('button', {
        name: 'Noter la nuit passée',
      })
    ).not.toBeNull();
  });

  it('uses the active session, real seven-day position and current duration', () => {
    usePracticeOnboarding();
    mockProgress = [
      {
        technique: 'mild',
        status: 'active',
        currentDay: 3,
        completedExerciseIds: ['mild-01', 'mild-02'],
      },
    ];

    render(<LucidTodayScreen />);

    expect(screen.getByText('Jour 3 · MILD')).not.toBeNull();
    expect(screen.getByText('Entraîner la mémoire prospective')).not.toBeNull();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('3');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe(
      '3/7 aujourd’hui'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continuer · 8 min' }));
    expect(mockPush).toHaveBeenCalledWith('/lucid/session/mild/3');
  });

  it('does not open the current session from Today while the only program is paused', () => {
    usePracticeOnboarding();
    mockProgress = [
      {
        technique: 'mild',
        status: 'paused',
        currentDay: 3,
        completedExerciseIds: ['mild-01', 'mild-02'],
      },
    ];

    render(<LucidTodayScreen />);

    fireEvent.click(screen.getByTestId('lucid-today-primary'));
    expect(mockPush).toHaveBeenCalledWith('/lucid/program/mild');
    expect(mockPush).not.toHaveBeenCalledWith('/lucid/session/mild/3');
  });

  it('keeps contextual actions directly reachable while preserving automation IDs', () => {
    render(<LucidTodayScreen />);

    fireEvent.click(screen.getByTestId('lucid-today-morning'));
    fireEvent.click(screen.getByRole('button', { name: 'Faire un test conscient' }));
    fireEvent.click(screen.getByTestId('lucid-tab-night'));
    fireEvent.click(screen.getByTestId('lucid-tab-settings'));

    expect(mockPush).toHaveBeenNthCalledWith(1, '/lucid/morning');
    expect(mockPush).toHaveBeenNthCalledWith(2, '/lucid/reality-check');
    expect(mockPush).toHaveBeenNthCalledWith(3, '/lucid/(tabs)/night');
    expect(mockPush).toHaveBeenNthCalledWith(4, '/lucid/(tabs)/settings');
    expect(screen.getByRole('button', { name: 'Préparer cette nuit' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Réglages' })).not.toBeNull();
  });

  it('keeps beginner weak recall on morning capture and explains why', () => {
    mockOnboarding = {
      ...mockOnboarding,
      goal: 'first_lucid_dream',
      experience: 'beginner',
    };
    mockExperiments = [
      { id: 'a', occurredAt: 1, updatedAt: 1, result: 'none', recallLevel: 0 },
      { id: 'b', occurredAt: 2, updatedAt: 2, result: 'none', recallLevel: 0 },
    ];

    render(<LucidTodayScreen />);

    expect(screen.getByText('Renforcer le rappel')).not.toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    fireEvent.click(screen.getByTestId('lucid-today-primary'));
    expect(mockPush).toHaveBeenCalledWith('/lucid/morning');

    const why = screen.getByTestId('lucid-today-why');
    expect(why.getAttribute('aria-expanded')).toBe('false');
    expect(why.textContent).toBe('Pourquoi ?');
    fireEvent.click(why);
    expect(screen.getByTestId('lucid-today-why').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('lucid-today-why').textContent).toBe('Masquer la raison');
    expect(screen.getByTestId('lucid-today-why-reason').textContent).toBe(
      'Débutant avec un rappel faible : la mémoire des rêves passe avant les techniques de nuit.'
    );
  });

  it('suggests guided MILD when recall is sufficient for a first lucid dream', () => {
    mockOnboarding = {
      ...mockOnboarding,
      goal: 'first_lucid_dream',
      experience: 'occasional',
    };
    mockExperiments = [
      { id: 'a', occurredAt: 1, updatedAt: 1, recallText: 'hallway', recallLevel: 3, result: 'pre_lucid' },
      { id: 'b', occurredAt: 2, updatedAt: 2, recallText: 'garden', recallLevel: 4, result: 'lucid' },
    ];

    render(<LucidTodayScreen />);

    expect(screen.getByText('Point de départ suggéré · MILD')).not.toBeNull();
    expect(screen.getByText('Remarquez ce qui semble étrange')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Découvrir MILD' }));
    expect(mockPush).toHaveBeenCalledWith('/lucid/(tabs)/programs');
    fireEvent.click(screen.getByTestId('lucid-today-why'));
    expect(screen.getByTestId('lucid-today-why-reason').textContent).toBe(
      'Le rappel suffit pour un premier essai lucide avec MILD guidé.'
    );
  });

  it('protects sleep after degraded mornings and sends the primary action to morning review', () => {
    mockOnboarding = {
      ...mockOnboarding,
      goal: 'first_lucid_dream',
      experience: 'experienced',
    };
    mockExperiments = [
      { id: 'ok', occurredAt: 1, updatedAt: 1, recallText: 'scene', recallLevel: 3, sleepQuality: 4 },
      { id: 'low', occurredAt: 3, updatedAt: 3, recallText: 'still a scene', recallLevel: 2, sleepQuality: 1 },
    ];
    mockProgress = [
      {
        technique: 'mild',
        status: 'active',
        currentDay: 3,
        completedExerciseIds: ['mild-01', 'mild-02'],
      },
    ];

    render(<LucidTodayScreen />);

    expect(screen.getAllByText('Protéger le sommeil').length).toBeGreaterThan(0);
    expect(screen.getByText('Restez lucide, calmement')).not.toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    fireEvent.click(screen.getByTestId('lucid-today-primary'));
    expect(mockPush).toHaveBeenCalledWith('/lucid/morning');
    fireEvent.click(screen.getByTestId('lucid-today-why'));
    expect(screen.getByTestId('lucid-today-why-reason').textContent).toContain('sommeil récent');
  });

  it('reduces night signals after two heard_woke cues even with an active program', () => {
    mockOnboarding = {
      ...mockOnboarding,
      goal: 'first_lucid_dream',
      experience: 'occasional',
    };
    mockExperiments = [
      { id: '1', occurredAt: 1, updatedAt: 1, cueOutcome: 'heard_woke', recallText: 'a', recallLevel: 3 },
      { id: '2', occurredAt: 2, updatedAt: 2, cueOutcome: 'not_heard', recallText: 'b', recallLevel: 3 },
      { id: '3', occurredAt: 3, updatedAt: 3, cueOutcome: 'heard_woke', recallText: 'c', recallLevel: 3 },
    ];
    mockProgress = [
      {
        technique: 'mild',
        status: 'active',
        currentDay: 3,
        completedExerciseIds: ['mild-01', 'mild-02'],
      },
    ];

    render(<LucidTodayScreen />);

    expect(screen.getAllByText('Alléger les signaux').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('lucid-today-primary'));
    expect(mockPush).toHaveBeenCalledWith('/lucid/(tabs)/night');
    fireEvent.click(screen.getByTestId('lucid-today-why'));
    expect(screen.getByTestId('lucid-today-why-reason').textContent).toContain('deux fois');
  });

  it('keeps a normal active program in control and hides an inconsistent why reason', () => {
    mockOnboarding = {
      ...mockOnboarding,
      goal: 'first_lucid_dream',
      experience: 'occasional',
    };
    mockExperiments = [
      { id: 'a', occurredAt: 1, updatedAt: 1, recallText: 'hallway', recallLevel: 3, result: 'pre_lucid' },
      { id: 'b', occurredAt: 2, updatedAt: 2, recallText: 'garden', recallLevel: 4, result: 'lucid' },
    ];
    mockProgress = [
      {
        technique: 'mild',
        status: 'active',
        currentDay: 3,
        completedExerciseIds: ['mild-01', 'mild-02'],
      },
    ];

    render(<LucidTodayScreen />);

    expect(screen.getByText('Jour 3 · MILD')).not.toBeNull();
    expect(screen.getByRole('progressbar')).not.toBeNull();
    expect(screen.queryByTestId('lucid-today-why')).toBeNull();
    expect(screen.queryByTestId('lucid-today-why-reason')).toBeNull();
    fireEvent.click(screen.getByTestId('lucid-today-primary'));
    expect(mockPush).toHaveBeenCalledWith('/lucid/session/mild/3');
  });
});
