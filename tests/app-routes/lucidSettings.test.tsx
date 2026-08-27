/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const mockSetThemePreference = jest.fn();
const mockUpdatePreferences = jest.fn();
const mockUpdateAnalyticsConsent = jest.fn();
const mockSyncNow = jest.fn();
const mockReload = jest.fn();
const mockUpdateLucidTrainerState = jest.fn();
const mockQueueMutation = jest.fn();
const mockCreateMutation = jest.fn((input) => input);
let mockUser: { id: string; email: string } | null = null;
let mockSyncStatus = 'local';
let mockLastSyncResult: {
  outcome: string;
  attempted: number;
  acknowledged: number;
  failed: number;
  conflicts: number;
  blocked: number;
  pending: number;
} | null = null;

const state = {
  schemaVersion: 1,
  createdAt: 1,
  updatedAt: 1,
  onboarding: {
    status: 'completed',
    goal: 'first_lucid_dream',
    experience: 'beginner',
    weeklyTarget: 3,
    sleepSchedule: { bedtime: '22:30', wakeTime: '07:00', timeZone: 'Europe/Paris' },
    notificationsPermission: 'granted',
    notificationsExplained: true,
    audioSafetyAccepted: true,
    analyticsConsent: false,
    accessibility: {
      reduceMotion: false,
      largerText: false,
      screenReaderOptimized: false,
    },
    completedAt: 1,
    updatedAt: 1,
  },
  preferences: {
    locale: 'en',
    theme: 'system',
    cloudSyncEnabled: false,
    noctaliaLinkEnabled: false,
    notificationsEnabled: true,
    realityCheckRemindersPerDay: 3,
    mindfulPauseReminderAnchors: ['transition'],
    audioCuesEnabled: false,
    audioVolume: 0.25,
    timeZone: 'Europe/Paris',
    updatedAt: 1,
  },
  progress: [],
  experiments: [],
  realityChecks: [],
  weeklyReviews: [],
};

jest.mock('react-native', () => jest.requireActual('../react-native-stub'));

jest.mock('expo-router', () => ({
  router: { push: mockPush },
}));

