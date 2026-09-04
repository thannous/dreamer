/* @jest-environment jsdom */

import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { TID } from '@/lib/testIDs';
import type { DreamAnalysis } from '@/lib/types';

const mockPush = jest.fn();
const mockTrackProductEvent = jest.fn(
  async (_event: string, _properties?: Record<string, unknown>) => undefined,
);
type TrackedCall = [string, Record<string, unknown>?];
const todayViewedCount = () =>
  (mockTrackProductEvent.mock.calls as TrackedCall[]).filter(([event]) => event === 'home_today_viewed').length;
const mockGetSavedTranscript = jest.fn(async () => '');
const mockGetRitualStepProgress = jest.fn(async () => null);
const mockGetRitualPreference = jest.fn(async () => null);
const mockSaveRitualStepProgress = jest.fn(async () => undefined);
const mockUseDreamsData = jest.fn();

let mockWidth = 390;
let mockHeight = 844;
let mockFontScale = 1;
let mockPlatformOS: 'web' | 'ios' | 'android' = 'web';
let mockSleepSoundsAvailable = false;
let mockForeground: (() => void) | undefined;

jest.mock('expo-router', () => ({
  router: { push: mockPush },
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = require('react');
    React.useEffect(callback, [callback]);
  },
}));

jest.mock('react-native', () => {
  const React = require('react');
  return {
    Platform: {
      get OS() {
        return mockPlatformOS;
      },
      select: (options: Record<string, unknown>) => options[mockPlatformOS] ?? options.default ?? options.web,
    },
    StyleSheet: {
      create: (definitions: Record<string, unknown>) => definitions,
      flatten: (style: unknown) => style,
      hairlineWidth: 1,
    },
    useWindowDimensions: () => ({
      width: mockWidth,
      height: mockHeight,
      scale: 2,
      fontScale: mockFontScale,
    }),
    View: ({
      accessibilityLabel,
      accessibilityRole,
      children,
      testID,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      children?: React.ReactNode;
      testID?: string;
    }) => (
      <div aria-label={accessibilityLabel} data-testid={testID} role={accessibilityRole}>
        {children}
      </div>
    ),
    Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <span data-testid={testID}>{children}</span>
    ),
    ScrollView: ({
      children,
      contentContainerStyle,
    }: {
      children?: React.ReactNode;
      contentContainerStyle?: { paddingBottom?: number };
    }) => (
      <div data-testid="home-scroll" data-padding-bottom={contentContainerStyle?.paddingBottom}>
        {children}
      </div>
    ),
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
      testID,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button aria-label={accessibilityLabel} data-testid={testID} onClick={onPress} type="button">
        {children}
      </button>
    ),
  };
});

