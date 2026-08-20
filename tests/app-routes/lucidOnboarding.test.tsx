/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockCompleteOnboarding = jest.fn();
const mockUpdatePreferences = jest.fn();
const mockReplace = jest.fn();
const mockReconcileReminders = jest.fn();
const mockAlert = jest.fn();
let mockPermission: 'granted' | 'denied' = 'granted';

const mockState = {
  onboarding: {
    status: 'not_started',
    goal: null,
    experience: null,
    weeklyTarget: 3,
    sleepSchedule: {
      bedtime: '22:30',
      wakeTime: '07:00',
      timeZone: 'Europe/Paris',
    },
    notificationsPermission: 'unknown',
    notificationsExplained: false,
    audioSafetyAccepted: false,
    analyticsConsent: null,
    accessibility: {
      reduceMotion: false,
      largerText: false,
      screenReaderOptimized: false,
    },
    completedAt: null,
    updatedAt: 1,
  },
};

jest.mock('react-native', () => {
  const React = require('react');
  const native = jest.requireActual('../react-native-stub');
  return {
    ...native,
    Alert: {
      alert: (...args: unknown[]) => mockAlert(...args),
    },
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (value: string) => void;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        value,
      }),
  };
});

jest.mock('expo-router', () => ({
  router: { replace: mockReplace },
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  LucidButton: ({
    disabled,
    label,
    loading,
    onPress,
    testID,
  }: {
    disabled?: boolean;
    label: string;
    loading?: boolean;
    onPress: () => void;
    testID?: string;
  }) => (
    <button
      aria-label={label}
      data-testid={testID}
      disabled={disabled || loading}
      onClick={onPress}
    >
      {label}
    </button>
  ),
  LucidCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  LucidChoiceCard: ({
    onPress,
    selected,
    testID,
    title,
  }: {
    onPress: () => void;
    selected: boolean;
    testID?: string;
    title: string;
  }) => (
    <button aria-pressed={selected} data-testid={testID} onClick={onPress}>
      {title}
    </button>
  ),
  LucidProgressBar: ({ accessibilityLabel }: { accessibilityLabel?: string }) => (
    <div aria-label={accessibilityLabel} role="progressbar" />
  ),
  LucidScreen: ({
    children,
    eyebrow,
    footer,
    status,
    subtitle,
    testID,
    title,
  }: {
    children: React.ReactNode;
    eyebrow?: string;
    // `footer` est épinglé hors du ScrollView dans le vrai composant : le double
    // doit le rendre, sinon la barre d'action disparaît des tests.
    footer?: React.ReactNode;
    status?: React.ReactNode;
    subtitle?: string;
    testID?: string;
    title?: string;
  }) => (
    <main data-testid={testID}>
      {status}
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {children}
      {footer}
    </main>
  ),
  LucidToggleRow: ({
    onValueChange,
    title,
    value,
  }: {
    onValueChange: (value: boolean) => void;
    title: string;
    value: boolean;
  }) => (
    <button aria-label={title} aria-pressed={value} onClick={() => onValueChange(!value)}>
      {title}
    </button>
  ),
}));

jest.mock('@/constants/lucidTheme', () => ({
  getLucidPalette: () => ({
    accent: '#7654d4',
    accentSoft: '#eee8ff',
    border: '#ccc',
    cyan: '#087f8c',
    danger: '#b42318',
    surfaceRaised: '#f4f4f4',
    success: '#067647',
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
      state: mockState,
      content: getLucidContent('en'),
      completeOnboarding: mockCompleteOnboarding,
      updatePreferences: mockUpdatePreferences,
    }),
  };
});

jest.mock('@/services/lucidTrainerNotifications', () => ({
  reconcileLucidTrainerReminders: (...args: unknown[]) => mockReconcileReminders(...args),
}));

const { getLucidContent } = require('@/lib/lucid/content');
const { default: LucidOnboardingScreen } = require('@/app/lucid/onboarding');
const englishContent = getLucidContent('en');
const selectedGoal = englishContent.onboarding.goals.find(
  (choice: { title: string }) => choice.title === 'Explore lucidity more often'
);
const selectedExperience = englishContent.onboarding.experienceLevels.find(
  (choice: { title: string }) => choice.title === 'Regular'
);

function continueOnboarding() {
  fireEvent.click(screen.getByTestId('lucid-onboarding-continue'));
}

function reachSleepStep() {
  continueOnboarding();
  fireEvent.click(screen.getByRole('button', { name: 'Explore lucidity more often' }));
  continueOnboarding();
  fireEvent.click(screen.getByRole('button', { name: 'Regular' }));
  continueOnboarding();
  fireEvent.click(screen.getByTestId('lucid-weekly-target-5'));
  continueOnboarding();
}

