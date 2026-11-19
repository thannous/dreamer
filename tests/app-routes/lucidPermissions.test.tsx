/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockUpdatePreferences = jest.fn().mockResolvedValue(undefined);
const mockReload = jest.fn().mockResolvedValue(undefined);
const mockReconcile = jest.fn().mockResolvedValue({ permission: 'granted', scheduled: 3 });

let mockPermission: 'unknown' | 'granted' | 'denied' = 'unknown';
let mockNotificationsEnabled = false;

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
}));

jest.mock('@expo/vector-icons/Ionicons', () => ({
  __esModule: true,
  default: () => <span aria-hidden="true" />,
}));

jest.mock('react-native', () => jest.requireActual('../react-native-stub'));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'dark' }),
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  LucidButton: ({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) => (
    <button data-testid={testID} onClick={onPress}>{label}</button>
  ),
  LucidCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  LucidDisclosure: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div><span>{title}</span>{children}</div>
  ),
  LucidIconAction: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button aria-label={label} onClick={onPress} />
  ),
  LucidIconTile: () => null,
  LucidPill: ({ label }: { label: string }) => <span data-testid="lucid-permissions-pill">{label}</span>,
  LucidScreen: ({ children, title }: { children: React.ReactNode; title?: string }) => (
    <main><h1>{title}</h1>{children}</main>
  ),
}));

jest.mock('@/services/lucidTrainerNotifications', () => ({
  reconcileLucidTrainerReminders: (...args: unknown[]) => mockReconcile(...args),
}));

jest.mock('@/context/LucidTrainerContext', () => {
  const { getLucidContent } = jest.requireActual('@/lib/lucid/content');
  return {
    useLucidTrainer: () => ({
      state: {
        schemaVersion: 1,
        createdAt: 1,
        updatedAt: 1,
        onboarding: {
          status: 'completed',
          goal: 'first_lucid_dream',
          experience: 'beginner',
          weeklyTarget: 3,
          sleepSchedule: { bedtime: '22:30', wakeTime: '07:00', timeZone: 'Europe/Paris' },
          notificationsPermission: mockPermission,
          notificationsExplained: true,
          audioSafetyAccepted: false,
          analyticsConsent: false,
          accessibility: { reduceMotion: false, largerText: false, screenReaderOptimized: false },
          completedAt: 1,
          updatedAt: 1,
        },
        preferences: {
          locale: 'en',
          theme: 'system',
          cloudSyncEnabled: false,
          noctaliaLinkEnabled: false,
          notificationsEnabled: mockNotificationsEnabled,
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
      },
      content: getLucidContent('en'),
      updatePreferences: mockUpdatePreferences,
      reload: mockReload,
    }),
  };
});

const { default: LucidPermissionsScreen } = require('@/routes/lucid/lucid/permissions');

describe('Lucid permissions screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermission = 'unknown';
    mockNotificationsEnabled = false;
    mockReconcile.mockResolvedValue({ permission: 'granted', scheduled: 3 });
  });

  afterEach(cleanup);

  it('allows turning reminders back on when OS permission is already granted but notificationsEnabled is false', async () => {
    mockPermission = 'granted';
    mockNotificationsEnabled = false;

    render(<LucidPermissionsScreen />);

    expect(screen.getByTestId('lucid-permissions-pill').textContent).toBe('Off');
    const enableButton = screen.getByTestId('lucid-permissions-enable');
    expect(enableButton.textContent).toBe('Turn on training reminders');

    fireEvent.click(enableButton);

    await waitFor(() => {
      expect(mockReconcile).toHaveBeenCalledTimes(1);
      expect(mockUpdatePreferences).toHaveBeenCalledWith({ notificationsEnabled: true });
      expect(mockReload).toHaveBeenCalledTimes(1);
    });
  });

  it('shows Granted and hides the enable button once permission is granted and reminders are enabled', () => {
    mockPermission = 'granted';
    mockNotificationsEnabled = true;

    render(<LucidPermissionsScreen />);

    expect(screen.getByTestId('lucid-permissions-pill').textContent).toBe('Granted');
    expect(screen.queryByTestId('lucid-permissions-enable')).toBeNull();
  });
});
