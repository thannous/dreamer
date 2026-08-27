/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockCompleteProgramSession = jest.fn().mockResolvedValue(undefined);
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
let mockRouteParams = { program: 'mild', session: '1' };
let mockAudioSafetyAccepted = false;
let mockProgress: {
  technique: 'mild' | 'wbtb';
  status: 'active' | 'paused';
  currentDay: number;
  completedExerciseIds: string[];
}[] = [];

jest.mock('expo-router', () => ({
  router: { back: mockBack, canGoBack: mockCanGoBack, replace: mockReplace },
  useLocalSearchParams: () => mockRouteParams,
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => <span aria-hidden="true" /> }));
jest.mock('expo-image', () => ({
  Image: ({ testID }: { testID?: string }) => <img alt="" data-testid={testID} />,
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success' },
  notificationAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native', () => {
  const React = require('react');
  const native = jest.requireActual('../react-native-stub');
  return {
    ...native,
    Alert: { alert: jest.fn() },
    Text: ({ accessibilityRole, children }: { accessibilityRole?: string; children?: React.ReactNode }) =>
      React.createElement(accessibilityRole === 'header' ? 'h1' : 'span', null, children),
    View: ({ accessibilityLabel, accessibilityRole, children, testID }: { accessibilityLabel?: string; accessibilityRole?: string; children?: React.ReactNode; testID?: string }) => (
      <div aria-label={accessibilityLabel} data-testid={testID} role={accessibilityRole}>{children}</div>
    ),
  };
});

jest.mock('@/components/motion', () => ({
  PressableScale: ({
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
    children,
    disabled,
    onPress,
    testID,
  }: {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityState?: { checked?: boolean; disabled?: boolean };
    children: React.ReactNode;
    disabled?: boolean;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button
      aria-checked={accessibilityState?.checked}
      aria-disabled={accessibilityState?.disabled}
      aria-label={accessibilityLabel}
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
      role={accessibilityRole}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  LucidButton: ({ disabled, label, onPress, testID }: { disabled?: boolean; label: string; onPress: () => void; testID?: string }) => (
    <button data-testid={testID} disabled={disabled} onClick={onPress}>{label}</button>
  ),
  LucidIconAction: ({ label, onPress }: { label: string; onPress: () => void }) => <button aria-label={label} onClick={onPress} />,
  LucidOverline: ({ text }: { text: string }) => <span>{text}</span>,
  LucidPill: ({ label }: { label: string }) => <span>{label}</span>,
  LucidProgressBar: ({ accessibilityLabel, value }: { accessibilityLabel: string; value: number }) => (
    <div aria-label={accessibilityLabel} aria-valuenow={Math.round(value * 100)} role="progressbar" />
  ),
  LucidScreen: ({ children, footer, testID }: { children: React.ReactNode; footer?: React.ReactNode; testID?: string }) => (
    <main data-testid={testID}>{children}{footer}</main>
  ),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'dark' }),
}));

jest.mock('@/context/LucidTrainerContext', () => {
  const { getLucidContent } = jest.requireActual('@/lib/lucid/content');
  return {
    useLucidTrainer: () => ({
      state: {
        onboarding: { audioSafetyAccepted: mockAudioSafetyAccepted },
        progress: mockProgress,
      },
      content: getLucidContent('en'),
      completeProgramSession: mockCompleteProgramSession,
    }),
  };
});

const { default: LucidSessionScreen } = require('@/app/lucid/session/[program]/[session]');

describe('Lucid Trainer session', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
    mockRouteParams = { program: 'mild', session: '1' };
    mockProgress = [];
    mockAudioSafetyAccepted = false;
    mockCanGoBack.mockReturnValue(true);
  });

  it('reveals reflection progressively and keeps one persistent completion action', async () => {
    render(<LucidSessionScreen />);

    expect(screen.getByTestId('lucid-session-art')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Set a precise intention' })).not.toBeNull();
    expect(screen.getByTestId('lucid-session-complete').hasAttribute('disabled')).toBe(true);
    expect(screen.queryByTestId('lucid-session-reflection')).toBeNull();

    for (let step = 1; step <= 3; step += 1) {
      const control = screen.getByTestId(`lucid-session-step-${step}`);
      expect(control.getAttribute('role')).toBe('checkbox');
      expect(control.getAttribute('aria-checked')).toBe('false');
      fireEvent.click(control);
      expect(control.getAttribute('aria-checked')).toBe('true');
    }

    expect(screen.getByTestId('lucid-session-reflection')).not.toBeNull();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    expect(screen.getByTestId('lucid-session-complete').hasAttribute('disabled')).toBe(false);

    fireEvent.click(screen.getByTestId('lucid-session-complete'));
    await waitFor(() => {
      expect(mockCompleteProgramSession).toHaveBeenCalledWith('mild', 'mild-01', 1, 7);
    });
  });

  it('blocks a future sequential session opened by URL and returns to the program', () => {
    mockRouteParams = { program: 'mild', session: '3' };
    mockProgress = [{ technique: 'mild', status: 'active', currentDay: 1, completedExerciseIds: [] }];
    mockCanGoBack.mockReturnValue(false);

    render(<LucidSessionScreen />);

    expect(screen.getByTestId('lucid-session-unavailable-back')).not.toBeNull();
    fireEvent.click(screen.getByTestId('lucid-session-unavailable-back'));
    expect(mockReplace).toHaveBeenCalledWith('/lucid/program/mild');
    expect(mockCompleteProgramSession).not.toHaveBeenCalled();
  });

  it('still reopens a completed session from a direct URL', () => {
    mockProgress = [{
      technique: 'mild',
      status: 'active',
      currentDay: 3,
      completedExerciseIds: ['mild-01', 'mild-02'],
    }];

    render(<LucidSessionScreen />);

    expect(screen.getByTestId('lucid-session-complete')).not.toBeNull();
    expect(screen.queryByTestId('lucid-session-unavailable-back')).toBeNull();
  });

  it('blocks the current session of a paused program from a direct URL', () => {
    mockRouteParams = { program: 'mild', session: '3' };
    mockProgress = [{
      technique: 'mild',
      status: 'paused',
      currentDay: 3,
      completedExerciseIds: ['mild-01', 'mild-02'],
    }];
    mockCanGoBack.mockReturnValue(false);

    render(<LucidSessionScreen />);

    expect(screen.getByTestId('lucid-session-unavailable-back')).not.toBeNull();
    expect(screen.queryByTestId('lucid-session-complete')).toBeNull();
    fireEvent.click(screen.getByTestId('lucid-session-unavailable-back'));
    expect(mockReplace).toHaveBeenCalledWith('/lucid/program/mild');
    expect(mockCompleteProgramSession).not.toHaveBeenCalled();
  });

  it('blocks a WBTB session opened by URL when the safety policy forbids it', () => {
    mockRouteParams = { program: 'wbtb', session: '1' };
    mockCanGoBack.mockReturnValue(false);

    render(<LucidSessionScreen />);

    expect(screen.getByTestId('lucid-session-unavailable-back')).not.toBeNull();
    expect(screen.queryByTestId('lucid-session-complete')).toBeNull();
    fireEvent.click(screen.getByTestId('lucid-session-unavailable-back'));
    expect(mockReplace).toHaveBeenCalledWith('/lucid/program/wbtb');
    expect(mockCompleteProgramSession).not.toHaveBeenCalled();
  });

  it('still reopens a completed WBTB session from a direct URL when WBTB is blocked', () => {
    mockRouteParams = { program: 'wbtb', session: '1' };
    mockProgress = [{
      technique: 'wbtb',
      status: 'active',
      currentDay: 2,
      completedExerciseIds: ['wbtb-01'],
    }];

    render(<LucidSessionScreen />);

    expect(screen.getByTestId('lucid-session-complete')).not.toBeNull();
    expect(screen.queryByTestId('lucid-session-unavailable-back')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Check readiness' })).not.toBeNull();
  });

  it('opens the current WBTB session when audio safety is consented', () => {
    mockRouteParams = { program: 'wbtb', session: '1' };
    mockAudioSafetyAccepted = true;

    render(<LucidSessionScreen />);

    expect(screen.getByTestId('lucid-session-complete')).not.toBeNull();
    expect(screen.queryByTestId('lucid-session-unavailable-back')).toBeNull();
  });

  it('still reopens completed history while the program is paused', () => {
    mockRouteParams = { program: 'mild', session: '1' };
    mockProgress = [{
      technique: 'mild',
      status: 'paused',
      currentDay: 3,
      completedExerciseIds: ['mild-01', 'mild-02'],
    }];

    render(<LucidSessionScreen />);

    expect(screen.getByTestId('lucid-session-complete')).not.toBeNull();
    expect(screen.queryByTestId('lucid-session-unavailable-back')).toBeNull();
  });
});
