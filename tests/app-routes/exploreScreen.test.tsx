/* @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { TID } from '@/lib/testIDs';

let mockPlatformOS: 'android' | 'ios' | 'web' = 'android';
let mockWindowWidth = 390;
let mockWindowHeight = 844;
let mockFontScale = 1;
let mockSleepSoundsAvailable = false;
const mockPush = jest.fn();
const mockGetRitualPreference = jest.fn(async (): Promise<unknown> => 'starter');
let capturedFocusCallback: (() => void | (() => void)) | undefined;
let mockFocusCleanups: ((() => void) | void)[] = [];

jest.mock('react-native', () => {
  const React = require('react');
  return {
    Platform: {
      get OS() {
        return mockPlatformOS;
      },
    },
    StyleSheet: { create: (d: Record<string, unknown>) => d, flatten: (s: unknown) => s },
    Pressable: ({ children, onPress, testID, accessibilityLabel, accessibilityRole }: any) => (
      <button
        aria-label={accessibilityLabel}
        data-testid={testID}
        onClick={onPress}
        role={accessibilityRole}
        type="button"
      >
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
    ScrollView: ({ children }: any) => <div>{children}</div>,
    Text: ({ children }: any) => <span>{children}</span>,
    View: ({ children, testID }: any) => <div data-testid={testID}>{children}</div>,
    useWindowDimensions: () => ({
      width: mockWindowWidth,
      height: mockWindowHeight,
      scale: 1,
      fontScale: mockFontScale,
    }),
  };
});

jest.mock('expo-router', () => ({
  router: { push: (...args: any[]) => mockPush(...args) },
  useFocusEffect: (callback: () => void | (() => void)) => {
    capturedFocusCallback = callback;
    const React = require('react');
    React.useEffect(() => {
      const cleanup = callback();
      mockFocusCleanups.push(cleanup);
      return () => {
        if (typeof cleanup === 'function') cleanup();
      };
    }, [callback]);
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/components/NoctaliaScreenHeader', () => ({
  NoctaliaScreenHeader: ({ actions }: any) => (
    <div>
      {actions?.map((action: any) => (
        <button
          aria-label={action.accessibilityLabel}
          data-testid={action.testID}
          key={action.testID}
          onClick={action.onPress}
          type="button"
        />
      ))}
    </div>
  ),
}));

jest.mock('@/components/ScreenContainer', () => ({
  ScreenContainer: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/inspiration/AtmosphericBackground', () => ({
  AtmosphericBackground: () => null,
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => <span />,
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    accent: { text: '#accent' },
    surface: { border: '#border', raised: '#raised' },
    text: { secondary: '#muted' },
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'dark' }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params?.ritual ? `${key}:${params.ritual}` : key,
  }),
}));

jest.mock('@/lib/sleepSoundsFeature', () => ({
  isSleepSoundsAvailable: () => mockSleepSoundsAvailable,
}));

jest.mock('@/services/storageService', () => ({
  getRitualPreference: (...args: unknown[]) => (mockGetRitualPreference as any)(...args),
}));

const { default: ExploreScreen } = require('@/app/(tabs)/explore');

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  mockPlatformOS = 'android';
  mockWindowWidth = 390;
  mockWindowHeight = 844;
  mockFontScale = 1;
  mockSleepSoundsAvailable = false;
  capturedFocusCallback = undefined;
  mockFocusCleanups = [];
  mockGetRitualPreference.mockReset();
  mockGetRitualPreference.mockResolvedValue('starter');
});

describe('ExploreScreen', () => {
  it('renders the intro and the three core cards with their routes', async () => {
    render(<ExploreScreen />);
    expect(await screen.findByText('explore.intro')).toBeTruthy();
    expect(screen.getByTestId(TID.Button.ExplorerSymbols)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.ExplorerGuides)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.ExplorerRitual)).toBeTruthy();

    fireEvent.click(screen.getByTestId(TID.Button.ExplorerSymbols));
    expect(mockPush).toHaveBeenCalledWith('/symbol-dictionary');
    fireEvent.click(screen.getByTestId(TID.Button.ExplorerGuides));
    expect(mockPush).toHaveBeenCalledWith('/dream-guides');
  });

  it('routes the ritual card to the stored preference', async () => {
    mockGetRitualPreference.mockResolvedValue('memory');
    render(<ExploreScreen />);
    await waitFor(() => expect(mockGetRitualPreference).toHaveBeenCalled());
    await screen.findByText('explore.ritual.body:inspiration.ritual.variant.memory');

    fireEvent.click(screen.getByTestId(TID.Button.ExplorerRitual));
    expect(mockPush).toHaveBeenCalledWith('/ritual/memory');
  });

  it('falls back to the starter ritual when a refocused preference is unknown', async () => {
    mockGetRitualPreference.mockResolvedValue('memory');
    render(<ExploreScreen />);
    await screen.findByText('explore.ritual.body:inspiration.ritual.variant.memory');

    mockGetRitualPreference.mockResolvedValue('unknown-ritual');
    await act(async () => {
      capturedFocusCallback?.();
    });
    await screen.findByText('explore.ritual.body:inspiration.ritual.variant.starter');

    fireEvent.click(screen.getByTestId(TID.Button.ExplorerRitual));
    expect(mockPush).toHaveBeenCalledWith('/ritual/starter');
  });

  it('falls back to the starter ritual when a refocused preference read fails', async () => {
    mockGetRitualPreference.mockResolvedValue('memory');
    render(<ExploreScreen />);
    await screen.findByText('explore.ritual.body:inspiration.ritual.variant.memory');

    mockGetRitualPreference.mockRejectedValue(new Error('storage unavailable'));
    await act(async () => {
      capturedFocusCallback?.();
    });
    await screen.findByText('explore.ritual.body:inspiration.ritual.variant.starter');

    fireEvent.click(screen.getByTestId(TID.Button.ExplorerRitual));
    expect(mockPush).toHaveBeenCalledWith('/ritual/starter');
  });

  it('reloads the ritual preference when the screen refocuses', async () => {
    mockGetRitualPreference.mockResolvedValue('starter');
    render(<ExploreScreen />);
    await waitFor(() => expect(mockGetRitualPreference).toHaveBeenCalledTimes(1));

    mockGetRitualPreference.mockResolvedValue('lucid');
    await act(async () => {
      capturedFocusCallback?.();
    });
    await screen.findByText('explore.ritual.body:inspiration.ritual.variant.lucid');

    fireEvent.click(screen.getByTestId(TID.Button.ExplorerRitual));
    expect(mockPush).toHaveBeenCalledWith('/ritual/lucid');
  });

  it('ignores a stale preference resolution that lands after a refocus', async () => {
    let resolveStale!: (value: unknown) => void;
    mockGetRitualPreference.mockImplementationOnce(
      () =>
        new Promise<unknown>((resolve) => {
          resolveStale = resolve;
        })
    );
    mockGetRitualPreference.mockResolvedValue('lucid');
    render(<ExploreScreen />);
    await waitFor(() => expect(mockGetRitualPreference).toHaveBeenCalledTimes(1));

    // Blur: run the mounted effect cleanup so its pending read is disarmed.
    await act(async () => {
      const cleanup = mockFocusCleanups.pop();
      if (typeof cleanup === 'function') cleanup();
    });
    // Refocus: a fresh read resolves to lucid.
    await act(async () => {
      capturedFocusCallback?.();
    });
    await screen.findByText('explore.ritual.body:inspiration.ritual.variant.lucid');

    // The stale first read resolves late and must not overwrite the latest ritual.
    await act(async () => {
      resolveStale('memory');
    });
    expect(
      screen.getByText('explore.ritual.body:inspiration.ritual.variant.lucid')
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId(TID.Button.ExplorerRitual));
    expect(mockPush).toHaveBeenCalledWith('/ritual/lucid');
  });

  it('shows the sleep sounds card only when the feature is available', async () => {
    mockSleepSoundsAvailable = false;
    const hidden = render(<ExploreScreen />);
    await screen.findByText('explore.intro');
    expect(screen.queryByTestId(TID.Button.ExplorerSleepSounds)).toBeNull();
    hidden.unmount();
    cleanup();

    mockSleepSoundsAvailable = true;
    render(<ExploreScreen />);
    const entry = await screen.findByTestId(TID.Button.ExplorerSleepSounds);
    fireEvent.click(entry);
    expect(mockPush).toHaveBeenCalledWith('/sleep-sounds');
  });

  it('routes the header action to settings', async () => {
    render(<ExploreScreen />);
    const settings = await screen.findByTestId(TID.Button.HeaderExploreSettings);
    fireEvent.click(settings);
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings');
  });
});
