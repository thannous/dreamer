/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockUpdateAudioSafetyConsent = jest.fn().mockResolvedValue(undefined);
const mockUpdatePreferences = jest.fn().mockResolvedValue(undefined);
const mockStartNight = jest.fn().mockResolvedValue(true);
const mockStopNight = jest.fn().mockResolvedValue(undefined);
const mockPreview = jest.fn().mockResolvedValue(undefined);

let mockAudioSafetyAccepted = false;
let mockNightPlan: { sessionId: string; soundId: string } | null = null;
let lastNightAudioParams: { policy?: { mode: string; allowNightSignals: boolean; reasons: string[] } } | null =
  null;

jest.mock('react-native', () => {
  const native = jest.requireActual('../react-native-stub');
  return {
    ...native,
    AccessibilityInfo: { announceForAccessibility: jest.fn() },
    Alert: { alert: jest.fn() },
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      disabled,
      onPress,
      testID,
    }: any) => (
      <button
        aria-checked={accessibilityState?.checked}
        aria-expanded={accessibilityState?.expanded}
        aria-label={accessibilityLabel}
        aria-selected={accessibilityState?.selected}
        data-testid={testID}
        disabled={disabled}
        onClick={onPress}
        role={accessibilityRole}
      >
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    View: ({ accessibilityLabel, accessibilityRole, children, testID }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      children?: React.ReactNode;
      testID?: string;
    }) => <div aria-label={accessibilityLabel} data-testid={testID} role={accessibilityRole}>{children}</div>,
  };
});

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('expo-image', () => ({
  Image: () => <img alt="" />,
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/constants/lucidTheme', () => ({
  ...jest.requireActual('@/constants/lucidTheme'),
  getLucidPalette: () => ({
    accent: '#0e7a63',
    accentOn: '#0a6151',
    accentSoft: '#d8f2ea',
    amber: '#9a6200',
    amberSoft: '#FBEEDA',
    background: '#f2f6f6',
    backgroundDeep: '#e6eded',
    border: '#d4e0e0',
    borderInteractive: '#748889',
    danger: '#b42318',
    surface: '#ffffff',
    surfaceRaised: '#eaf1f1',
    text: '#132226',
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
      state: {
        onboarding: {
          audioSafetyAccepted: mockAudioSafetyAccepted,
          sleepSchedule: { bedtime: '22:45', wakeTime: '07:15', timeZone: 'Europe/Paris' },
        },
        preferences: { audioVolume: 0.25, audioCuesEnabled: false },
      },
      content: getLucidContent('en'),
      updateAudioSafetyConsent: mockUpdateAudioSafetyConsent,
      updatePreferences: mockUpdatePreferences,
    }),
  };
});

jest.mock('@/hooks/useLucidNightAudio', () => ({
  useLucidNightAudio: (params: { policy?: { mode: string; allowNightSignals: boolean; reasons: string[] } }) => {
    lastNightAudioParams = params;
    return {
      error: null,
      isLoaded: true,
      isPlaying: false,
      isScheduling: false,
      plan: mockNightPlan,
      preview: mockPreview,
      remaining: { getSnapshot: () => 0, subscribe: () => () => {} },
      startNight: mockStartNight,
      stopNight: mockStopNight,
    };
  },
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  LUCID_TAB_BAR_INSET: 92,
  LucidScreen: ({ children, testID }: { children: React.ReactNode; testID?: string }) => (
    <main data-testid={testID}>{children}</main>
  ),
  LucidCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  LucidSectionHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
  LucidIconTile: () => null,
  LucidButton: ({ disabled, disabledReason, label, onPress, testID }: {
    disabled?: boolean;
    disabledReason?: string;
    label: string;
    onPress: () => void;
    testID?: string;
  }) => (
    <div>
      <button data-testid={testID} disabled={disabled} onClick={onPress}>{label}</button>
      {disabled && disabledReason ? <span>{disabledReason}</span> : null}
    </div>
  ),
  LucidToggleRow: ({ description, onValueChange, testID, title, value }: {
    description?: string;
    onValueChange: (value: boolean) => void;
    testID?: string;
    title: string;
    value: boolean;
  }) => (
    <button
      aria-label={title}
      aria-pressed={value}
      data-testid={testID}
      onClick={() => onValueChange(!value)}
    >
      {title}
      {description ? <span>{description}</span> : null}
    </button>
  ),
}));

const { default: LucidNightScreen } = require('@/app/lucid/(tabs)/night');