jest.mock('@/components/motion', () => ({
  PressableScale: ({
    accessibilityLabel,
    children,
    onPress,
    testID,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button aria-label={accessibilityLabel} data-testid={testID} onClick={onPress} type="button">
      {children}
    </button>
  ),
  Reveal: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/inspiration/GlassCard', () => ({
  FlatGlassCard: ({
    accessibilityLabel,
    children,
    onPress,
    testID,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
    onPress?: () => void;
    testID?: string;
  }) =>
    onPress ? (
      <button aria-label={accessibilityLabel} data-testid={testID} onClick={onPress} type="button">
        {children}
      </button>
    ) : (
      <div aria-label={accessibilityLabel} data-testid={testID}>
        {children}
      </div>
    ),
}));

jest.mock('@/components/inspiration/AtmosphericBackground', () => ({
  AtmosphericBackground: () => null,
}));
jest.mock('@/components/inspiration/PageHeader', () => ({
  PageHeader: ({ titleKey }: { titleKey: string }) => <header>{titleKey}</header>,
}));
jest.mock('@/components/NoctaliaScreenHeader', () => ({
  NoctaliaScreenHeader: ({
    titleKey,
    actions = [],
  }: {
    titleKey: string;
    actions?: {
      accessibilityLabel: string;
      onPress: () => void;
      testID?: string;
    }[];
  }) => (
    <header>
      <span>{titleKey}</span>
      {actions.map((action) => (
        <button
          key={action.testID ?? action.accessibilityLabel}
          aria-label={action.accessibilityLabel}
          data-testid={action.testID}
          onClick={action.onPress}
          type="button"
        />
      ))}
    </header>
  ),
}));
jest.mock('@/components/reminders/ReminderOptInCard', () => ({
  ReminderOptInCard: () => null,
}));
jest.mock('@/components/inspiration/PersonalReadingCard', () => ({
  PersonalReadingCard: () => null,
}));
jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-icon={name} />,
}));
jest.mock('@/components/ScreenContainer', () => ({
  ScreenContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/context/ScrollPerfContext', () => ({
  ScrollPerfProvider: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/hooks/useScrollIdle', () => ({
  useScrollIdle: () => ({
    isScrolling: false,
    onScrollBeginDrag: jest.fn(),
    onScrollEndDrag: jest.fn(),
    onMomentumScrollBegin: jest.fn(),
    onMomentumScrollEnd: jest.fn(),
  }),
}));
jest.mock('@/hooks/useClearWebFocus', () => ({ useClearWebFocus: () => undefined }));
jest.mock('@/hooks/useAppState', () => ({
  useAppState: (onForeground?: () => void) => {
    mockForeground = onForeground;
  },
}));
jest.mock('@/components/settings/useNotificationSettingsController', () => ({
  useNotificationSettingsController: () => ({
    unsupported: true,
    notificationsEnabled: false,
    nextReminderText: null,
  }),
}));
jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    currentLang: 'en',
    t: (key: string) => key,
  }),
}));
jest.mock('@/context/ThemeContext', () => {
  const { LightTheme } = require('@/constants/journalTheme');
  return {
    useTheme: () => ({ colors: LightTheme, mode: 'light' }),
  };
});
jest.mock('@/context/DreamsContext', () => ({
  useDreamsData: () => mockUseDreamsData(),
}));
jest.mock('@/lib/analytics', () => ({
  trackProductEvent: (...args: unknown[]) => mockTrackProductEvent(...args),
}));
jest.mock('@/lib/personalReading', () => ({
  buildPersonalReading: () => null,
}));
jest.mock('@/lib/sleepSoundsFeature', () => ({
  isSleepSoundsAvailable: () => mockSleepSoundsAvailable,
}));
jest.mock('@/lib/sleepSoundCopy', () => ({
  getSleepSoundCopy: () => ({
    entryTitle: 'sleep.entryTitle',
    screenTitle: 'sleep.screenTitle',
    entryBody: 'sleep.entryBody',
  }),
}));
jest.mock('@/services/storageService', () => ({
  getSavedTranscript: () => mockGetSavedTranscript(),
  getRitualStepProgress: () => mockGetRitualStepProgress(),
  getRitualPreference: () => mockGetRitualPreference(),
  saveRitualStepProgress: (...args: unknown[]) => mockSaveRitualStepProgress(...args),
}));

const { default: HomeScreen } = require('@/app/(tabs)/index');

const DAY_MS = 24 * 60 * 60 * 1000;
const noonToday = (() => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return date.getTime();
})();
const yesterday = noonToday - DAY_MS;
const tomorrow = noonToday + DAY_MS;
let nowMs = noonToday;
let dateNowSpy: { mockRestore: () => void } | undefined;

function buildDream(overrides: Partial<DreamAnalysis> = {}): DreamAnalysis {
  return {
    id: noonToday,
    transcript: 'A quiet street',
    title: 'Night walk',
    interpretation: '',
    shareableQuote: '',
    imageUrl: '',
    chatHistory: [],
    dreamType: 'Symbolic Dream',
    isAnalyzed: false,
    ...overrides,
  };
}

function analyzedDream(overrides: Partial<DreamAnalysis> = {}): DreamAnalysis {
  return buildDream({
    interpretation: 'The street is a memory.',
    isAnalyzed: true,
    analyzedAt: noonToday,
    analysisStatus: 'done',
    ...overrides,
  });
}

