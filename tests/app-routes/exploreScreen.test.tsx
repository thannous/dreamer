/* @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { TID } from '@/lib/testIDs';

const mockAccessibilityFocus = jest.fn();
const mockAccessibilityAnnouncement = jest.fn();
const mockWindowListeners = new Map<string, () => void>();
let mockPlatformOS: 'android' | 'ios' | 'web' = 'android';
let mockWindowWidth = 390;
let mockWindowHeight = 844;
let mockFontScale = 1;
let mockBottomInset = 0;
let mockSleepSoundsAvailable = false;
const mockPush = jest.fn();
const mockSaveRitualPreference = jest.fn(async (_id: string): Promise<void> => undefined);
const mockGetRitualPreference = jest.fn(async (): Promise<unknown> => 'starter');
let capturedFocusCallback: (() => void | (() => void)) | undefined;
let mockFocusCleanups: ((() => void) | void)[] = [];

jest.mock('react-native', () => {
  const React = require('react');
  return {
    AccessibilityInfo: { sendAccessibilityEvent: mockAccessibilityFocus, announceForAccessibility: mockAccessibilityAnnouncement },
    AppState: { addEventListener: (event: string, callback: () => void) => {
      mockWindowListeners.set(event, callback);
      return { remove: () => mockWindowListeners.delete(event) };
    } },
    Modal: ({ children, onRequestClose }: any) => <div role="dialog"><button data-testid="sheet-dismiss" onClick={onRequestClose}>Dismiss</button>{children}</div>,
    Platform: {
      get OS() {
        return mockPlatformOS;
      },
    },
    StyleSheet: { create: (d: Record<string, unknown>) => d, flatten: (s: unknown) => s },
    Pressable: React.forwardRef(function MockPressable({ children, onPress, testID, accessibilityLabel, accessibilityRole, accessibilityState, disabled }: any, ref: any) { return (
      <button
        ref={ref}
        aria-label={accessibilityLabel}
        aria-checked={accessibilityState?.checked}
        disabled={disabled}
        data-testid={testID}
        onClick={onPress}
        role={accessibilityRole}
        type="button"
      >
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ); }),
    ScrollView: ({ children, style, contentContainerStyle, contentInsetAdjustmentBehavior }: any) => (
      <div data-testid="explorer-scroll" data-native-style={JSON.stringify(style ?? {})}
        data-content-style={JSON.stringify(contentContainerStyle)} data-inset-behavior={contentInsetAdjustmentBehavior}>
        {children}
      </div>
    ),
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
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: mockBottomInset, left: 0 }),
}));

jest.mock('@/components/NoctaliaScreenHeader', () => ({
  NoctaliaScreenHeader: ({ actions, titleKey }: any) => (
    <div data-testid="explorer-header">
      <span>{titleKey}</span>
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
  saveRitualPreference: (id: string) => mockSaveRitualPreference(id),
  getRitualPreference: (...args: unknown[]) => (mockGetRitualPreference as any)(...args),
}));

const { default: ExploreScreen } = require('@/app/(tabs)/explore');
const { getBottomNavigationLayout } = require('@/constants/layout');

afterEach(() => {
  cleanup();
  mockWindowListeners.clear();
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockPlatformOS = 'android';
  mockWindowWidth = 390;
  mockWindowHeight = 844;
  mockFontScale = 1;
  mockBottomInset = 0;
  mockSleepSoundsAvailable = false;
  capturedFocusCallback = undefined;
  mockFocusCleanups = [];
  mockSaveRitualPreference.mockReset();
  mockSaveRitualPreference.mockResolvedValue(undefined);
  mockGetRitualPreference.mockReset();
  mockGetRitualPreference.mockResolvedValue('starter');
});

describe('ExploreScreen', () => {
  it.each([[640, 320], [915, 412]])('scrolls the header with resources only in compact large text at %i by %i dp', async (width: number, height: number) => {
    mockGetRitualPreference.mockResolvedValue('memory');
    mockBottomInset = 24;
    const view = render(<ExploreScreen />);
    await screen.findByText('explore.ritual.open:inspiration.ritual.variant.memory');
    for (const fontScale of [1, 1.5, 2]) {
      mockWindowWidth = width;
      mockWindowHeight = height;
      mockFontScale = fontScale;
      view.rerender(<ExploreScreen />);
      const scroll = screen.getByTestId('explorer-scroll');
      const header = screen.getByTestId('explorer-header');
      const settings = screen.getByTestId(TID.Button.HeaderExploreSettings);
      expect(screen.getAllByTestId('explorer-header')).toHaveLength(1);
      expect(screen.getAllByTestId(TID.Button.HeaderExploreSettings)).toHaveLength(1);
      expect(scroll.contains(header)).toBe(fontScale >= 1.3);
      expect(scroll.contains(screen.getByTestId(TID.Button.ExplorerSymbols))).toBe(true);
      const style = JSON.parse(scroll.getAttribute('data-native-style') ?? '{}');
      const content = JSON.parse(scroll.getAttribute('data-content-style') ?? '{}');
      const clearance = getBottomNavigationLayout(width, height, fontScale).barHeight + 24;
      if (fontScale >= 1.3) {
        expect(style.marginBottom).toBe(clearance);
        expect(height - style.marginBottom).toBeGreaterThanOrEqual(120);
        expect(content.paddingBottom).toBeLessThan(clearance);
        expect(scroll.getAttribute('data-inset-behavior')).toBe('never');
      } else {
        expect(style.marginBottom).toBeUndefined();
        expect(content.paddingBottom).toBeGreaterThan(clearance);
      }
      fireEvent.click(settings);
      expect(mockPush).toHaveBeenLastCalledWith('/settings');
      fireEvent.click(screen.getByTestId(TID.Button.ExplorerRitual));
      expect(mockPush).toHaveBeenLastCalledWith('/ritual/memory');

      mockWindowWidth = height;
      mockWindowHeight = width;
      view.rerender(<ExploreScreen />);
      expect(screen.getByTestId('explorer-scroll').contains(screen.getByTestId('explorer-header'))).toBe(false);
      expect(screen.getAllByTestId(TID.Button.HeaderExploreSettings)).toHaveLength(1);
      expect(screen.getByText('explore.ritual.open:inspiration.ritual.variant.memory')).toBeTruthy();
      expect(mockGetRitualPreference).toHaveBeenCalledTimes(1);
    }
  });

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
    await screen.findByText('explore.ritual.open:inspiration.ritual.variant.memory');

    fireEvent.click(screen.getByTestId(TID.Button.ExplorerRitual));
    expect(mockPush).toHaveBeenCalledWith('/ritual/memory');
  });

  it('falls back to the starter ritual when a refocused preference is unknown', async () => {
    mockGetRitualPreference.mockResolvedValue('memory');
    render(<ExploreScreen />);
    await screen.findByText('explore.ritual.open:inspiration.ritual.variant.memory');

    mockGetRitualPreference.mockResolvedValue('unknown-ritual');
    await act(async () => {
      capturedFocusCallback?.();
    });
    await screen.findByText('explore.ritual.open:inspiration.ritual.variant.starter');

    fireEvent.click(screen.getByTestId(TID.Button.ExplorerRitual));
    expect(mockPush).toHaveBeenCalledWith('/ritual/starter');
  });

  it('falls back to the starter ritual when a refocused preference read fails', async () => {
    mockGetRitualPreference.mockResolvedValue('memory');
    render(<ExploreScreen />);
    await screen.findByText('explore.ritual.open:inspiration.ritual.variant.memory');

    mockGetRitualPreference.mockRejectedValue(new Error('storage unavailable'));
    await act(async () => {
      capturedFocusCallback?.();
    });
    await screen.findByText('explore.ritual.open:inspiration.ritual.variant.starter');

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
    await screen.findByText('explore.ritual.open:inspiration.ritual.variant.lucid');

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
    await screen.findByText('explore.ritual.open:inspiration.ritual.variant.lucid');

    // The stale first read resolves late and must not overwrite the latest ritual.
    await act(async () => {
      resolveStale('memory');
    });
    expect(
      screen.getByText('explore.ritual.open:inspiration.ritual.variant.lucid')
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
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });
});


describe('Explorer ritual picker', () => {
  async function openPicker() {
    render(<ExploreScreen />);
    await screen.findByText('explore.ritual.open:inspiration.ritual.variant.starter');
    fireEvent.click(screen.getByTestId('explorer-change-ritual'));
  }

  it('announces each changed Android draft once without claiming it is saved', async () => {
    await openPicker();
    expect(mockAccessibilityAnnouncement).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByTestId('ritual-choice-memory')));
    expect(mockAccessibilityAnnouncement).toHaveBeenCalledWith(
      'explore.ritual.selection_announcement:inspiration.ritual.variant.memory',
    );
    expect(mockSaveRitualPreference).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByTestId('ritual-choice-memory')));
    expect(mockAccessibilityAnnouncement).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.click(screen.getByTestId('ritual-choice-lucid')));
    expect(mockAccessibilityAnnouncement).toHaveBeenCalledTimes(2);
    await act(async () => fireEvent.click(screen.getByTestId('ritual-picker-close')));
    await act(async () => fireEvent.click(screen.getByTestId('explorer-change-ritual')));
    expect(mockAccessibilityAnnouncement).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('ritual-choice-starter').getAttribute('aria-checked')).toBe('true');
  });

  it.each(['ios', 'web'] as const)('leaves native radio announcements alone on %s', async (platform) => {
    mockPlatformOS = platform;
    await openPicker();
    await act(async () => fireEvent.click(screen.getByTestId('ritual-choice-memory')));
    expect(mockAccessibilityAnnouncement).not.toHaveBeenCalled();
  });

  it('keeps draft selection private until confirmation and discards dismissal', async () => {
    await openPicker();
    fireEvent.click(screen.getByTestId('ritual-choice-memory'));
    expect(mockSaveRitualPreference).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss ritual-picker' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByTestId(TID.Button.ExplorerRitual));
    expect(mockPush).toHaveBeenLastCalledWith('/ritual/starter');
    fireEvent.click(screen.getByTestId('explorer-change-ritual'));
    expect(screen.getByTestId('ritual-choice-starter').getAttribute('aria-checked')).toBe('true');
  });

  it('saves the choice once and opens the newly selected ritual', async () => {
    let finish!: () => void;
    mockSaveRitualPreference.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    await openPicker();
    fireEvent.click(screen.getByTestId('ritual-choice-memory'));
    fireEvent.click(screen.getByTestId('ritual-picker-confirm'));
    fireEvent.click(screen.getByTestId('ritual-picker-confirm'));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss ritual-picker' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(mockSaveRitualPreference).toHaveBeenCalledTimes(1);
    expect(mockSaveRitualPreference).toHaveBeenCalledWith('memory');
    await act(async () => finish());
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByTestId(TID.Button.ExplorerRitual));
    expect(mockPush).toHaveBeenLastCalledWith('/ritual/memory');
  });

  it('keeps the old preference on save failure and permits retry', async () => {
    mockSaveRitualPreference.mockRejectedValueOnce(new Error('disk failure'));
    await openPicker();
    fireEvent.click(screen.getByTestId('ritual-choice-lucid'));
    fireEvent.click(screen.getByTestId('ritual-picker-confirm'));
    await screen.findByText('explore.ritual.save_error');
    expect(screen.getByText('explore.ritual.open:inspiration.ritual.variant.starter')).toBeTruthy();
    fireEvent.click(screen.getByTestId('ritual-picker-confirm'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByTestId(TID.Button.ExplorerRitual));
    expect(mockPush).toHaveBeenLastCalledWith('/ritual/lucid');
  });
});


describe('Explorer native window focus restoration', () => {
  it.each(['cancel', 'confirm'])('waits for the activity and TalkBack after %s, then restores only once', async (action: string) => {
    render(<ExploreScreen />);
    await screen.findByText('explore.ritual.open:inspiration.ritual.variant.starter');
    jest.useFakeTimers();
    await act(async () => fireEvent.click(screen.getByTestId('explorer-change-ritual')));
    await act(async () => mockWindowListeners.get('blur')?.());
    await act(async () => {
      if (action === 'confirm') fireEvent.click(screen.getByTestId('ritual-choice-memory'));
    });
    await act(async () => fireEvent.click(screen.getByTestId(
      action === 'confirm' ? 'ritual-picker-confirm' : 'ritual-picker-close',
    )));
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => jest.advanceTimersByTime(2000));
    expect(mockAccessibilityFocus).not.toHaveBeenCalled();
    await act(async () => mockWindowListeners.get('focus')?.());
    await act(async () => jest.advanceTimersByTime(550));
    expect(mockAccessibilityFocus).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(50));
    expect(mockAccessibilityFocus).toHaveBeenCalledTimes(1);
    expect(mockAccessibilityFocus).toHaveBeenCalledWith(
      screen.getByTestId('explorer-change-ritual'), 'focus',
    );
    await act(async () => { mockWindowListeners.get('blur')?.(); });
    await act(async () => { mockWindowListeners.get('focus')?.(); });
    await act(async () => jest.runOnlyPendingTimers());
    expect(mockAccessibilityFocus).toHaveBeenCalledTimes(1);
  });

  it.each(['reopen', 'leave'])('cancels the scheduled TalkBack restoration on %s', async (action: string) => {
    render(<ExploreScreen />);
    await screen.findByText('explore.ritual.open:inspiration.ritual.variant.starter');
    jest.useFakeTimers();
    await act(async () => fireEvent.click(screen.getByTestId('explorer-change-ritual')));
    await act(async () => mockWindowListeners.get('blur')?.());
    await act(async () => fireEvent.click(screen.getByTestId('ritual-picker-close')));
    await act(async () => mockWindowListeners.get('focus')?.());
    await act(async () => jest.advanceTimersByTime(300));
    await act(async () => {
      if (action === 'reopen') fireEvent.click(screen.getByTestId('explorer-change-ritual'));
      else mockFocusCleanups.forEach(cleanup => cleanup?.());
    });
    await act(async () => jest.runOnlyPendingTimers());
    expect(mockAccessibilityFocus).not.toHaveBeenCalled();
  });
});
