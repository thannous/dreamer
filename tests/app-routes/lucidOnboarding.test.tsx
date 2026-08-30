/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockCompleteOnboarding = jest.fn();
const mockSaveOnboardingDraft = jest.fn();
const mockReplace = jest.fn();
let mockLocale: 'en' | 'fr' | 'es' | 'de' | 'it' = 'en';
let mockDimensions = { fontScale: 1, height: 850, scale: 2, width: 393 };

const mockState = {
  onboarding: {
    status: 'not_started',
    goal: null as null | 'first_lucid_dream' | 'improve_recall' | 'more_frequent_lucidity' | 'stabilize_lucidity',
    experience: null as null | 'beginner' | 'occasional' | 'experienced',
    wakeSensitivity: null as null | 'sensitive' | 'not_sensitive',
    draftStep: 0 as 0 | 1 | 2 | 3,
    sleepScheduleConfirmed: false,
    sleepScheduleDraft: { bedtime: null as string | null, wakeTime: null as string | null },
    weeklyTarget: 3,
    sleepSchedule: { bedtime: '22:30', wakeTime: '07:00', timeZone: 'Europe/Paris' },
    notificationsPermission: 'unknown',
    notificationsExplained: false,
    audioSafetyAccepted: false,
    analyticsConsent: null as boolean | null,
    accessibility: { reduceMotion: false, largerText: false, screenReaderOptimized: false },
    completedAt: null,
    updatedAt: 1,
  },
  preferences: { cloudSyncEnabled: false, noctaliaLinkEnabled: false },
  experiments: [],
};

jest.mock('react-native', () => {
  const React = require('react');
  const native = jest.requireActual('../react-native-stub');
  return {
    ...native,
    useWindowDimensions: () => mockDimensions,
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
      accessibilityState?: { expanded?: boolean; selected?: boolean; checked?: boolean };
      accessibilityValue?: { text?: string };
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      disabled?: boolean;
      onPress?: () => void;
      testID?: string;
    }) => React.createElement('button', {
      'aria-checked': accessibilityState?.checked,
      'aria-description': accessibilityHint,
      'aria-expanded': accessibilityState?.expanded,
      'aria-label': accessibilityLabel,
      'aria-pressed': accessibilityState?.selected,
      'aria-valuetext': accessibilityValue?.text,
      'data-testid': testID,
      disabled,
      onClick: onPress,
      role: accessibilityRole,
    }, typeof children === 'function' ? children({ pressed: false }) : children),
  };
});

