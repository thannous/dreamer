/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockAlert = jest.fn();
const mockAddRealityCheck = jest.fn().mockResolvedValue(undefined);
const mockHaptic = jest.fn().mockResolvedValue(undefined);

jest.mock('react-native', () => ({
  ...jest.requireActual('../react-native-stub'),
  AccessibilityInfo: { announceForAccessibility: jest.fn() },
  Alert: { alert: mockAlert },
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success' },
  notificationAsync: mockHaptic,
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => false, replace: jest.fn() },
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
  PressableScale: ({ children, accessibilityLabel, disabled, onPress, testID }: any) => (
    <button aria-label={accessibilityLabel} data-testid={testID} disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  LucidScreen: ({ children, footer, testID, trailing }: any) => (
    <main data-testid={testID}>
      {trailing}
      {children}
      {footer}
    </main>
  ),
  LucidIconAction: ({ label, onPress }: any) => <button aria-label={label} onClick={onPress} />,
  LucidButton: ({ disabled, disabledReason, label, loading, onPress, testID }: any) => (
    <div>
      <button aria-label={label} data-testid={testID} disabled={disabled || loading} onClick={onPress}>
        {label}
      </button>
      {disabled && disabledReason ? <span>{disabledReason}</span> : null}
    </div>
  ),
  LucidCard: ({ children }: any) => <section>{children}</section>,
  LucidChoiceCard: ({ onPress, testID, title }: any) => (
    <button data-testid={testID} onClick={onPress}>{title}</button>
  ),
  LucidIconTile: () => null,
}));

const { default: LucidRealityCheckScreen } = require('@/app/lucid/reality-check');

describe('Lucid reality-check guide', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddRealityCheck.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('moves through Observe, Name and Verify before saving the real result', async () => {
    render(<LucidRealityCheckScreen />);

    expect(screen.getByTestId('lucid-guide-orb').getAttribute('aria-label')).toBe('Lucid guide');
    expect(screen.getByText('Step 1 · Observe')).not.toBeNull();
    expect((screen.getByTestId('lucid-reality-save') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Still to answer: Choose a check/)).not.toBeNull();

    fireEvent.click(screen.getByTestId('lucid-reality-method-nose_breathing'));
    fireEvent.click(screen.getByRole('button', { name: 'I observed carefully' }));
    expect(screen.getByText('Step 2 · Name')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'What prompted it?, Scheduled reminder' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to verification' }));
    expect(screen.getByText('Step 3 · Verify')).not.toBeNull();
    expect(screen.getByText('I paused and genuinely questioned the moment')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'What did you notice?, Awake' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save reality check' }));

    await waitFor(() => {
      expect(mockAddRealityCheck).toHaveBeenCalledWith({
        method: 'nose_breathing',
        context: 'scheduled',
        outcome: 'awake',
        mindful: true,
      });
    });
    expect(mockAlert).toHaveBeenCalledWith(
      'Check saved',
      expect.any(String),
      expect.any(Array)
    );
  });

  it('keeps the initial primary action inert when the exercise was not performed', () => {
    render(<LucidRealityCheckScreen />);

    fireEvent.click(screen.getByTestId('lucid-reality-save'));

    expect(mockAddRealityCheck).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
    expect(screen.getByTestId('lucid-reality-check')).not.toBeNull();
  });

  it('lets the user return and re-confirm attentive observation', () => {
    render(<LucidRealityCheckScreen />);

    fireEvent.click(screen.getByTestId('lucid-reality-method-finger_count'));
    fireEvent.click(screen.getByRole('button', { name: 'I observed carefully' }));
    fireEvent.click(screen.getByTestId('lucid-reality-previous'));

    expect(screen.getByText('Step 1 · Observe')).not.toBeNull();
    expect((screen.getByRole('button', { name: 'I observed carefully' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
