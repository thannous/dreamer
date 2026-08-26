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
let mockOnboarding = {
  goal: 'improve_recall' as const,
  experience: 'beginner' as const,
  weeklyTarget: 3,
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
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
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
    children,
    onPress,
    testID,
  }: {
    accessibilityLabel: string;
    children: React.ReactNode;
    onPress: () => void;
    testID?: string;
  }) => (
    <button aria-label={accessibilityLabel} data-testid={testID} onClick={onPress}>
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
      state: { onboarding: mockOnboarding, progress: mockProgress },
      content: getLucidContent('fr'),
    }),
  };
});

const { default: LucidTodayScreen } = require('@/app/lucid/(tabs)/index');

describe('Lucid Trainer today screen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
    mockProgress = [];
    mockNow = Date.UTC(2026, 7, 24, 12, 0);
    mockOnboarding = {
      goal: 'improve_recall',
      experience: 'beginner',
      weeklyTarget: 3,
      sleepSchedule: { bedtime: '22:30', wakeTime: '07:00', timeZone: 'UTC' },
    };
  });

  it('turns the onboarding goal and rhythm into a reversible starting point', () => {
    render(<LucidTodayScreen />);

    expect(screen.getByText('Point de départ suggéré · MILD')).not.toBeNull();
    expect(screen.getByText('Gardez le fil de vos rêves')).not.toBeNull();
    expect(screen.getByText('Commencez par ce qui reste au réveil.')).not.toBeNull();
    expect(screen.getByLabelText('3 nuits / semaine')).not.toBeNull();
    expect(screen.queryByText('Formuler une intention précise')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Découvrir MILD' }));
    expect(mockPush).toHaveBeenCalledWith('/lucid/(tabs)/programs');
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

    fireEvent.click(screen.getByRole('button', { name: 'Noter la nuit passée' }));
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
});