jest.mock('@/components/ui/DateTimePicker', () => ({
  DateTimePicker: ({ onValueChange, testID, value }: {
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
  LucidOnboardingBackdrop: ({ step, reduceMotion }: { step: number; reduceMotion?: boolean }) => (
    <div data-reduce-motion={reduceMotion ? 'true' : 'false'} data-testid={`lucid-onboarding-background-${step + 1}`} />
  ),
  LucidOnboardingStage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/lucid/LucidOnboardingChoices', () => ({
  LucidSegmentedProgress: ({ label }: { label: string }) => <div aria-label={label} role="progressbar" />,
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  LucidIconAction: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button aria-label={label} onClick={onPress} />
  ),
  LucidOverline: ({ text }: { text: string }) => <span>{text}</span>,
  LucidButton: ({ disabled, label, loading, onPress, testID }: {
    disabled?: boolean;
    label: string;
    loading?: boolean;
    onPress: () => void;
    testID?: string;
  }) => (
    <button aria-label={label} data-testid={testID} disabled={disabled || loading} onClick={onPress}>
      {label}
    </button>
  ),
  LucidCard: ({ children, testID }: { children: React.ReactNode; testID?: string }) => (
    <section data-testid={testID}>{children}</section>
  ),
  LucidChoiceCard: ({ onPress, selected, testID, title }: {
    onPress: () => void;
    selected: boolean;
    testID?: string;
    title: string;
  }) => (
    <button aria-checked={selected} data-testid={testID} onClick={onPress} role="radio">
      {title}
    </button>
  ),
  LucidScreen: ({ children, background, eyebrow, footer, scroll, testID }: {
    children: React.ReactNode;
    background?: React.ReactNode;
    eyebrow?: string;
    footer?: React.ReactNode;
    scroll?: boolean;
    testID?: string;
  }) => (
    <main data-scroll={scroll ? 'true' : 'false'} data-testid={testID}>
      {background}<span>{eyebrow}</span>{children}{footer}
    </main>
  ),
}));

jest.mock('@/constants/lucidTheme', () => ({
  ...jest.requireActual('@/constants/lucidTheme'),
  getLucidPalette: () => ({
    accent: '#7654d4', accentOn: '#4d2aa5', accentSoft: '#eee8ff', accentStrong: '#6543c3',
    amber: '#8a5b00', amberSoft: '#fff0cc', border: '#ccc', danger: '#b42318', overlay: '#f8f8f8',
    surface: '#fff', text: '#111', textMuted: '#777', textSecondary: '#555',
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
      content: getLucidContent(mockLocale),
      completeOnboarding: mockCompleteOnboarding,
      saveOnboardingDraft: mockSaveOnboardingDraft,
    }),
  };
});

const { default: LucidOnboardingScreen } = require('@/app/lucid/onboarding');

function continueOnboarding() {
  fireEvent.click(screen.getByTestId('lucid-onboarding-continue'));
}

async function chooseIntention(
  goal: 'first_lucid_dream' | 'improve_recall' | 'more_frequent_lucidity' | 'stabilize_lucidity' = 'improve_recall',
  experience: 'beginner' | 'occasional' | 'experienced' = 'beginner'
) {
  fireEvent.click(screen.getByTestId(`lucid-goal-${goal}`));
  fireEvent.click(screen.getByTestId(`lucid-experience-${experience}`));
  continueOnboarding();
  await screen.findByText('Protect your sleep first');
}

function setSleepTime(field: 'bedtime' | 'wake-time', value: string) {
  fireEvent.click(screen.getByTestId(`lucid-sleep-${field}`));
  fireEvent.change(screen.getByTestId(`lucid-sleep-${field}-picker`), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
}

async function reachPlan(sensitivity: 'sensitive' | 'not_sensitive' = 'not_sensitive') {
  await chooseIntention();
  setSleepTime('bedtime', '23:15');
  setSleepTime('wake-time', '07:45');
  fireEvent.click(screen.getByTestId(`lucid-wake-sensitivity-${sensitivity}`));
  continueOnboarding();
  await screen.findByTestId('lucid-onboarding-plan');
}

async function reachLocalFirst() {
  await reachPlan();
  continueOnboarding();
  await screen.findByText('Ready, without an account');
}

function restoreCompletedSleepDraft(step: 2 | 3, sensitivity: 'sensitive' | 'not_sensitive' = 'not_sensitive') {
  mockState.onboarding.status = 'in_progress';
  mockState.onboarding.draftStep = step;
  mockState.onboarding.goal = 'improve_recall';
  mockState.onboarding.experience = 'beginner';
  mockState.onboarding.wakeSensitivity = sensitivity;
  mockState.onboarding.sleepScheduleConfirmed = true;
  mockState.onboarding.sleepSchedule.bedtime = '23:15';
  mockState.onboarding.sleepSchedule.wakeTime = '07:45';
}

describe('Lucid Trainer onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocale = 'en';
    mockDimensions = { fontScale: 1, height: 850, scale: 2, width: 393 };
    Object.assign(mockState.onboarding, {
      status: 'not_started', goal: null, experience: null, wakeSensitivity: null, draftStep: 0,
      sleepScheduleConfirmed: false, weeklyTarget: 3, analyticsConsent: null,
    });
    Object.assign(mockState.onboarding.sleepScheduleDraft, { bedtime: null, wakeTime: null });
    Object.assign(mockState.onboarding.sleepSchedule, { bedtime: '22:30', wakeTime: '07:00' });
    mockState.onboarding.accessibility.reduceMotion = false;
    mockState.preferences.cloudSyncEnabled = false;
    mockState.preferences.noctaliaLinkEnabled = false;
    mockSaveOnboardingDraft.mockResolvedValue(undefined);
    mockCompleteOnboarding.mockResolvedValue(undefined);
    jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      locale: 'en-US', calendar: 'gregory', numberingSystem: 'latn', timeZone: 'Europe/Paris',
    });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('uses four screens and leaves real answers and sleep times unselected', async () => {
    render(<LucidOnboardingScreen />);
    expect(screen.getByTestId('lucid-onboarding').getAttribute('data-scroll')).toBe('true');
    expect(screen.getByText('Step 1 / 4')).toBeTruthy();
    expect(screen.getByTestId('lucid-goal-improve_recall').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByTestId('lucid-experience-beginner').getAttribute('aria-checked')).toBe('false');
    expect((screen.getByTestId('lucid-onboarding-continue') as HTMLButtonElement).disabled).toBe(true);

    await chooseIntention();
    expect(screen.getByText('Step 2 / 4')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bedtime' }).getAttribute('aria-valuetext')).toBe('Not set');
    expect(screen.getByRole('button', { name: 'Wake time' }).getAttribute('aria-valuetext')).toBe('Not set');
    expect(screen.queryByText('22:30')).toBeNull();
    expect(screen.queryByText('07:00')).toBeNull();
    expect(screen.getByTestId('lucid-wake-sensitivity-sensitive').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByTestId('lucid-wake-sensitivity-not_sensitive').getAttribute('aria-checked')).toBe('false');

    setSleepTime('bedtime', '23:15');
    setSleepTime('wake-time', '07:45');
    fireEvent.click(screen.getByTestId('lucid-wake-sensitivity-not_sensitive'));
    continueOnboarding();
    await screen.findByTestId('lucid-onboarding-plan');
    expect(screen.getByText('Step 3 / 4')).toBeTruthy();
    continueOnboarding();
    await screen.findByText('Ready, without an account');
    expect(screen.getByText('Step 4 / 4')).toBeTruthy();
    expect(screen.getByText('No account required')).toBeTruthy();
    expect(screen.getByText('Permissions at first use')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /sign in|enable notifications|microphone|cloud|audio/i })).toBeNull();
  });

  it('waits for draft persistence before advancing and reports a save failure', async () => {
    render(<LucidOnboardingScreen />);
    fireEvent.click(screen.getByTestId('lucid-goal-improve_recall'));
    fireEvent.click(screen.getByTestId('lucid-experience-beginner'));
    await waitFor(() => expect(mockSaveOnboardingDraft).toHaveBeenCalledTimes(2));

    let resolveDraft: (() => void) | undefined;
    mockSaveOnboardingDraft.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveDraft = resolve; }));
    continueOnboarding();
    expect(screen.getByText('Step 1 / 4')).toBeTruthy();
    expect((screen.getByTestId('lucid-onboarding-continue') as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(resolveDraft).toBeDefined());
    resolveDraft?.();
    await screen.findByText('Protect your sleep first');

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByText('Choose your intention');
    mockSaveOnboardingDraft.mockRejectedValueOnce(new Error('disk full'));
    continueOnboarding();
    expect(await screen.findByText('Your choices could not be saved. Try again.')).toBeTruthy();
    expect(screen.getByText('Step 1 / 4')).toBeTruthy();
  });

  it('resumes the persisted step and derives plan variants from the real engine', () => {
    restoreCompletedSleepDraft(2, 'not_sensitive');
    render(<LucidOnboardingScreen />);
    expect(screen.getByText('Step 3 / 4')).toBeTruthy();
    expect(screen.getByText('Dream recall comes before adding more demanding techniques.')).toBeTruthy();
    expect(screen.getByText('A calm intention and a morning recall habit.')).toBeTruthy();

    cleanup();
    restoreCompletedSleepDraft(2, 'sensitive');
    render(<LucidOnboardingScreen />);
    expect(screen.getByText('Your sleep sensitivity keeps this first week low intensity.')).toBeTruthy();
    expect(screen.getByText('A short MILD intention before sleep.')).toBeTruthy();
  });

  it('restores a single explicitly entered sleep time without revealing the seeded default', async () => {
    mockState.onboarding.status = 'in_progress';
    mockState.onboarding.draftStep = 1;
    mockState.onboarding.goal = 'improve_recall';
    mockState.onboarding.experience = 'beginner';
    mockState.onboarding.sleepScheduleDraft.bedtime = '23:15';
    mockState.onboarding.sleepScheduleDraft.wakeTime = null;
    render(<LucidOnboardingScreen />);

    expect(screen.getByRole('button', { name: 'Bedtime' }).getAttribute('aria-valuetext')).toBe('23:15');
    expect(screen.getByRole('button', { name: 'Wake time' }).getAttribute('aria-valuetext')).toBe('Not set');
    expect(screen.queryByText('07:00')).toBeNull();

    setSleepTime('wake-time', '07:45');
    await waitFor(() => expect(mockSaveOnboardingDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sleepScheduleDraft: { bedtime: '23:15', wakeTime: '07:45' },
        sleepScheduleConfirmed: true,
      })
    ));
  });

  it('completes locally with the exact confirmed answers and no imperative redirect', async () => {
    render(<LucidOnboardingScreen />);
    await reachLocalFirst();
    continueOnboarding();
    await waitFor(() => expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1));
    expect(mockCompleteOnboarding).toHaveBeenCalledWith({
      goal: 'improve_recall', experience: 'beginner', wakeSensitivity: 'not_sensitive', weeklyTarget: 3,
      sleepSchedule: { bedtime: '23:15', wakeTime: '07:45', timeZone: 'Europe/Paris' },
      sleepScheduleConfirmed: true,
      notificationsPermission: 'unknown', notificationsExplained: false, audioSafetyAccepted: false,
      analyticsConsent: false,
      accessibility: { reduceMotion: false, largerText: false, screenReaderOptimized: false },
      cloudSyncEnabled: false, noctaliaLinkEnabled: false,
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it.each([
    ['en', 'Ready, without an account'], ['fr', 'Prêt, sans compte'], ['es', 'Listo, sin cuenta'],
    ['de', 'Bereit, ohne Konto'], ['it', 'Pronto, senza account'],
  ] as const)('renders the local-first screen in %s', (locale, title) => {
    mockLocale = locale;
    restoreCompletedSleepDraft(3);
    render(<LucidOnboardingScreen />);
    expect(screen.getByText(title)).toBeTruthy();
  });

  it('keeps large text scrollable and passes Reduce Motion to the backdrop', () => {
    mockDimensions = { fontScale: 1.5, height: 700, scale: 2, width: 360 };
    mockState.onboarding.accessibility.reduceMotion = true;
    render(<LucidOnboardingScreen />);
    expect(screen.getByTestId('lucid-onboarding').getAttribute('data-scroll')).toBe('true');
    expect(screen.getByTestId('lucid-onboarding-background-1').getAttribute('data-reduce-motion')).toBe('true');
    expect(screen.getAllByRole('radio').length).toBe(7);
  });
});
