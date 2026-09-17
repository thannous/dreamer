/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const mockPush = jest.fn();
const mockState = {
  onboarding: {
    goal: 'first_lucid_dream' as 'first_lucid_dream' | 'improve_recall' | 'more_frequent_lucidity' | 'stabilize_lucidity',
    experience: 'beginner' as 'beginner' | 'occasional' | 'experienced',
    audioSafetyAccepted: true,
  },
  experiments: [] as {
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
  }[],
  progress: [] as {
    technique: string;
    status: string;
    currentDay: number;
    completedExerciseIds: string[];
  }[],
};

jest.mock('expo-router', () => ({ router: { push: mockPush } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => <span aria-hidden="true" /> }));
jest.mock('expo-image', () => ({
  Image: ({ testID }: { testID?: string }) => <img alt="" data-testid={testID} />,
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('react-native', () => {
  const native = jest.requireActual('../react-native-stub');
  return {
    ...native,
    Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <span data-testid={testID}>{children}</span>
    ),
    View: ({ accessibilityLabel, children, testID }: { accessibilityLabel?: string; children?: React.ReactNode; testID?: string }) => (
      <div aria-label={accessibilityLabel} data-testid={testID}>{children}</div>
    ),
  };
});

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'dark' }),
}));

jest.mock('@/context/LucidTrainerContext', () => {
  const { getLucidContent } = jest.requireActual('@/lib/lucid/content');
  return {
    useLucidTrainer: () => ({
      state: mockState,
      content: getLucidContent('fr'),
    }),
  };
});

jest.mock('@/components/lucid/LucidUI', () => ({
  LUCID_TAB_BAR_INSET: 92,
  LucidScreen: ({ children, testID, title }: { children: React.ReactNode; testID?: string; title?: string }) => (
    <main data-testid={testID}>{title ? <h1>{title}</h1> : null}{children}</main>
  ),
  LucidCard: ({ accessibilityLabel, children, onPress, testID }: { accessibilityLabel?: string; children: React.ReactNode; onPress?: () => void; testID?: string }) => (
    <button aria-label={accessibilityLabel} data-testid={testID} onClick={onPress}>{children}</button>
  ),
  LucidProgressBar: ({ accessibilityLabel, value }: { accessibilityLabel?: string; value: number }) => (
    <div aria-label={accessibilityLabel} aria-valuenow={Math.round(value * 100)} role="progressbar" />
  ),
}));

const { default: LucidProgramsScreen } = require('@/app/lucid/(tabs)/programs');

function remembered() {
  return [
    { id: 'a', occurredAt: 1, updatedAt: 1, recallText: 'hallway', recallLevel: 3, result: 'pre_lucid' as const },
    { id: 'b', occurredAt: 2, updatedAt: 2, recallText: 'garden', recallLevel: 4, result: 'lucid' as const },
  ];
}

function noRecall() {
  return [
    { id: 'a', occurredAt: 1, updatedAt: 1, result: 'none' as const, recallLevel: 0 },
    { id: 'b', occurredAt: 2, updatedAt: 2, result: 'none' as const, recallLevel: 0 },
  ];
}

function resetState() {
  mockState.onboarding.goal = 'first_lucid_dream';
  mockState.onboarding.experience = 'beginner';
  mockState.onboarding.audioSafetyAccepted = true;
  mockState.experiments = [];
  mockState.progress = [{
    technique: 'mild',
    status: 'active',
    currentDay: 3,
    completedExerciseIds: ['mild-01', 'mild-03', 'unrelated-id'],
  }];
}

