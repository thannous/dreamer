/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockAlert = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockAddExperiment = jest.fn().mockResolvedValue(undefined);
const mockAddRealityCheck = jest.fn().mockResolvedValue(undefined);
const mockSaveWeeklyReview = jest.fn().mockResolvedValue(undefined);
const mockStartProgram = jest.fn().mockResolvedValue(undefined);
const mockPauseProgram = jest.fn().mockResolvedValue(undefined);
let mockRouteParams: Record<string, string> = { id: 'mild', program: 'mild', session: '1' };

const state = {
  onboarding: {
    weeklyTarget: 3,
    notificationsPermission: 'unknown' as const,
    analyticsConsent: false,
  },
  experiments: [],
  progress: [] as {
    technique: string;
    currentDay: number;
    completedExerciseIds: string[];
  }[],
  preferences: {
    noctaliaLinkEnabled: false,
    timeZone: 'UTC',
  },
};

jest.mock('react-native', () => ({
  ...jest.requireActual('../react-native-stub'),
  Alert: { alert: mockAlert },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('expo-image', () => ({
  Image: ({ testID }: { testID?: string }) => <img alt="" data-testid={testID} />,
}));

jest.mock('expo-router', () => ({
  router: {
    back: mockBack,
    canGoBack: mockCanGoBack,
    push: mockPush,
    replace: mockReplace,
  },
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = require('react');
    React.useEffect(callback, [callback]);
  },
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/constants/lucidTheme', () => ({
  // Les échelles sont des constantes pures : aucune raison de les simuler, et
  // les simuler faisait planter les StyleSheet.create qui les lisent au chargement.
  ...jest.requireActual('@/constants/lucidTheme'),
  getLucidPalette: () => ({
    accent: '#7654d4',
    accentSoft: '#eee8ff',
    amber: '#9a6200',
    amberSoft: '#fff2ce',
    backgroundDeep: '#fff',
    border: '#ccc',
    cyan: '#087f8c',
    cyanSoft: '#e4f7f7',
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

jest.mock('@/context/LucidTrainerContext', () => {
  const { getLucidContent } = jest.requireActual('@/lib/lucid/content');
  return {
    useLucidTrainer: () => ({
      state,
      content: getLucidContent('en'),
      addExperiment: mockAddExperiment,
      addRealityCheck: mockAddRealityCheck,
      saveWeeklyReview: mockSaveWeeklyReview,
      startProgram: mockStartProgram,
      pauseProgram: mockPauseProgram,
      completeProgramSession: jest.fn(),
      resetLocalData: jest.fn(),
    }),
  };
});

jest.mock('@/hooks/useLucidNow', () => ({
  useLucidNow: () => Date.UTC(2026, 7, 13, 8),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock('@/lib/analytics', () => ({
  trackProductEvent: jest.fn(),
}));

jest.mock('@/lib/lucid/deepLinks', () => ({
  buildNoctaliaHandoffLinks: jest.fn(),
}));

jest.mock('@/services/accountDeletionService', () => ({
  requestAccountDeletion: jest.fn(),
  finalizeAccountDeletion: jest.fn(),
}));

jest.mock('@/services/lucidTrainerCloudData', () => ({
  deleteLucidTrainerCloudData: jest.fn(),
}));

jest.mock('@/services/lucidTrainerExport', () => ({
  shareLucidTrainerExport: jest.fn(),
}));

jest.mock('@/services/lucidTrainerNotifications', () => ({
  reconcileLucidTrainerReminders: jest.fn(),
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  // Primitives ajoutées par C4 : le double doit suivre le composant, sinon
  // l'écran rend `undefined` et la suite tombe sur « Element type is invalid ».
  LucidIconTile: () => null,
  LucidOverline: ({ text }: { text: string }) => <span>{text}</span>,
  LucidScreen: ({
    children,
    footer,
    subtitle,
    testID,
    trailing,
  }: {
    children: React.ReactNode;
    footer?: React.ReactNode;
    subtitle?: string;
    testID?: string;
    trailing?: React.ReactNode;
  }) => (
    <main data-testid={testID}>
      {trailing}
      {subtitle ? <p>{subtitle}</p> : null}
      {children}
      {footer}
    </main>
  ),
  LucidIconAction: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button aria-label={label} onClick={onPress} />
  ),
  LucidButton: ({
    disabled,
    label,
    onPress,
    testID,
  }: {
    disabled?: boolean;
    label: string;
    onPress: () => void;
    testID?: string;
  }) => (
    <button
      aria-label={label}
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
    >
      {label}
    </button>
  ),
  LucidCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  LucidChoiceCard: ({
    title,
    onPress,
  }: {
    title: string;
    onPress: () => void;
  }) => <button onClick={onPress}>{title}</button>,
  LucidMetric: ({ label, value }: { label: string; value: string }) => (
    <span>{`${label}: ${value}`}</span>
  ),
  LucidPill: ({ label }: { label: string }) => <span>{label}</span>,
  LucidProgressBar: () => null,
  LucidSectionHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
}));

const { default: LucidMorningScreen } = require('@/app/lucid/morning');
const { default: LucidRealityCheckScreen } = require('@/app/lucid/reality-check');
const { default: LucidWeeklyScreen } = require('@/app/lucid/weekly');
const { default: LucidProgramDetailScreen } = require('@/app/lucid/program/[id]');
const { default: LucidDataScreen } = require('@/app/lucid/data');
const { default: LucidPermissionsScreen } = require('@/app/lucid/permissions');
const { default: LucidSessionScreen } = require('@/app/lucid/session/[program]/[session]');

const coldRoutes = [
  {
    name: 'morning review',
    screen: <LucidMorningScreen />,
    closeLabel: 'Cancel',
    fallback: '/lucid',
  },
  {
    name: 'reality check',
    screen: <LucidRealityCheckScreen />,
    closeLabel: 'Cancel',
    fallback: '/lucid',
  },
  {
    name: 'weekly review',
    screen: <LucidWeeklyScreen />,
    closeLabel: 'Back',
    fallback: '/lucid',
  },
  {
    name: 'program detail',
    screen: <LucidProgramDetailScreen />,
    closeLabel: 'Back',
    fallback: '/lucid/(tabs)/programs',
  },
  {
    name: 'data management',
    screen: <LucidDataScreen />,
    closeLabel: 'Back',
    fallback: '/lucid/(tabs)/settings',
  },
  {
    name: 'permissions',
    screen: <LucidPermissionsScreen />,
    closeLabel: 'Back',
    fallback: '/lucid/(tabs)/settings',
  },
  {
    name: 'session',
    screen: <LucidSessionScreen />,
    closeLabel: 'Back',
    fallback: '/lucid/program/mild',
  },
] as const;

describe('Lucid cold-route navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack.mockReturnValue(false);
    mockRouteParams = { id: 'mild', program: 'mild', session: '1' };
    state.progress = [];
  });

  afterEach(cleanup);

  it.each(coldRoutes)(
    'returns from the $name to a stable Lucid tab when history is empty',
    ({ screen: routeScreen, closeLabel, fallback }) => {
      render(routeScreen);

      fireEvent.click(screen.getByRole('button', { name: closeLabel }));

      expect(mockReplace).toHaveBeenCalledWith(fallback);
      expect(mockBack).not.toHaveBeenCalled();
    }
  );

  it.each(coldRoutes)(
    'preserves native back behavior for the $name when history exists',
    ({ screen: routeScreen, closeLabel }) => {
      mockCanGoBack.mockReturnValue(true);
      render(routeScreen);

      fireEvent.click(screen.getByRole('button', { name: closeLabel }));

      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    }
  );

  it('uses the same cold-launch fallback after saving a morning review', async () => {
    render(<LucidMorningScreen />);

    // Nothing is pre-answered. The short flow must still write exactly the
    // answers the person reported before its final recap is saveable.
    fireEvent.click(screen.getByRole('button', { name: 'MILD' }));
    fireEvent.click(screen.getByTestId('lucid-morning-next'));
    fireEvent.click(screen.getByRole('button', { name: '10 minutes' }));
    fireEvent.click(screen.getByTestId('lucid-morning-next'));
    fireEvent.click(screen.getByRole('button', { name: 'No lucidity' }));
    fireEvent.click(screen.getByTestId('lucid-morning-next'));
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByTestId('lucid-morning-next'));
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByTestId('lucid-morning-next'));
    fireEvent.click(screen.getByTestId('lucid-morning-next'));

    fireEvent.click(screen.getByTestId('lucid-morning-save'));
    await waitFor(() => expect(mockAlert).toHaveBeenCalledTimes(1));

    const actions = mockAlert.mock.calls[0][2] as { onPress?: () => void }[];
    actions[0].onPress?.();

    expect(mockReplace).toHaveBeenCalledWith('/lucid');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('keeps the weekly note optional until the final recap, then persists it once', async () => {
    render(<LucidWeeklyScreen />);

    fireEvent.click(screen.getByTestId('lucid-weekly-next'));
    fireEvent.change(screen.getByTestId('lucid-weekly-notes'), {
      target: { value: 'A calmer bedtime helped.' },
    });
    fireEvent.click(screen.getByTestId('lucid-weekly-review'));

    expect(mockSaveWeeklyReview).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('lucid-weekly-save'));
    await waitFor(() => expect(mockSaveWeeklyReview).toHaveBeenCalledTimes(1));

    expect(mockSaveWeeklyReview).toHaveBeenCalledWith(expect.objectContaining({
      notes: 'A calmer bedtime helped.',
    }));
  });

  it('blocks a future sequential session opened by URL and offers an explicit return', () => {
    state.progress = [
      {
        technique: 'mild',
        currentDay: 1,
        completedExerciseIds: [],
      },
    ];
    mockRouteParams = { id: 'mild', program: 'mild', session: '3' };
    render(<LucidSessionScreen />);

    expect(
      screen.getByText('This session opens after the previous one. The calendar is only a suggestion.')
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to program' }));
    expect(mockReplace).toHaveBeenCalledWith('/lucid/program/mild');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('still reopens a completed session from a direct URL', () => {
    state.progress = [
      {
        technique: 'mild',
        currentDay: 3,
        completedExerciseIds: ['mild-01', 'mild-02'],
      },
    ];
    mockRouteParams = { id: 'mild', program: 'mild', session: '1' };
    render(<LucidSessionScreen />);

    expect(screen.getByTestId('lucid-session-complete')).toBeTruthy();
    expect(screen.queryByTestId('lucid-session-unavailable-back')).toBeNull();
  });
});
