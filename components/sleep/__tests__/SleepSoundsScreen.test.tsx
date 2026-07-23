/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { SleepSoundsScreen } from '@/components/sleep/SleepSoundsScreen';

const mockBack = jest.fn();
const mockGetPreferences = jest.fn();
const mockSavePreferences = jest.fn();
const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockStop = jest.fn();

const mockPlayer = {
  error: null as string | null,
  hasStarted: false,
  isBuffering: false,
  isLoaded: true,
  isPlaying: false,
  pause: mockPause,
  play: mockPlay,
  remainingSeconds: 30 * 60,
  stop: mockStop,
};

jest.mock('react-native', () => {
  const React = require('react');

  return {
    Platform: {
      OS: 'web',
      select: (options: Record<string, unknown>) => options.web ?? options.default,
    },
    Pressable: ({
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
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      disabled?: boolean;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button
        aria-checked={accessibilityRole === 'radio' ? accessibilityState?.checked : undefined}
        aria-label={accessibilityLabel}
        data-testid={testID}
        disabled={disabled}
        onClick={onPress}
        role={accessibilityRole === 'radio' ? 'radio' : 'button'}
      >
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
    ScrollView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({
      children,
      testID,
    }: {
      children?: React.ReactNode;
      testID?: string;
    }) => <span data-testid={testID}>{children}</span>,
    View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
  },
}));

jest.mock('@/components/inspiration/AtmosphericBackground', () => ({
  AtmosphericBackground: () => null,
}));

jest.mock('@/components/inspiration/GlassCard', () => ({
  GlassCard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon.${name}`} />,
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    accent: { base: '#c5a46d' },
    action: {
      disabled: '#333',
      disabledBorder: '#444',
      disabledText: '#888',
      primary: '#765',
      primaryBorder: '#876',
      primaryText: '#fff',
    },
    screen: { background: '#080711' },
    status: { danger: { text: '#f88' } },
    surface: {
      active: '#29233b',
      border: '#333',
      raised: '#111',
      soft: '#222',
    },
    text: {
      onAccent: '#111',
      primary: '#fff',
      secondary: '#aaa',
      tertiary: '#777',
    },
  }),
}));

jest.mock('@/context/ScrollPerfContext', () => ({
  ScrollPerfProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {},
    mode: 'dark',
    shadows: { lg: {} },
  }),
}));

jest.mock('@/hooks/useScrollIdle', () => ({
  useScrollIdle: () => ({
    isScrolling: false,
    onMomentumScrollBegin: jest.fn(),
    onMomentumScrollEnd: jest.fn(),
    onScrollBeginDrag: jest.fn(),
    onScrollEndDrag: jest.fn(),
  }),
}));

jest.mock('@/hooks/useSleepSoundPlayer', () => ({
  useSleepSoundPlayer: () => mockPlayer,
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    currentLang: 'en',
    t: (key: string) => key,
  }),
}));

jest.mock('@/services/sleepSoundPreferences', () => ({
  getSleepSoundPreferences: () => mockGetPreferences(),
  saveSleepSoundPreferences: (...args: unknown[]) => mockSavePreferences(...args),
}));

describe('SleepSoundsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPreferences.mockResolvedValue({
      durationMinutes: 30,
      soundId: 'rain',
    });
    mockSavePreferences.mockResolvedValue(undefined);
    mockStop.mockResolvedValue(undefined);
    mockPlay.mockResolvedValue(undefined);
    mockPlayer.error = null;
    mockPlayer.hasStarted = false;
    mockPlayer.isBuffering = false;
    mockPlayer.isLoaded = true;
    mockPlayer.isPlaying = false;
    mockPlayer.remainingSeconds = 30 * 60;
  });

  afterEach(cleanup);

  it('restores the saved ambience and timer before enabling playback', async () => {
    mockGetPreferences.mockResolvedValue({
      durationMinutes: 45,
      soundId: 'ocean',
    });
    mockPlayer.remainingSeconds = 42 * 60 + 7;
    render(<SleepSoundsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('sleep-sound-ocean').getAttribute('aria-checked')).toBe('true');
      expect(screen.getByTestId('sleep-duration-45').getAttribute('aria-checked')).toBe('true');
    });
    expect(screen.getByTestId('sleep-remaining-time').textContent).toBe('42:07');
    expect((screen.getByTestId('sleep-playback-toggle') as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByTestId('sleep-playback-toggle'));
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it('stops the idle player and persists sound and duration choices', async () => {
    render(<SleepSoundsScreen />);
    await waitFor(() => {
      expect((screen.getByTestId('sleep-playback-toggle') as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(screen.getByTestId('sleep-sound-ocean'));
    await waitFor(() => {
      expect(mockSavePreferences).toHaveBeenCalledWith({
        durationMinutes: 30,
        soundId: 'ocean',
      });
    });

    fireEvent.click(screen.getByTestId('sleep-duration-15'));
    await waitFor(() => {
      expect(mockSavePreferences).toHaveBeenLastCalledWith({
        durationMinutes: 15,
        soundId: 'ocean',
      });
    });
    expect(mockStop).toHaveBeenCalledTimes(2);
  });

  it('locks choices during playback and exposes pause instead of restarting', async () => {
    mockPlayer.hasStarted = true;
    mockPlayer.isPlaying = true;
    render(<SleepSoundsScreen />);

    await waitFor(() => {
      expect((screen.getByTestId('sleep-sound-ocean') as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByTestId('sleep-duration-15') as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByTestId('sleep-playback-toggle') as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(screen.getByTestId('sleep-sound-ocean'));
    fireEvent.click(screen.getByTestId('sleep-duration-15'));
    fireEvent.click(screen.getByTestId('sleep-playback-toggle'));

    expect(mockSavePreferences).not.toHaveBeenCalled();
    expect(mockStop).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
    expect(mockPause).toHaveBeenCalledTimes(1);
  });
});