describe('Lucid Trainer night audio safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAudioSafetyAccepted = false;
    mockNightPlan = null;
    lastNightAudioParams = null;
    mockUpdateAudioSafetyConsent.mockResolvedValue(undefined);
    mockUpdatePreferences.mockResolvedValue(undefined);
    mockStartNight.mockResolvedValue(true);
  });

  afterEach(cleanup);

  it('keeps night signals locked until audio safety is accepted on this screen', () => {
    render(<LucidNightScreen />);

    expect(screen.getByTestId('lucid-night-audio-safety').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText(/Still required:.*accept audio safety/)).not.toBeNull();
    expect((screen.getByTestId('lucid-night-start') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByTestId('lucid-night-start'));
    expect(mockStartNight).not.toHaveBeenCalled();
  });

  it('shows the persisted sleep window before the audio preparation card', () => {
    render(<LucidNightScreen />);

    const sleepWindow = screen.getByTestId('lucid-night-sleep-window');
    const preparation = screen.getByText('Tonight’s preparation');

    expect(sleepWindow.getAttribute('aria-label')).toBe(
      'Sleep window. Bedtime: 22:45. Wake time: 07:15.',
    );
    expect(screen.getByText('22:45')).not.toBeNull();
    expect(screen.getByText('07:15')).not.toBeNull();
    expect(sleepWindow.compareDocumentPosition(preparation) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('persists audio safety consent from the night safety card', async () => {
    render(<LucidNightScreen />);

    fireEvent.click(screen.getByTestId('lucid-night-audio-safety'));

    await waitFor(() => expect(mockUpdateAudioSafetyConsent).toHaveBeenCalledWith(true));
  });

  it('keeps optional sound, volume and duration behind a disclosure until asked', () => {
    render(<LucidNightScreen />);

    expect(screen.getByText('Set a quiet intention')).not.toBeNull();
    expect(screen.getByText('Audio safety')).not.toBeNull();
    expect(screen.queryByText('Soft rain')).toBeNull();
    expect(screen.queryByText('Prudent volume')).toBeNull();

    fireEvent.click(screen.getByTestId('lucid-night-signals-toggle'));

    expect(screen.getByText('Soft rain')).not.toBeNull();
    expect(screen.getByText('Prudent volume')).not.toBeNull();
    expect(screen.getByRole('radio', { name: 'Soft rain' })).not.toBeNull();
  });

  it('computes one safety policy from persisted consent and current toggles', () => {
    render(<LucidNightScreen />);
    expect(lastNightAudioParams?.policy).toEqual(
      expect.objectContaining({
        mode: 'nightFeaturesBlocked',
        allowNightSignals: false,
        reasons: ['audio_not_consented'],
      })
    );
    cleanup();

    mockAudioSafetyAccepted = true;
    render(<LucidNightScreen />);
    expect(lastNightAudioParams?.policy).toEqual(
      expect.objectContaining({
        mode: 'normal',
        allowNightSignals: true,
        allowWbtb: true,
        reasons: [],
      })
    );
    expect((screen.getByTestId('lucid-night-start') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByTestId('lucid-night-speaker'));
    expect((screen.getByTestId('lucid-night-start') as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByTestId('lucid-night-fragile'));
    expect(lastNightAudioParams?.policy).toEqual(
      expect.objectContaining({
        mode: 'reducedIntensity',
        allowNightSignals: false,
        allowWbtb: false,
        nightSignalIntensity: 'blocked',
        reasons: ['fragile_sleep'],
      })
    );
    expect((screen.getByTestId('lucid-night-start') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Still required:.*uncheck “fragile sleep”/)).not.toBeNull();
    fireEvent.click(screen.getByTestId('lucid-night-start'));
    expect(mockStartNight).not.toHaveBeenCalled();
  });

  it('does not policy-gate or paywall stop while a plan is still active', () => {
    mockAudioSafetyAccepted = true;
    mockNightPlan = { sessionId: 'lucid-night-1', soundId: 'rain' };
    render(<LucidNightScreen />);

    fireEvent.click(screen.getByTestId('lucid-night-speaker'));
    fireEvent.click(screen.getByTestId('lucid-night-fragile'));

    const stop = screen.getByTestId('lucid-night-stop') as HTMLButtonElement;
    expect(stop.disabled).toBe(false);
    expect(screen.queryByTestId('lucid-night-start')).toBeNull();

    fireEvent.click(stop);
    expect(mockStopNight).toHaveBeenCalledTimes(1);
    expect(mockStartNight).not.toHaveBeenCalled();
  });
});
