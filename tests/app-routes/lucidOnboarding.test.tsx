/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockCompleteOnboarding = jest.fn();
const mockReplace = jest.fn();

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
    analyticsConsent: null as boolean | null,
    accessibility: {
      reduceMotion: false,
      largerText: false,
      screenReaderOptimized: false,
    },
    completedAt: null,
    updatedAt: 1,
  },
  preferences: {
    cloudSyncEnabled: false,
    noctaliaLinkEnabled: false,
  },
};

jest.mock('react-native', () => {
  const React = require('react');
  const native = jest.requireActual('../react-native-stub');
  return {
    ...native,
    useWindowDimensions: () => ({ fontScale: 1, height: 850, scale: 2, width: 393 }),
    Pressable: ({
      accessibilityHint,
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      accessibilityValue,
      children,
      disabled,
      onPress,
      testID,
    }: {
      accessibilityHint?: string;
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { expanded?: boolean };
      accessibilityValue?: { text?: string };
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      disabled?: boolean;
      onPress?: () => void;
      testID?: string;
    }) =>
      React.createElement('button', {
        'aria-description': accessibilityHint,
        'aria-expanded': accessibilityState?.expanded,
        'aria-label': accessibilityLabel,
        'aria-valuetext': accessibilityValue?.text,
        'data-testid': testID,
        disabled,
        onClick: onPress,
        role: accessibilityRole,
      }, typeof children === 'function' ? children({ pressed: false }) : children),
  };
});

jest.mock('@/components/ui/DateTimePicker', () => ({
  DateTimePicker: ({
    onValueChange,
    testID,
    value,
  }: {
    onValueChange?: (_event: unknown, date: Date) => void;
    testID?: string;
    value: Date;
  }) => (
    <input
      aria-label="System time picker"
      data-testid={testID}
      onChange={(event) => {
        const [hours, minutes] = event.target.value.split(':').map(Number);
        const date = new Date(value);
        date.setHours(hours, minutes, 0, 0);
        onValueChange?.({}, date);
      }}
      type="time"
      value={`${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`}
    />
  ),
}));

jest.mock('expo-router', () => ({
  router: { replace: mockReplace },
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/components/lucid/LucidOnboardingBackdrop', () => ({
  LucidOnboardingBackdrop: ({ step }: { step: number; reduceMotion?: boolean }) => (
    <div data-testid={`lucid-onboarding-background-${step + 1}`} />
  ),
  LucidOnboardingStage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/lucid/LucidOnboardingChoices', () => ({
  LucidMomentPath: () => <div aria-hidden="true" />,
  LucidSegmentedProgress: ({ label }: { label: string }) => (
    <div aria-label={label} role="progressbar" />
  ),
  LucidGoalSelector: ({
    choices,
    onSelect,
    selected,
    title,
  }: {
    choices: readonly { id: string; title: string }[];
    onSelect: (id: string) => void;
    selected: string | null;
    title: string;
  }) => (
    <section>
      <h1>{title}</h1>
      {choices.map((choice) => (
        <button
          aria-checked={selected === choice.id}
          data-testid={`lucid-goal-${choice.id}`}
          key={choice.id}
          onClick={() => onSelect(choice.id)}
          role="radio"
        >
          {choice.title}
        </button>
      ))}
    </section>
  ),
  LucidExperienceSelector: ({
    choices,
    onSelect,
    question,
    selected,
  }: {
    choices: readonly { id: string; title: string }[];
    onSelect: (id: string) => void;
    question: string;
    selected: string | null;
  }) => (
    <section>
      <h1>{question}</h1>
      {choices.map((choice) => (
        <button
          aria-checked={selected === choice.id}
          data-testid={`lucid-experience-${choice.id}`}
          key={choice.id}
          onClick={() => onSelect(choice.id)}
          role="radio"
        >
          {choice.title}
        </button>
      ))}
    </section>
  ),
  LucidRhythmSelector: ({
    daysLabel,
    onSelect,
    selected,
    title,
  }: {
    daysLabel: (value: number) => string;
    onSelect: (value: number) => void;
    selected: number;
    title: string;
  }) => (
    <section>
      <h1>{title}</h1>
      {[2, 3, 5, 7].map((value) => (
        <button
          aria-checked={selected === value}
          data-testid={`lucid-weekly-target-${value}`}
          key={value}
          onClick={() => onSelect(value)}
          role="radio"
        >
          {daysLabel(value)}
        </button>
      ))}
    </section>
  ),
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  // Primitives ajoutées par C4 : le double doit suivre le composant, sinon
  // l'écran rend `undefined` et la suite tombe sur « Element type is invalid ».
  LucidIconTile: () => null,
  LucidIconAction: ({
    label,
    onPress,
  }: {
    label: string;
    onPress: () => void;
  }) => <button aria-label={label} onClick={onPress} />,
  LucidOverline: ({ text }: { text: string }) => <span>{text}</span>,
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
    background,
    eyebrow,
    footer,
    status,
    scroll,
    subtitle,
    testID,
    title,
  }: {
    children: React.ReactNode;
    background?: React.ReactNode;
    eyebrow?: string;
    // `footer` est épinglé hors du ScrollView dans le vrai composant : le double
    // doit le rendre, sinon la barre d'action disparaît des tests.
    footer?: React.ReactNode;
    status?: React.ReactNode;
    scroll?: boolean;
    subtitle?: string;
    testID?: string;
    title?: string;
  }) => (
    <main data-scroll={scroll ? 'true' : 'false'} data-testid={testID}>
      {background}
      {status}
      <span>{eyebrow}</span>
      {title ? <h1>{title}</h1> : null}
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
  // Les échelles sont des constantes pures : aucune raison de les simuler, et
  // les simuler faisait planter les StyleSheet.create qui les lisent au chargement.
  ...jest.requireActual('@/constants/lucidTheme'),
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
  ThemeAmbienceScope: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTheme: () => ({ ambience: 'light', colors: {}, mode: 'light' }),
}));