describe('Lucid Trainer programs', () => {
  beforeEach(() => {
    resetState();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('uses three neutral illustrations and derives progress from real session ids', () => {
    render(<LucidProgramsScreen />);

    expect(screen.getByRole('heading', { name: 'Choisissez votre chemin' })).not.toBeNull();
    expect(screen.getByTestId('lucid-program-mild-art')).not.toBeNull();
    expect(screen.getByTestId('lucid-program-ssild-art')).not.toBeNull();
    expect(screen.getByTestId('lucid-program-wbtb-art')).not.toBeNull();

    const mild = screen.getByTestId('lucid-program-mild');
    expect(mild.getAttribute('aria-label')).toContain('en cours');
    expect(mild.getAttribute('aria-label')).toContain('2 / 7 séances');
    expect(screen.getByRole('progressbar', { name: 'MILD, 2 / 7 séances' }).getAttribute('aria-valuenow')).toBe('29');
    expect(screen.queryByText('Point de départ suggéré')).toBeNull();
    expect(
      screen.getAllByRole('button').map((card) => card.getAttribute('data-testid')).filter((id) => id?.startsWith('lucid-program-'))
    ).toEqual([
      'lucid-program-mild',
      'lucid-program-ssild',
      'lucid-program-wbtb',
    ]);
  });

  it('suggests MILD with a visible why when recall is sufficient for a first lucid dream', () => {
    mockState.progress = [];
    mockState.onboarding.experience = 'occasional';
    mockState.experiments = remembered();

    render(<LucidProgramsScreen />);

    expect(
      screen.getAllByRole('button').map((card) => card.getAttribute('data-testid')).filter((id) => id?.startsWith('lucid-program-'))
    ).toEqual([
      'lucid-program-mild',
      'lucid-program-ssild',
      'lucid-program-wbtb',
    ]);
    expect(screen.getByTestId('lucid-programs-ssild-lab')).not.toBeNull();
    expect(screen.getByTestId('lucid-program-mild-recommended')).not.toBeNull();
    expect(screen.getByTestId('lucid-program-mild-why').textContent).toBe(
      'Pourquoi ? Le rappel suffit pour un premier essai lucide avec MILD guidé.'
    );
    expect(screen.queryByTestId('lucid-program-ssild-why')).toBeNull();
    expect(screen.getByTestId('lucid-program-mild').getAttribute('aria-label')).toContain('Point de départ suggéré');
    expect(screen.getByTestId('lucid-program-mild').getAttribute('aria-label')).toContain('Pourquoi ?');
    expect(screen.getByTestId('lucid-program-mild').getAttribute('aria-label')).toContain(
      'Le rappel suffit pour un premier essai lucide avec MILD guidé.'
    );
  });

  it('does not suggest a starting point for weak recall, recovery, repeated wakeups or a recall goal', () => {
    mockState.progress = [];

    mockState.onboarding.experience = 'beginner';
    mockState.experiments = noRecall();
    const { unmount: unmountWeak } = render(<LucidProgramsScreen />);
    expect(screen.queryByText('Point de départ suggéré')).toBeNull();
    expect(screen.queryByTestId('lucid-program-mild-why')).toBeNull();
    unmountWeak();
    cleanup();

    mockState.onboarding.experience = 'experienced';
    mockState.experiments = [
      { id: 'ok', occurredAt: 1, updatedAt: 1, recallText: 'scene', recallLevel: 3, sleepQuality: 4 },
      { id: 'low', occurredAt: 3, updatedAt: 3, recallText: 'still a scene', recallLevel: 2, sleepQuality: 1 },
    ];
    const { unmount: unmountRecovery } = render(<LucidProgramsScreen />);
    expect(screen.queryByText('Point de départ suggéré')).toBeNull();
    unmountRecovery();
    cleanup();

    mockState.onboarding.experience = 'occasional';
    mockState.experiments = [
      { id: '1', occurredAt: 1, updatedAt: 1, cueOutcome: 'heard_woke', recallText: 'a', recallLevel: 3 },
      { id: '2', occurredAt: 2, updatedAt: 2, cueOutcome: 'not_heard', recallText: 'b', recallLevel: 3 },
      { id: '3', occurredAt: 3, updatedAt: 3, cueOutcome: 'heard_woke', recallText: 'c', recallLevel: 3 },
    ];
    const { unmount: unmountWake } = render(<LucidProgramsScreen />);
    expect(screen.queryByText('Point de départ suggéré')).toBeNull();
    unmountWake();
    cleanup();

    mockState.onboarding.goal = 'improve_recall';
    mockState.experiments = remembered();
    render(<LucidProgramsScreen />);
    expect(screen.queryByText('Point de départ suggéré')).toBeNull();
    expect(screen.queryByTestId('lucid-program-mild-why')).toBeNull();
  });

  it('marks WBTB unavailable without blocking navigation to the program detail', () => {
    mockState.progress = [];
    mockState.onboarding.experience = 'beginner';
    mockState.experiments = remembered();

    render(<LucidProgramsScreen />);

    const wbtb = screen.getByTestId('lucid-program-wbtb');
    expect(screen.getByTestId('lucid-program-wbtb-unavailable').textContent).toBe('Indisponible pour le moment');
    expect(wbtb.textContent?.match(/Indisponible pour le moment/g)).toHaveLength(1);
    expect(wbtb.textContent).not.toContain('prêt');
    const aria = wbtb.getAttribute('aria-label') ?? '';
    expect(aria.match(/Indisponible pour le moment/g)).toHaveLength(1);
    expect(aria).not.toContain('prêt');
    expect(aria).toContain('Interrompt le sommeil');
    expect(aria.match(/Interrompt le sommeil/g)).toHaveLength(1);
    expect(wbtb.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(wbtb);
    expect(mockPush).toHaveBeenCalledWith('/lucid/program/wbtb');
  });

  it('keeps a started WBTB status when it is currently unavailable', () => {
    mockState.progress = [{
      technique: 'wbtb',
      status: 'paused',
      currentDay: 2,
      completedExerciseIds: ['wbtb-01'],
    }];
    mockState.onboarding.experience = 'beginner';
    mockState.experiments = remembered();

    render(<LucidProgramsScreen />);

    const wbtb = screen.getByTestId('lucid-program-wbtb');
    expect(screen.getByTestId('lucid-program-wbtb-unavailable').textContent).toBe('Indisponible pour le moment');
    expect(wbtb.getAttribute('aria-label')).toContain('en pause');
    expect(wbtb.getAttribute('aria-label')).toContain('Indisponible pour le moment');
    expect((wbtb.getAttribute('aria-label') ?? '').match(/Indisponible pour le moment/g)).toHaveLength(1);
    expect(wbtb.getAttribute('aria-label')).not.toContain('prêt');
  });

  it('keeps WBTB available for an admissible experienced profile with consented audio', () => {
    mockState.progress = [];
    mockState.onboarding.experience = 'experienced';
    mockState.onboarding.goal = 'stabilize_lucidity';
    mockState.onboarding.audioSafetyAccepted = true;
    mockState.experiments = remembered();

    render(<LucidProgramsScreen />);

    expect(screen.queryByTestId('lucid-program-wbtb-unavailable')).toBeNull();
    expect(screen.getByTestId('lucid-program-wbtb').getAttribute('aria-label')).not.toContain('Indisponible pour le moment');
  });

  it('gives the active program visual priority over the derived recommendation', () => {
    mockState.progress = [{
      technique: 'ssild',
      status: 'active',
      currentDay: 1,
      completedExerciseIds: [],
    }];
    mockState.experiments = remembered();

    render(<LucidProgramsScreen />);

    expect(screen.queryByText('Point de départ suggéré')).toBeNull();
    expect(screen.queryByTestId('lucid-program-mild-why')).toBeNull();
    expect(screen.getByTestId('lucid-program-ssild').getAttribute('aria-label')).toContain('en cours');
  });

  it('does not present a new starting point after a program has already begun', () => {
    mockState.progress = [{
      technique: 'ssild',
      status: 'paused',
      currentDay: 2,
      completedExerciseIds: ['ssild-01'],
    }];
    mockState.experiments = remembered();

    render(<LucidProgramsScreen />);

    expect(screen.queryByText('Point de départ suggéré')).toBeNull();
    expect(screen.getByTestId('lucid-program-ssild').getAttribute('aria-label')).toContain('en pause');
  });

  it('keeps the established program testIDs as the real navigation controls', () => {
    render(<LucidProgramsScreen />);

    fireEvent.click(screen.getByTestId('lucid-program-ssild'));
    expect(mockPush).toHaveBeenCalledWith('/lucid/program/ssild');
  });

  it('opens the SSILD sensory lab from Programs without a paywall', () => {
    render(<LucidProgramsScreen />);

    const lab = screen.getByTestId('lucid-programs-ssild-lab');
    expect(lab.getAttribute('aria-label')).toContain('laboratoire sensoriel SSILD');
    expect(screen.queryByText(/premium/i)).toBeNull();
    fireEvent.click(lab);
    expect(mockPush).toHaveBeenCalledWith('/lucid/ssild-lab');
  });
});
