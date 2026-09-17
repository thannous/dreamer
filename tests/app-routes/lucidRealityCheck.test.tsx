/* @jest-environment jsdom */

import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockAlert = jest.fn();
const mockAddRealityCheck = jest.fn().mockResolvedValue(undefined);
const mockImpact = jest.fn().mockResolvedValue(undefined);
const mockNotification = jest.fn().mockResolvedValue(undefined);
let mockActiveDreamSigns: { id: string; label: string }[] = [];

jest.mock('react-native', () => {
  const ReactForMock = jest.requireActual('react');
  const stub = jest.requireActual('../react-native-stub');
  return {
    ...stub,
    AccessibilityInfo: { announceForAccessibility: jest.fn() },
    Alert: { alert: mockAlert },
    Pressable: ({ children, disabled, onPressIn, onPressOut, testID }: any) =>
      ReactForMock.createElement(
        'button',
        { 'data-testid': testID, disabled, onMouseDown: onPressIn, onMouseUp: onPressOut },
        typeof children === 'function' ? children({ pressed: false }) : children
      ),
  };
});

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
  impactAsync: mockImpact,
  notificationAsync: mockNotification,
}));

let mockParams: { signId?: string } = {};

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => false, replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/constants/lucidTheme', () => ({
  ...jest.requireActual('@/constants/lucidTheme'),
  getLucidPalette: () => ({
    accent: '#0e7a63',
    accentOn: '#0b6a57',
    accentSoft: '#d8f2ea',
    backgroundDeep: '#e6eded',
    borderInteractive: '#748889',
    surfaceRaised: '#eaf1f1',
    text: '#132226',
    textMuted: '#586c6f',
    textSecondary: '#4f6467',
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'light' }),
}));

jest.mock('@/context/LucidTrainerContext', () => {
  const { getLucidContent } = jest.requireActual('@/lib/lucid/content');
  return {
    useLucidTrainer: () => ({
      state: { onboarding: { accessibility: { reduceMotion: false } } },
      content: getLucidContent('en'),
      activeDreamSigns: mockActiveDreamSigns,
      addRealityCheck: mockAddRealityCheck,
    }),
  };
});

jest.mock('@/components/lucid/LucidGuideOrb', () => ({
  LucidGuideOrb: ({ accessibilityLabel }: { accessibilityLabel: string }) => (
    <div aria-label={accessibilityLabel} data-testid="lucid-guide-orb" />
  ),
}));