jest.mock('@/context/LucidTrainerContext', () => {
  const { getLucidContent } = jest.requireActual('@/lib/lucid/content');
  return {
    useLucidTrainer: () => ({
      state: mockState,
      content: getLucidContent('en'),
      completeOnboarding: mockCompleteOnboarding,
    }),
  };
});

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
  fireEvent.click(screen.getByTestId('lucid-goal-more_frequent_lucidity'));
  continueOnboarding();
  fireEvent.click(screen.getByTestId('lucid-experience-experienced'));
  continueOnboarding();
  fireEvent.click(screen.getByTestId('lucid-weekly-target-5'));
  continueOnboarding();
}

function setSleepTime(field: 'bedtime' | 'wake-time', value: string) {
  fireEvent.click(screen.getByTestId(`lucid-sleep-${field}`));
  fireEvent.change(screen.getByTestId(`lucid-sleep-${field}-picker`), {
    target: { value },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
}

function setSleepWindow(bedtime: string, wakeTime: string) {
  setSleepTime('bedtime', bedtime);
  setSleepTime('wake-time', wakeTime);
}

describe('Lucid Trainer onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.onboarding.status = 'not_started';
    mockState.onboarding.analyticsConsent = null;
    mockState.preferences.cloudSyncEnabled = false;
    mockState.preferences.noctaliaLinkEnabled = false;
    mockState.onboarding.sleepSchedule.bedtime = '22:30';
    mockState.onboarding.sleepSchedule.wakeTime = '07:00';
    mockCompleteOnboarding.mockImplementation(async () => {
      mockState.onboarding.status = 'completed';
    });
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

  it('completes the five-step setup without requesting optional permissions or consent', async () => {
    render(<LucidOnboardingScreen />);

    expect(screen.getByTestId('lucid-onboarding').getAttribute('data-scroll')).toBe('false');
    expect(screen.getByText('Step 1 / 5')).toBeTruthy();
    expect(screen.getByTestId('lucid-onboarding-background-1')).toBeTruthy();
    expect(screen.getByText('Your practice in three moments')).toBeTruthy();
    expect(screen.getByText('Notice by day. Set an intention. Write on waking.')).toBeTruthy();
    expect(screen.queryByText(/Pause briefly and notice what feels unusual/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Enable notifications' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Share minimal product analytics' })).toBeNull();

    reachSleepStep();
    expect(screen.getByTestId('lucid-onboarding-background-5')).toBeTruthy();
    const bedtimeControl = screen.getByRole('button', { name: 'Bedtime' });
    expect(bedtimeControl.getAttribute('aria-valuetext')).toBe('22:30');
    expect(bedtimeControl.getAttribute('aria-description')).toBe('Opens the system time picker.');
    expect(bedtimeControl.getAttribute('aria-expanded')).toBe('false');
    setSleepWindow('23:15', '07:45');

    expect(screen.getByText('Your journey')).toBeTruthy();
    expect(screen.getByText('More lucid dreams · Regular · 5 days / week')).toBeTruthy();
    expect(screen.getByText('Your sleep always comes first.')).toBeTruthy();
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
      notificationsPermission: 'unknown',
      notificationsExplained: false,
      audioSafetyAccepted: false,
      analyticsConsent: false,
      accessibility: {
        reduceMotion: false,
        largerText: false,
        screenReaderOptimized: false,
      },
      cloudSyncEnabled: false,
      noctaliaLinkEnabled: false,
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('preserves previously chosen privacy settings without presenting them again', async () => {
    mockState.onboarding.analyticsConsent = true;
    mockState.preferences.cloudSyncEnabled = true;
    mockState.preferences.noctaliaLinkEnabled = true;
    render(<LucidOnboardingScreen />);
    reachSleepStep();
    continueOnboarding();

    await waitFor(() => expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1));
    expect(mockCompleteOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationsPermission: 'unknown',
        notificationsExplained: false,
        analyticsConsent: true,
        audioSafetyAccepted: false,
        accessibility: expect.objectContaining({ reduceMotion: false }),
        cloudSyncEnabled: true,
        noctaliaLinkEnabled: true,
      })
    );
    expect(mockReplace).not.toHaveBeenCalled();

  });

  it('does not imperatively redirect a restored completed onboarding route', () => {
    mockState.onboarding.status = 'completed';

    render(<LucidOnboardingScreen />);

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockCompleteOnboarding).not.toHaveBeenCalled();
  });

  it('blocks an invalid sleep time and completes once the value is corrected', async () => {
    mockState.onboarding.sleepSchedule.bedtime = '25:99';
    render(<LucidOnboardingScreen />);
    reachSleepStep();

    const continueButton = screen.getByTestId(
      'lucid-onboarding-continue'
    ) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);
    fireEvent.click(continueButton);
    expect(screen.getByText('Your sleep window')).toBeTruthy();
    expect(mockCompleteOnboarding).not.toHaveBeenCalled();

    setSleepTime('bedtime', '23:30');
    expect(continueButton.disabled).toBe(false);
    fireEvent.click(continueButton);

    await waitFor(() => expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1));
  });
});
