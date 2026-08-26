/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const mockPush = jest.fn();
const mockGetLucidGuidanceProfile = jest.fn();
const mockState = {
  onboarding: {
    goal: 'first_lucid_dream',
    experience: 'beginner',
  },
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
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
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
      state: {
        ...mockState,
      },
      content: getLucidContent('fr'),
    }),
  };
});

jest.mock('@/lib/lucid/personalization', () => ({
  getLucidGuidanceProfile: (input: unknown) => mockGetLucidGuidanceProfile(input),
}));

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

describe('Lucid Trainer programs', () => {
  beforeEach(() => {
    mockState.onboarding.goal = 'first_lucid_dream';
    mockState.onboarding.experience = 'beginner';
    mockState.progress = [{
      technique: 'mild',
      status: 'active',
      currentDay: 3,
      completedExerciseIds: ['mild-01', 'mild-03', 'unrelated-id'],
    }];
    mockGetLucidGuidanceProfile.mockReturnValue({
      recommendedTechnique: 'mild',
      focus: 'lucidity',
      guidance: 'guided',
      cautionWbtb: true,
    });
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
    expect(mockGetLucidGuidanceProfile).toHaveBeenCalledWith({
      goal: 'first_lucid_dream',
      experience: 'beginner',
    });
  });

  it('suggests one starting point without reordering or locking any program', () => {
    mockState.progress = [];

    render(<LucidProgramsScreen />);

    const cards = ['mild', 'ssild', 'wbtb'].map((id) => screen.getByTestId(`lucid-program-${id}`));
    expect(screen.getAllByRole('button').map((card) => card.getAttribute('data-testid'))).toEqual([
      'lucid-program-mild',
      'lucid-program-ssild',
      'lucid-program-wbtb',
    ]);
    expect(screen.getByTestId('lucid-program-mild-recommended')).not.toBeNull();
    expect(cards[0].getAttribute('aria-label')).toContain('Point de départ suggéré');
    expect(cards[2].getAttribute('aria-label')).toContain('Interrompt le sommeil');
    expect(screen.queryByText(/Interrompt le sommeil/)).toBeNull();

    fireEvent.click(cards[2]);
    expect(mockPush).toHaveBeenCalledWith('/lucid/program/wbtb');
  });

  it('gives the active program visual priority over the derived recommendation', () => {
    mockState.progress = [{
      technique: 'ssild',
      status: 'active',
      currentDay: 1,
      completedExerciseIds: [],
    }];

    render(<LucidProgramsScreen />);

    expect(screen.queryByText('Point de départ suggéré')).toBeNull();
    expect(screen.getByTestId('lucid-program-ssild').getAttribute('aria-label')).toContain('en cours');
  });

  it('does not present a new starting point after a program has already begun', () => {
    mockState.progress = [{
      technique: 'ssild',
      status: 'paused',
      currentDay: 2,
      completedExerciseIds: ['ssild-01'],
    }];

    render(<LucidProgramsScreen />);

    expect(screen.queryByText('Point de départ suggéré')).toBeNull();
    expect(screen.getByTestId('lucid-program-ssild').getAttribute('aria-label')).toContain('en pause');
  });

  it('keeps the established program testIDs as the real navigation controls', () => {
    render(<LucidProgramsScreen />);

    fireEvent.click(screen.getByTestId('lucid-program-ssild'));
    expect(mockPush).toHaveBeenCalledWith('/lucid/program/ssild');
  });
});
