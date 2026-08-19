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
  progress: [],
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

jest.mock('expo-router', () => ({
  router: {
    back: mockBack,
    canGoBack: mockCanGoBack,
    push: mockPush,
    replace: mockReplace,
  },
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/constants/lucidTheme', () => ({
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
  LucidScreen: ({
    children,
    testID,
    trailing,
  }: {
    children: React.ReactNode;
    testID?: string;
    trailing?: React.ReactNode;
  }) => (
    <main data-testid={testID}>
      {trailing}
      {children}
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

    // Nothing is pre-answered, so the review has to be filled in before it saves.
    fireEvent.click(screen.getByRole('button', { name: 'MILD' }));
    fireEvent.click(screen.getByRole('button', { name: '10 minutes' }));
    fireEvent.click(screen.getByRole('button', { name: 'No lucidity' }));
    fireEvent.click(screen.getAllByRole('button', { name: '3' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: '3' })[1]);

    fireEvent.click(screen.getByTestId('lucid-morning-save'));
    await waitFor(() => expect(mockAlert).toHaveBeenCalledTimes(1));

    const actions = mockAlert.mock.calls[0][2] as { onPress?: () => void }[];
    actions[0].onPress?.();

    expect(mockReplace).toHaveBeenCalledWith('/lucid');
    expect(mockBack).not.toHaveBeenCalled();
  });
});