function setSleepWindow(bedtime: string, wakeTime: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Bedtime' }), {
    target: { value: bedtime },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Wake time' }), {
    target: { value: wakeTime },
  });
}

describe('Lucid Trainer onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermission = 'granted';
    mockCompleteOnboarding.mockResolvedValue(undefined);
    mockUpdatePreferences.mockResolvedValue(undefined);
    mockReconcileReminders.mockImplementation(async () => ({
      permission: mockPermission,
      canAskAgain: mockPermission !== 'denied',
      scheduledIds: [],
      cancelledIds: [],
      unchangedOccurrenceIds: [],
      timeContextChanged: false,
    }));
    jest
      .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
      .mockReturnValue({
        locale: 'en-US',
        calendar: 'gregory',
        numberingSystem: 'latn',
        timeZone: 'Europe/Paris',
      });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('completes every step with explicit permissions, accessibility and consent choices', async () => {
    render(<LucidOnboardingScreen />);
    reachSleepStep();
    setSleepWindow('23:15', '07:45');
    continueOnboarding();

    fireEvent.click(screen.getByRole('button', { name: 'Enable notifications' }));
    await waitFor(() => expect(mockReconcileReminders).toHaveBeenCalledTimes(1));
    expect(mockReconcileReminders).toHaveBeenCalledWith(
      { version: 1, timeZone: 'Europe/Paris', reminders: [] },
      { requestPermissionIfNeeded: true }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reduce motion' }));
    continueOnboarding();

    fireEvent.click(
      screen.getByRole('button', { name: 'Share minimal product analytics' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Sync with my Noctalia account' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Allow a minimal handoff to Noctalia' })
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'I will keep sound low and stop if it disturbs sleep',
      })
    );
    continueOnboarding();

    await waitFor(() => expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1));
    expect(selectedGoal).toBeTruthy();
    expect(selectedExperience).toBeTruthy();
    expect(mockCompleteOnboarding).toHaveBeenCalledWith({
      goal: selectedGoal.id,
      experience: selectedExperience.id,
      weeklyTarget: 5,
      sleepSchedule: {
        bedtime: '23:15',
        wakeTime: '07:45',
        timeZone: 'Europe/Paris',
      },
      notificationsPermission: 'granted',
      notificationsExplained: true,
      audioSafetyAccepted: true,
      analyticsConsent: true,
      accessibility: {
        reduceMotion: true,
        largerText: false,
        screenReaderOptimized: false,
      },
    });
    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      cloudSyncEnabled: true,
      noctaliaLinkEnabled: true,
    });
    expect(mockReplace).toHaveBeenCalledWith('/lucid');
    expect(mockCompleteOnboarding.mock.invocationCallOrder[0]).toBeLessThan(
      mockUpdatePreferences.mock.invocationCallOrder[0]
    );
    expect(mockUpdatePreferences.mock.invocationCallOrder[0]).toBeLessThan(
      mockReplace.mock.invocationCallOrder[0]
    );
  });

  it('continues after notification refusal while every optional consent stays off', async () => {
    mockPermission = 'denied';
    render(<LucidOnboardingScreen />);
    reachSleepStep();
    continueOnboarding();

    fireEvent.click(screen.getByRole('button', { name: 'Enable notifications' }));
    await waitFor(() => expect(mockReconcileReminders).toHaveBeenCalledTimes(1));
    continueOnboarding();
    continueOnboarding();

    await waitFor(() => expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1));
    expect(mockCompleteOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationsPermission: 'denied',
        notificationsExplained: true,
        analyticsConsent: false,
        audioSafetyAccepted: false,
        accessibility: expect.objectContaining({ reduceMotion: false }),
      })
    );
    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      cloudSyncEnabled: false,
      noctaliaLinkEnabled: false,
    });
    expect(mockReplace).toHaveBeenCalledWith('/lucid');
  });

  it('blocks an invalid sleep time and resumes once the value is corrected', () => {
    render(<LucidOnboardingScreen />);
    reachSleepStep();
    setSleepWindow('25:99', '07:30');

    const continueButton = screen.getByTestId(
      'lucid-onboarding-continue'
    ) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);
    fireEvent.click(continueButton);
    expect(screen.getByRole('heading', { name: 'Your sleep window' })).toBeTruthy();
    expect(mockReconcileReminders).not.toHaveBeenCalled();

    setSleepWindow('23:30', '07:30');
    expect(continueButton.disabled).toBe(false);
    fireEvent.click(continueButton);

    expect(
      screen.getByRole('heading', { name: 'Notifications, when useful' })
    ).toBeTruthy();
    expect(mockAlert).not.toHaveBeenCalled();
  });
});