jest.mock('@/constants/lucidTheme', () => ({
  // Les échelles sont des constantes pures : aucune raison de les simuler, et
  // les simuler faisait planter les StyleSheet.create qui les lisent au chargement.
  ...jest.requireActual('@/constants/lucidTheme'),
  getLucidPalette: () => ({
    accent: '#7654d4',
    accentSoft: '#eee8ff',
    accentStrong: '#7654d4',
    amber: '#9a6200',
    background: '#fff',
    backgroundDeep: '#fff',
    border: '#ccc',
    cyan: '#087f8c',
    danger: '#b42318',
    surface: '#fff',
    surfaceMuted: '#eee',
    surfaceRaised: '#f4f4f4',
    text: '#111',
    textMuted: '#777',
    textSecondary: '#555',
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {},
    mode: 'light',
    preference: 'auto',
    setPreference: mockSetThemePreference,
  }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('@/context/LucidTrainerContext', () => {
  const { getLucidContent } = jest.requireActual('@/lib/lucid/content');
  return {
    useLucidTrainer: () => ({
      state,
      content: getLucidContent('en'),
      updatePreferences: mockUpdatePreferences,
      updateAnalyticsConsent: mockUpdateAnalyticsConsent,
      userScope: 'guest',
      syncStatus: mockSyncStatus,
      lastSyncResult: mockLastSyncResult,
      syncNow: mockSyncNow,
      reload: mockReload,
    }),
  };
});

jest.mock('@/components/lucid/LucidUI', () => ({
  // Primitives ajoutées par C4 : le double doit suivre le composant, sinon
  // l'écran rend `undefined` et la suite tombe sur « Element type is invalid ».
  LucidIconTile: () => null,
  LucidOverline: ({ text }: { text: string }) => <span>{text}</span>,
  LucidScreen: ({ children, testID }: { children: React.ReactNode; testID?: string }) => (
    <main data-testid={testID}>{children}</main>
  ),
  LucidCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  LucidPill: ({ label }: { label: string }) => <span>{label}</span>,
  LucidSectionHeader: ({ title, caption }: { title: string; caption?: string }) => (
    <header><h2>{title}</h2>{caption ? <p>{caption}</p> : null}</header>
  ),
  LucidButton: ({ label, onPress, disabled, testID }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    testID?: string;
  }) => <button data-testid={testID} disabled={disabled} onClick={onPress}>{label}</button>,
  LucidToggleRow: ({ title, value, onValueChange, disabled }: {
    title: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
  }) => <button disabled={disabled} onClick={() => onValueChange(!value)}>{title}</button>,
}));

jest.mock('@/services/lucidTrainerStorage', () => ({
  updateLucidTrainerState: (...args: unknown[]) => mockUpdateLucidTrainerState(...args),
}));

jest.mock('@/services/lucidTrainerSync', () => ({
  createLucidTrainerMutation: (input: unknown) => mockCreateMutation(input),
  queueLucidTrainerMutation: (mutation: unknown) => mockQueueMutation(mutation),
}));

const { default: LucidSettingsScreen } = require('@/app/lucid/(tabs)/settings');

describe('Lucid Trainer settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetThemePreference.mockResolvedValue(undefined);
    mockUpdatePreferences.mockResolvedValue(undefined);
    mockUpdateAnalyticsConsent.mockResolvedValue(undefined);
    mockSyncNow.mockResolvedValue(null);
    mockReload.mockResolvedValue(undefined);
    mockQueueMutation.mockResolvedValue([]);
    mockUpdateLucidTrainerState.mockImplementation(async (_scope, updater) => updater(state));
    mockUser = null;
    mockSyncStatus = 'local';
    mockLastSyncResult = null;
    state.onboarding.weeklyTarget = 3;
    state.onboarding.goal = 'first_lucid_dream';
    state.onboarding.experience = 'beginner';
    state.preferences.notificationsEnabled = true;
    state.preferences.realityCheckRemindersPerDay = 3;
    state.preferences.mindfulPauseReminderAnchors = ['transition'];
  });

  afterEach(cleanup);

  it('keeps account management inside the Lucid shell', () => {
    render(<LucidSettingsScreen />);

    fireEvent.click(screen.getByTestId('lucid-settings-account'));
    fireEvent.click(screen.getByRole('button', { name: 'Open account controls' }));

    expect(mockPush).toHaveBeenCalledWith('/lucid/account');
  });

  it('applies and persists an explicit appearance choice', async () => {
    render(<LucidSettingsScreen />);

    fireEvent.click(screen.getByTestId('lucid-theme-dark'));

    await waitFor(() => {
      expect(mockSetThemePreference).toHaveBeenCalledWith('dark');
      expect(mockUpdatePreferences).toHaveBeenCalledWith({ theme: 'dark' });
    });
  });

  it('updates reminder frequency through an accessible button', async () => {
    render(<LucidSettingsScreen />);

    fireEvent.click(screen.getByTestId('lucid-reminders-increase'));

    await waitFor(() => {
      expect(mockUpdatePreferences).toHaveBeenCalledWith({
        realityCheckRemindersPerDay: 4,
      });
    });
  });

  it('persists configurable pause anchors without changing reminder windows', async () => {
    render(<LucidSettingsScreen />);

    fireEvent.click(screen.getByTestId('lucid-reminder-anchor-emotion'));

    await waitFor(() => {
      expect(mockUpdatePreferences).toHaveBeenCalledWith({
        mindfulPauseReminderAnchors: ['transition', 'emotion'],
      });
    });
    expect(mockUpdatePreferences).not.toHaveBeenCalledWith(
      expect.objectContaining({ realityCheckRemindersPerDay: expect.anything() })
    );
  });

  it('disables notifications immediately without changing reminder count', async () => {
    render(<LucidSettingsScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Training notifications' }));

    await waitFor(() => {
      expect(mockUpdatePreferences).toHaveBeenCalledWith({ notificationsEnabled: false });
    });
    expect(mockUpdatePreferences).not.toHaveBeenCalledWith(
      expect.objectContaining({ realityCheckRemindersPerDay: expect.anything() })
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('opens permissions when enabling notifications', () => {
    state.preferences.notificationsEnabled = false;
    render(<LucidSettingsScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Training notifications' }));

    expect(mockPush).toHaveBeenCalledWith('/lucid/permissions');
    expect(mockUpdatePreferences).not.toHaveBeenCalled();
  });

  it('moves the weekly target only through the persisted 2/3/5/7 choices', async () => {
    render(<LucidSettingsScreen />);

    fireEvent.click(screen.getByTestId('lucid-weekly-increase'));

    await waitFor(() => expect(mockUpdateLucidTrainerState).toHaveBeenCalled());
    const updater = mockUpdateLucidTrainerState.mock.calls[0][1];
    expect(updater(state).onboarding.weeklyTarget).toBe(5);
  });

  it('keeps the onboarding horizon and starting point visible and editable', async () => {
    render(<LucidSettingsScreen />);

    expect(screen.queryByTestId('lucid-settings-goal-improve_recall')).toBeNull();
    fireEvent.click(screen.getByTestId('lucid-settings-journey'));

    fireEvent.click(screen.getByTestId('lucid-settings-goal-improve_recall'));
    await waitFor(() => expect(mockUpdateLucidTrainerState).toHaveBeenCalledTimes(1));
    const goalUpdater = mockUpdateLucidTrainerState.mock.calls[0][1];
    expect(goalUpdater(state).onboarding.goal).toBe('improve_recall');

    fireEvent.click(screen.getByTestId('lucid-settings-experience-experienced'));
    await waitFor(() => expect(mockUpdateLucidTrainerState).toHaveBeenCalledTimes(2));
    const experienceUpdater = mockUpdateLucidTrainerState.mock.calls[1][1];
    expect(experienceUpdater(state).onboarding.experience).toBe('experienced');
  });

  it('validates and persists the sleep window without changing the journal', async () => {
    render(<LucidSettingsScreen />);

    fireEvent.change(screen.getByTestId('lucid-bedtime-input'), {
      target: { value: '23:15' },
    });
    fireEvent.change(screen.getByTestId('lucid-wake-input'), {
      target: { value: '07:30' },
    });
    fireEvent.click(screen.getByTestId('lucid-save-schedule'));

    await waitFor(() => expect(mockUpdateLucidTrainerState).toHaveBeenCalled());
    const updater = mockUpdateLucidTrainerState.mock.calls[0][1];
    const next = updater(state);
    expect(next.onboarding.sleepSchedule).toEqual({
      bedtime: '23:15',
      wakeTime: '07:30',
      timeZone: 'Europe/Paris',
    });
    expect(next.preferences.timeZone).toBe('Europe/Paris');
  });

  it('persists the reduce-motion choice in onboarding accessibility state', async () => {
    render(<LucidSettingsScreen />);

    fireEvent.click(screen.getByTestId('lucid-settings-accessibility'));
    fireEvent.click(screen.getByRole('button', { name: 'Reduce motion' }));

    await waitFor(() => expect(mockUpdateLucidTrainerState).toHaveBeenCalled());
    const updater = mockUpdateLucidTrainerState.mock.calls[0][1];
    const next = updater(state);
    expect(next.onboarding.accessibility).toEqual({
      reduceMotion: true,
      largerText: false,
      screenReaderOptimized: false,
    });
  });

  it('shows recoverable sync details and retries without hiding local state', async () => {
    mockUser = { id: 'user-1', email: 'user@example.com' };
    mockSyncStatus = 'error';
    mockLastSyncResult = {
      outcome: 'completed',
      attempted: 4,
      acknowledged: 1,
      failed: 1,
      conflicts: 1,
      blocked: 0,
      pending: 2,
    };
    render(<LucidSettingsScreen />);

    expect(screen.getByText('Sync needs attention')).toBeTruthy();
    fireEvent.click(screen.getByTestId('lucid-settings-sync'));
    expect(screen.getByText(/1 conflicts · 1 failed · 0 blocked · 2 pending/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('lucid-sync-retry'));

    await waitFor(() => expect(mockSyncNow).toHaveBeenCalled());
  });

  it('keeps the daily controls immediate and reveals secondary controls on demand', () => {
    render(<LucidSettingsScreen />);

    expect(screen.getByTestId('lucid-theme-dynamic')).toBeTruthy();
    expect(screen.getByTestId('lucid-weekly-increase')).toBeTruthy();
    expect(screen.getByTestId('lucid-reminders-increase')).toBeTruthy();
    expect(screen.getByTestId('lucid-bedtime-input')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reduce motion' })).toBeNull();

    fireEvent.click(screen.getByTestId('lucid-settings-accessibility'));

    expect(screen.getByRole('button', { name: 'Reduce motion' })).toBeTruthy();
  });
});