async function renderHome(dreams: DreamAnalysis[], loaded = true) {
  mockUseDreamsData.mockReturnValue({ dreams, loaded });
  const view = render(<HomeScreen />);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

describe('Home Accueil Aujourd’hui', () => {
  beforeEach(() => {
    mockWidth = 390;
    mockHeight = 844;
    mockFontScale = 1;
    mockPlatformOS = 'web';
    mockSleepSoundsAvailable = false;
    mockForeground = undefined;
    nowMs = noonToday;
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => nowMs);
    mockUseDreamsData.mockReturnValue({ dreams: [], loaded: true });
    mockGetSavedTranscript.mockResolvedValue('');
    mockGetRitualStepProgress.mockResolvedValue(null);
    mockGetRitualPreference.mockResolvedValue(null);
    mockPush.mockReset();
    mockTrackProductEvent.mockClear();
  });

  afterEach(() => {
    cleanup();
    dateNowSpy?.mockRestore();
    dateNowSpy = undefined;
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('shows empty capture with a single CTA and no chat shortcut', async () => {
    await renderHome([]);

    expect(screen.getByTestId(TID.Text.HomeTodayState).textContent).toBe('empty');
    expect(screen.getAllByTestId(TID.Button.HomeTodayCta)).toHaveLength(1);
    expect(screen.getByLabelText('home.today.empty.cta')).toBeTruthy();
    expect(screen.queryByTestId(TID.Button.InspirationLastDreamChat)).toBeNull();
    expect(screen.queryByText('inspiration.lastDream.chat_cta')).toBeNull();
    expect(screen.queryByTestId(TID.Screen.Paywall)).toBeNull();
    expect(screen.queryByTestId(TID.Button.AuthSignIn)).toBeNull();
    expect(screen.getByTestId(TID.Component.HomeResources)).toBeTruthy();
    expect(screen.getByText('home.today.resources')).toBeTruthy();
    expect(screen.getByTestId(TID.Button.HomeResourcesSymbols)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.HomeResourcesGuides)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.HomeResourcesRitual)).toBeTruthy();
    expect(screen.queryByTestId(TID.Component.InspirationTip)).toBeNull();
    expect(screen.queryByTestId(TID.Button.InspirationRitualVariant('starter'))).toBeNull();

    fireEvent.click(screen.getByTestId(TID.Button.HomeTodayCta));
    expect(mockPush).toHaveBeenCalledWith('/recording');
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringMatching(/paywall|auth|sign-in/));
    expect(mockTrackProductEvent).toHaveBeenCalledWith('home_today_cta_clicked', {
      state: 'empty',
      reason: 'first_use',
      action: 'start_capture',
    });
  });

  it('lets a saved draft beat an existing today dream', async () => {
    mockGetSavedTranscript.mockResolvedValue('unfinished fragment');
    await renderHome([analyzedDream({ explorationStartedAt: noonToday })]);

    await waitFor(() => {
      expect(screen.getByTestId(TID.Text.HomeTodayState).textContent).toBe('draft_resume');
    });
    expect(screen.getAllByTestId(TID.Button.HomeTodayCta)).toHaveLength(1);

    fireEvent.click(screen.getByTestId(TID.Button.HomeTodayCta));
    expect(mockPush).toHaveBeenCalledWith('/recording');
    expect(mockPush).not.toHaveBeenCalledWith(`/journal/${noonToday}`);
  });

  it('asks for capture on a silent day that already has a journal', async () => {
    await renderHome([
      analyzedDream({
        id: yesterday,
        analyzedAt: yesterday,
        explorationStartedAt: yesterday,
      }),
    ]);

    expect(screen.getByTestId(TID.Text.HomeTodayState).textContent).toBe('capture_due');
    fireEvent.click(screen.getByTestId(TID.Button.HomeTodayCta));
    expect(mockPush).toHaveBeenCalledWith('/recording');
  });

  it('continues an unanalyzed today dream', async () => {
    await renderHome([buildDream({ id: noonToday })]);

    expect(screen.getByTestId(TID.Text.HomeTodayState).textContent).toBe('continue_today');
    fireEvent.click(screen.getByTestId(TID.Button.HomeTodayCta));
    expect(mockPush).toHaveBeenCalledWith(`/journal/${noonToday}`);
  });

  it('offers optional deepen after analysis', async () => {
    await renderHome([analyzedDream()]);

    expect(screen.getByTestId(TID.Text.HomeTodayState).textContent).toBe('optional_deepen');
    fireEvent.click(screen.getByTestId(TID.Button.HomeTodayCta));
    expect(mockPush).toHaveBeenCalledWith(`/journal/${noonToday}`);
  });

  it('rests after a completed today dream by opening the journal', async () => {
    await renderHome([analyzedDream({ explorationStartedAt: noonToday })]);

    expect(screen.getByTestId(TID.Text.HomeTodayState).textContent).toBe('rest');
    fireEvent.click(screen.getByTestId(TID.Button.HomeTodayCta));
    expect(mockPush).toHaveBeenCalledWith('/journal');
  });

  it('keeps a single primary CTA on desktop while resources stay secondary', async () => {
    mockWidth = 1280;
    mockSleepSoundsAvailable = true;
    await renderHome([]);

    expect(screen.getByTestId(TID.Text.HomeTodayState).textContent).toBe('empty');
    expect(screen.getAllByTestId(TID.Button.HomeTodayCta)).toHaveLength(1);
    expect(screen.getByTestId(TID.Component.HomeResources)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.HomeSleepSounds)).toBeTruthy();
    expect(screen.queryByTestId(TID.Button.InspirationLastDreamChat)).toBeNull();
  });

  it('rechecks the draft on foreground so it can appear then disappear', async () => {
    await renderHome([analyzedDream({ explorationStartedAt: noonToday })]);
    expect(screen.getByTestId(TID.Text.HomeTodayState).textContent).toBe('rest');

    mockGetSavedTranscript.mockResolvedValue('unfinished fragment');
    await act(async () => {
      mockForeground?.();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByTestId(TID.Text.HomeTodayState).textContent).toBe('draft_resume');
    });
    expect(screen.getAllByTestId(TID.Button.HomeTodayCta)).toHaveLength(1);
    expect(screen.queryByTestId(TID.Button.InspirationLastDreamChat)).toBeNull();
    expect(screen.queryByTestId(TID.Screen.Paywall)).toBeNull();

    mockGetSavedTranscript.mockResolvedValue('   ');
    await act(async () => {
      mockForeground?.();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByTestId(TID.Text.HomeTodayState).textContent).toBe('rest');
    });
    expect(screen.getAllByTestId(TID.Button.HomeTodayCta)).toHaveLength(1);
    expect(screen.queryByTestId(TID.Button.InspirationLastDreamChat)).toBeNull();
  });

  it('still loads rituals when the draft read fails', async () => {
    mockGetSavedTranscript.mockRejectedValue(new Error('storage unavailable'));
    mockGetRitualPreference.mockResolvedValue('lucid');
    await renderHome([]);

    expect(screen.getByTestId(TID.Text.HomeTodayState).textContent).toBe('empty');
    fireEvent.click(screen.getByTestId(TID.Button.HeaderHomeInspiration));
    expect(mockPush).toHaveBeenCalledWith('/ritual/lucid');
  });

  it('reserves taller home scroll padding at fontScale 2 so content stays above the tab bar', async () => {
    mockPlatformOS = 'android';
    mockWidth = 390;
    mockFontScale = 2;
    await renderHome([]);

    const { getBottomNavigationLayout } = require('@/constants/layout');
    const { ThemeLayout } = require('@/constants/journalTheme');
    const layout = getBottomNavigationLayout(390, 844, 2);
    const base = getBottomNavigationLayout(390, 844, 1);
    const expected = layout.barHeight + layout.minimumBottomInset + ThemeLayout.spacing.lg;
    expect(screen.getByTestId('home-scroll').getAttribute('data-padding-bottom')).toBe(String(expected));
    // The padding grows with the tab bar instead of capping labels: content stays
    // above the bar (bar height + inset floor) at both scales, taller at fontScale 2.
    expect(expected).toBeGreaterThan(base.barHeight + base.minimumBottomInset + ThemeLayout.spacing.lg);
    expect(expected).toBeGreaterThanOrEqual(layout.barHeight + layout.minimumBottomInset);
  });

  it('exposes a mobile settings header action without dropping dictionary or inspiration', async () => {
    mockPlatformOS = 'ios';
    mockWidth = 390;
    await renderHome([]);

    const settings = screen.getByTestId(TID.Button.HeaderHomeSettings);
    expect(settings).toBeTruthy();
    expect(settings.getAttribute('aria-label')).toBe('nav.settings');
    expect(screen.getByTestId(TID.Button.HeaderHomeDictionary)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.HeaderHomeInspiration)).toBeTruthy();

    fireEvent.click(settings);
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings');
    expect(mockPush).not.toHaveBeenCalledWith('/symbol-dictionary');
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringMatching(/^\/ritual\//));
  });

  it('keeps compact resources below the today CTA and routes without competing CTAs', async () => {
    mockPlatformOS = 'ios';
    mockWidth = 390;
    await renderHome([]);

    expect(screen.getAllByTestId(TID.Button.HomeTodayCta)).toHaveLength(1);
    expect(screen.getByTestId(TID.Component.HomeResources)).toBeTruthy();
    fireEvent.click(screen.getByTestId(TID.Button.HomeResourcesSymbols));
    expect(mockPush).toHaveBeenCalledWith('/symbol-dictionary');
    fireEvent.click(screen.getByTestId(TID.Button.HomeResourcesGuides));
    expect(mockPush).toHaveBeenCalledWith('/dream-guides');
    fireEvent.click(screen.getByTestId(TID.Button.HomeResourcesRitual));
    expect(mockPush).toHaveBeenCalledWith('/ritual/starter');
    expect(screen.queryByTestId(TID.Component.InspirationTip)).toBeNull();
  });

  it('rebranche continue_today then capture_due when the local date changes while Home stays open', async () => {
    const intervalCallbacks: (() => void)[] = [];
    const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation((handler: TimerHandler) => {
      if (typeof handler === 'function') {
        intervalCallbacks.push(handler as () => void);
      }
      return 0 as unknown as ReturnType<typeof setInterval>;
    });
    jest.spyOn(global, 'clearInterval').mockImplementation(() => undefined);

    await renderHome([buildDream({ id: noonToday })]);
    expect(screen.getByTestId(TID.Text.HomeTodayState).textContent).toBe('continue_today');
    const viewedBeforeTick = todayViewedCount();

    await act(async () => {
      intervalCallbacks.forEach((callback) => callback());
      await Promise.resolve();
    });
    expect(screen.getByTestId(TID.Text.HomeTodayState).textContent).toBe('continue_today');
    expect(todayViewedCount()).toBe(viewedBeforeTick);

    nowMs = tomorrow;
    await act(async () => {
      intervalCallbacks.forEach((callback) => callback());
      await Promise.resolve();
    });
    expect(screen.getByTestId(TID.Text.HomeTodayState).textContent).toBe('capture_due');
    expect(screen.getAllByTestId(TID.Button.HomeTodayCta)).toHaveLength(1);
    expect(screen.queryByTestId(TID.Button.InspirationLastDreamChat)).toBeNull();
    expect(screen.queryByTestId(TID.Screen.Paywall)).toBeNull();

    fireEvent.click(screen.getByTestId(TID.Button.HomeTodayCta));
    expect(mockPush).toHaveBeenCalledWith('/recording');
    setIntervalSpy.mockRestore();
  });
});