jest.mock('@/components/motion/PressableScale', () => ({
  PressableScale: ({ accessibilityLabel, accessibilityState, children, disabled, onPress, testID }: any) => (
    <button
      aria-checked={accessibilityState?.checked}
      aria-label={accessibilityLabel}
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  LucidScreen: ({ children, footer, testID, trailing }: any) => (
    <main data-testid={testID}>{trailing}{children}{footer}</main>
  ),
  LucidIconAction: ({ label, onPress }: any) => <button aria-label={label} onClick={onPress} />,
  LucidButton: ({ disabled, disabledReason, label, loading, onPress, testID }: any) => (
    <div>
      <button aria-label={label} data-testid={testID} disabled={disabled || loading} onClick={onPress}>{label}</button>
      {disabled && disabledReason ? <span>{disabledReason}</span> : null}
    </div>
  ),
  LucidCard: ({ children }: any) => <section>{children}</section>,
  LucidChoiceCard: ({ onPress, testID, title }: any) => <button data-testid={testID} onClick={onPress}>{title}</button>,
  LucidIconTile: () => null,
}));

const {
  default: LucidRealityCheckScreen,
  getLucidMindfulHoldTransitionDuration,
  LUCID_MINDFUL_HOLD_DURATION_MS,
} = require('@/app/lucid/reality-check');

function useAccessibleAlternative() {
  fireEvent.click(screen.getByTestId('lucid-reality-hold-alternative'));
  fireEvent.click(screen.getByRole('button', { name: 'Continue to observation' }));
}

function fillObservation(trigger: 'scheduled' | 'transition' | 'emotion' | 'unusual_event' | 'dream_sign' = 'unusual_event') {
  fireEvent.change(screen.getByTestId('lucid-reality-observed-detail'), { target: { value: '  The clock changed twice.  ' } });
  fireEvent.click(screen.getByTestId(`lucid-reality-context-${trigger}`));
}

function advanceThroughTextAndTest() {
  fireEvent.click(screen.getByRole('button', { name: 'Continue to reconstruction' }));
  fireEvent.change(screen.getByTestId('lucid-reality-arrival-path'), { target: { value: '  I left the kitchen and entered this room.  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to the test' }));
  fireEvent.click(screen.getByTestId('lucid-reality-method-nose_breathing'));
  fireEvent.click(screen.getByTestId('lucid-reality-outcome-awake'));
  fireEvent.click(screen.getByRole('button', { name: 'Continue to intention' }));
  fireEvent.change(screen.getByTestId('lucid-reality-next-intention'), { target: { value: '  If the clock shifts, I will know I am dreaming.  ' } });
}

describe('Lucid mindful-pause guide', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockAddRealityCheck.mockResolvedValue(undefined);
    mockActiveDreamSigns = [];
    mockParams = {};
  });

  afterEach(() => {
    cleanup();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('removes the hold animation when Reduce Motion is active', () => {
    expect(getLucidMindfulHoldTransitionDuration(false, true)).toBe('2000ms');
    expect(getLucidMindfulHoldTransitionDuration(true, true)).toBe('0ms');
    expect(getLucidMindfulHoldTransitionDuration(false, false)).toBe('0ms');
  });

  it('requires the complete two-second hold and resets when released early', () => {
    render(<LucidRealityCheckScreen />);
    const hold = screen.getByTestId('lucid-reality-hold');
    const next = screen.getByTestId('lucid-reality-save') as HTMLButtonElement;

    expect(screen.getByText('Step 1 · Stop')).not.toBeNull();
    expect(next.disabled).toBe(true);
    fireEvent.mouseDown(hold);
    act(() => jest.advanceTimersByTime(LUCID_MINDFUL_HOLD_DURATION_MS - 1));
    expect(next.disabled).toBe(true);
    fireEvent.mouseUp(hold);
    act(() => jest.advanceTimersByTime(LUCID_MINDFUL_HOLD_DURATION_MS));
    expect(next.disabled).toBe(true);

    fireEvent.mouseDown(hold);
    act(() => jest.advanceTimersByTime(LUCID_MINDFUL_HOLD_DURATION_MS));
    expect((screen.getByTestId('lucid-reality-save') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText('Pause complete')).not.toBeNull();
  });

  it('offers an explicit accessible alternative without preselecting an answer', () => {
    render(<LucidRealityCheckScreen />);

    expect(screen.getByTestId('lucid-reality-hold-alternative')).not.toBeNull();
    expect(mockAddRealityCheck).not.toHaveBeenCalled();
    useAccessibleAlternative();

    expect(screen.getByText('Step 2 · Observe')).not.toBeNull();
    expect((screen.getByTestId('lucid-reality-save') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('lucid-reality-context-scheduled')).not.toBeNull();
    expect(screen.getByText(/Still to answer: Observed detail, What anchored this pause/)).not.toBeNull();
    expect((screen.getByTestId('lucid-reality-context-scheduled') as HTMLButtonElement).getAttribute('aria-checked')).not.toBe('true');
    expect((screen.getByTestId('lucid-reality-context-unusual_event') as HTMLButtonElement).getAttribute('aria-checked')).not.toBe('true');
  });

  it('persists the complete five-step flow with trimmed short responses', async () => {
    render(<LucidRealityCheckScreen />);
    useAccessibleAlternative();
    fillObservation();
    advanceThroughTextAndTest();
    fireEvent.click(screen.getByRole('button', { name: 'Save mindful pause' }));

    await waitFor(() => expect(mockAddRealityCheck).toHaveBeenCalledWith({
      method: 'nose_breathing',
      context: 'spontaneous',
      mindfulPauseAnchor: 'unusual_event',
      outcome: 'awake',
      mindful: true,
      observedDetail: 'The clock changed twice.',
      arrivalPath: 'I left the kitchen and entered this room.',
      nextDreamIntention: 'If the clock shifts, I will know I am dreaming.',
    }));
    expect(mockAlert).toHaveBeenCalledWith('Pause saved', expect.any(String), expect.any(Array));
  });

  it('requires an explicit confirmed sign for the dream-sign anchor', async () => {
    mockActiveDreamSigns = [{ id: 'sign:mirror', label: 'My mirror' }];
    render(<LucidRealityCheckScreen />);
    useAccessibleAlternative();
    fillObservation('dream_sign');

    expect(screen.getByText(/Still to answer: Which confirmed sign/)).not.toBeNull();
    fireEvent.click(screen.getByTestId('lucid-reality-sign-sign:mirror'));
    advanceThroughTextAndTest();
    fireEvent.click(screen.getByRole('button', { name: 'Save mindful pause' }));

    await waitFor(() => expect(mockAddRealityCheck).toHaveBeenCalledWith(expect.objectContaining({
      context: 'dream_sign',
      mindfulPauseAnchor: 'dream_sign',
      dreamSignId: 'sign:mirror',
      dreamSignLabel: 'My mirror',
    })));
  });

  it('lets a notification response persist as scheduled without a real-world anchor', async () => {
    render(<LucidRealityCheckScreen />);
    useAccessibleAlternative();
    fillObservation('scheduled');
    advanceThroughTextAndTest();
    fireEvent.click(screen.getByRole('button', { name: 'Save mindful pause' }));

    await waitFor(() => expect(mockAddRealityCheck).toHaveBeenCalledWith({
      method: 'nose_breathing',
      context: 'scheduled',
      outcome: 'awake',
      mindful: true,
      observedDetail: 'The clock changed twice.',
      arrivalPath: 'I left the kitchen and entered this room.',
      nextDreamIntention: 'If the clock shifts, I will know I am dreaming.',
    }));
  });

  it('keeps a targeted Atlas sign without preselecting the test conclusion', async () => {
    mockActiveDreamSigns = [
      { id: 'sign:mirror', label: 'My mirror' },
      { id: 'sign:stairs', label: 'The stairs' },
    ];
    mockParams = { signId: 'sign:mirror' };
    render(<LucidRealityCheckScreen />);
    useAccessibleAlternative();

    expect((screen.getByTestId('lucid-reality-context-dream_sign') as HTMLButtonElement).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByTestId('lucid-reality-sign-sign:mirror') as HTMLButtonElement).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByTestId('lucid-reality-sign-sign:stairs') as HTMLButtonElement).getAttribute('aria-checked')).not.toBe('true');
    expect(screen.queryByTestId('lucid-reality-method-nose_breathing')).toBeNull();
    expect(screen.queryByTestId('lucid-reality-outcome-awake')).toBeNull();
    expect(screen.queryByTestId('lucid-reality-outcome-dreaming')).toBeNull();
    expect(screen.queryByTestId('lucid-reality-outcome-uncertain')).toBeNull();

    fireEvent.change(screen.getByTestId('lucid-reality-observed-detail'), { target: { value: 'The clock changed twice.' } });
    advanceThroughTextAndTest();
    fireEvent.click(screen.getByRole('button', { name: 'Save mindful pause' }));

    await waitFor(() => expect(mockAddRealityCheck).toHaveBeenCalledWith(expect.objectContaining({
      context: 'dream_sign',
      mindfulPauseAnchor: 'dream_sign',
      dreamSignId: 'sign:mirror',
      dreamSignLabel: 'My mirror',
      outcome: 'awake',
    })));
  });

  it('ignores an unknown targeted sign instead of guessing an answer', () => {
    mockActiveDreamSigns = [{ id: 'sign:mirror', label: 'My mirror' }];
    mockParams = { signId: 'sign:unknown' };
    render(<LucidRealityCheckScreen />);
    useAccessibleAlternative();

    expect((screen.getByTestId('lucid-reality-context-dream_sign') as HTMLButtonElement).getAttribute('aria-checked')).not.toBe('true');
    expect(screen.queryByTestId('lucid-reality-sign-sign:mirror')).toBeNull();
    expect(screen.queryByTestId('lucid-reality-outcome-awake')).toBeNull();
  });

  it('hydrates a targeted Atlas sign after a cold load without clobbering a later choice', async () => {
    mockActiveDreamSigns = [];
    mockParams = { signId: 'sign:mirror' };
    const { rerender } = render(<LucidRealityCheckScreen />);
    useAccessibleAlternative();

    expect((screen.getByTestId('lucid-reality-context-dream_sign') as HTMLButtonElement).getAttribute('aria-checked')).not.toBe('true');
    expect(screen.queryByTestId('lucid-reality-sign-sign:mirror')).toBeNull();

    mockActiveDreamSigns = [
      { id: 'sign:mirror', label: 'My mirror' },
      { id: 'sign:stairs', label: 'The stairs' },
    ];
    rerender(<LucidRealityCheckScreen />);

    expect((screen.getByTestId('lucid-reality-context-dream_sign') as HTMLButtonElement).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByTestId('lucid-reality-sign-sign:mirror') as HTMLButtonElement).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByTestId('lucid-reality-sign-sign:stairs') as HTMLButtonElement).getAttribute('aria-checked')).not.toBe('true');
    expect(screen.queryByTestId('lucid-reality-outcome-awake')).toBeNull();

    fireEvent.click(screen.getByTestId('lucid-reality-sign-sign:stairs'));
    mockActiveDreamSigns = [
      { id: 'sign:mirror', label: 'My mirror' },
      { id: 'sign:stairs', label: 'The stairs' },
      { id: 'sign:clock', label: 'The clock' },
    ];
    rerender(<LucidRealityCheckScreen />);

    expect((screen.getByTestId('lucid-reality-sign-sign:stairs') as HTMLButtonElement).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByTestId('lucid-reality-sign-sign:mirror') as HTMLButtonElement).getAttribute('aria-checked')).not.toBe('true');
    expect((screen.getByTestId('lucid-reality-sign-sign:clock') as HTMLButtonElement).getAttribute('aria-checked')).not.toBe('true');
  });
});
