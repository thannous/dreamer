/* @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { TID } from '@/lib/testIDs';
import type { DreamAnalysis } from '@/lib/types';

const mockPush = jest.fn();
const mockUseDreams = jest.fn();
const mockUseSubscription = jest.fn();
// Typed arguments so `mock.calls` can be read back: the screen-view assertions need the
// payload of a specific event, not just "was called".
const mockTrackProductEvent = jest.fn(
  async (_event: string, _properties?: Record<string, unknown>) => undefined,
);
type TrackedCall = [string, Record<string, unknown>?];
const statsViewedPayloads = () =>
  (mockTrackProductEvent.mock.calls as TrackedCall[])
    .filter(([event]) => event === 'stats_screen_viewed')
    .map(([, properties]) => properties);
// Signed-out by default. The screen derives its analytics tier from the auth user
// first, so a fixture that never sets this must read as a guest, not as a free account.
type MockAuthState = {
  user: { id: string; app_metadata?: { tier?: string } } | null;
  loading: boolean;
};
const guestAuthState = (): MockAuthState => ({ user: null, loading: false });
let mockAuthState: MockAuthState = guestAuthState();
// Focus is a real navigation event, not a mount: the tab screen stays mounted while the
// user visits another tab, so its local state — the selected period — survives. Tests
// drive it through `refocusScreen()` so the once-per-focus emit can be observed with a
// period already applied.
let mockFocusEpoch = 0;
const focusListeners = new Set<() => void>();
const subscribeFocus = (listener: () => void) => {
  focusListeners.add(listener);
  return () => {
    focusListeners.delete(listener);
  };
};
const mockShare = jest.fn(async (_options: { title?: string; message: string }) => ({
  action: 'sharedAction',
}));

// Default translator: echo the key, keeping the three Plus-boundary tests intact.
const mockEchoTranslate = (key: string) => key;
// Params translator: proves WHICH values the screen passed into a string.
const mockParamTranslate = (key: string, params?: Record<string, string | number>) =>
  params
    ? `${key}:${Object.entries(params)
        .map(([name, value]) => `${name}=${value}`)
        .join('|')}`
    : key;
// Marker translator: every catalogue lookup comes back wrapped, so any raw source
// string that reaches the UI without going through `t` stands out unwrapped.
const mockMarkerTranslate = (key: string) => `[[${key}]]`;

let mockTranslate: (key: string, params?: Record<string, string | number>) => string =
  mockEchoTranslate;
// The real InteractionManager defers the Dream types / Top themes / Engagement
// sections. Opt-in per test so the existing cases keep their current DOM.
let mockRunInteractionsImmediately = false;

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  mockTranslate = mockEchoTranslate;
  mockRunInteractionsImmediately = false;
  mockAuthState = guestAuthState();
});

const buildDream = (overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id: 1,
  transcript: 'Dream',
  title: 'Dream',
  interpretation: 'Analysis',
  shareableQuote: '',
  imageUrl: '',
  dreamType: 'Symbolic Dream',
  theme: 'calm',
  isAnalyzed: true,
  analysisStatus: 'done',
  analyzedAt: 1,
  chatHistory: [],
  ...overrides,
});

const profileDreams: DreamAnalysis[] = [
  buildDream({
    id: 3,
    memory: {
      origin: 'remembered',
      anchorDream: true,
      strongestFragment: 'place',
    },
  }),
  buildDream({ id: 2, memory: { origin: 'remembered', strongestFragment: 'place' } }),
  buildDream({ id: 1, memory: { strongestFragment: 'fear' } }),
];

jest.doMock('expo-router', () => {
  const React = require('react');
  return {
    router: { push: mockPush },
    // The screen's focus epoch — and with it the whole `stats_screen_viewed` emit —
    // hangs off this callback: the tracking effect early-returns while the epoch is 0.
    // A no-op mock therefore made the screen-view instrumentation unreachable from any
    // test (audit §8). Run the callback like a real focus instead: once on mount, again
    // on every `refocusScreen()`, and honour the cleanup it returns.
    useFocusEffect: (callback: () => void | (() => void)) => {
      const epoch = React.useSyncExternalStore(
        subscribeFocus,
        () => mockFocusEpoch,
        () => mockFocusEpoch,
      );
      React.useEffect(callback, [callback, epoch]);
    },
  };
});

jest.doMock('react-native', () => {
  const React = require('react');
  const toDomProps = (props: Record<string, any>) => {
    const {
      testID,
      onPress,
      accessible,
      accessibilityRole,
      accessibilityLabel,
      accessibilityValue,
      hitSlop,
      contentContainerStyle,
      contentInsetAdjustmentBehavior,
      numberOfLines,
      onMomentumScrollBegin,
      onMomentumScrollEnd,
      onScrollBeginDrag,
      onScrollEndDrag,
      showsVerticalScrollIndicator,
      style,
      ...rest
    } = props;
    return {
      ...rest,
      ...(testID ? { 'data-testid': testID } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}),
    };
  };
  const createElement = (tag: string) => {
    const MockNativeElement = ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: any;
    }) => React.createElement(tag, toDomProps(props), children);
    MockNativeElement.displayName = `MockNative${tag}`;
    return MockNativeElement;
  };

  return {
    __esModule: true,
    InteractionManager: {
      runAfterInteractions: (task?: () => void) => {
        if (mockRunInteractionsImmediately) {
          task?.();
        }
        return { cancel: jest.fn() };
      },
    },
    Platform: {
      OS: 'web',
      select: (values: Record<string, any>) => values?.web ?? values?.default,
    },
    Pressable: createElement('button'),
    ScrollView: createElement('div'),
    Share: { share: mockShare },
    StyleSheet: {
      create: <T extends Record<string, any>>(styles: T) => styles,
      absoluteFill: {},
      absoluteFillObject: {},
      hairlineWidth: 1,
    },
    Text: createElement('span'),
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
    View: createElement('div'),
  };
});

jest.doMock('react-native-gifted-charts', () => ({
  PieChart: () => <div data-testid="pie-chart" />,
}));

jest.doMock('react-native-svg', () => ({
  Line: () => <span data-testid="svg-line" />,
  Rect: () => <span data-testid="svg-rect" />,
  Svg: ({ children }: { children?: React.ReactNode }) => <svg>{children}</svg>,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

jest.doMock('@/components/inspiration/AtmosphericBackground', () => ({
  AtmosphericBackground: () => <div data-testid="atmospheric-background" />,
}));

jest.doMock('@/components/inspiration/GlassCard', () => ({
  StaticFlatGlassCard: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
}));

jest.doMock('@/components/inspiration/PageHeader', () => ({
  PageHeader: ({ titleKey }: { titleKey: string }) => <div>{titleKey}</div>,
}));

jest.doMock('@/components/inspiration/SectionHeading', () => ({
  SectionHeading: ({ title }: { title: string }) => <div>{title}</div>,
}));

jest.doMock('@/components/NoctaliaScreenHeader', () => ({
  // Mirrors the real component: each action becomes a pressable with its
  // accessibilityLabel and testID. The previous mock dropped `actions` entirely,
  // which made the period and share controls unreachable from any test.
  NoctaliaScreenHeader: ({
    titleKey,
    actions = [],
  }: {
    titleKey: string;
    actions?: { onPress: () => void; accessibilityLabel: string; testID?: string }[];
  }) => (
    <div>
      {titleKey}
      {actions.map((action) => (
        <button
          key={action.accessibilityLabel}
          aria-label={action.accessibilityLabel}
          data-testid={action.testID}
          onClick={action.onPress}
        />
      ))}
    </div>
  ),
}));

jest.doMock('@/components/ScreenContainer', () => ({
  ScreenContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.doMock('@/components/dev/MockNavigationRail', () => ({
  MockNavigationRail: () => <div data-testid="mock-navigation-rail" />,
}));

jest.doMock('@/components/ui/BottomSheet', () => ({
  // Honour `visible`: otherwise the period options are permanently mounted and the
  // period labels collide with the in-page period chip added by the audit.
  BottomSheet: ({ children, visible }: { children?: React.ReactNode; visible?: boolean }) =>
    visible ? <div>{children}</div> : null,
}));

jest.doMock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => <span data-testid="icon-symbol" />,
}));

jest.doMock('@/context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

jest.doMock('@/context/DreamsContext', () => ({
  useDreams: () => mockUseDreams(),
}));

jest.doMock('@/context/ScrollPerfContext', () => ({
  ScrollPerfProvider: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.doMock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    mode: 'dark',
    colors: {
      accent: '#6f62b5',
      accentLight: '#b6a8ff',
      backgroundCard: '#221b3b',
      backgroundDark: '#0b0a12',
      backgroundSecondary: '#2f274f',
      divider: '#3a3357',
      textOnAccentSurface: '#fff',
      textPrimary: '#fff',
      textSecondary: '#c7c2d7',
      textTertiary: '#9a93b4',
      tags: {
        calm: '#8bd3c7',
        mystical: '#b6a8ff',
        noir: '#77819a',
        surreal: '#f0a868',
      },
    },
  }),
}));

jest.doMock('@/hooks/useClearWebFocus', () => ({
  useClearWebFocus: () => {},
}));

jest.doMock('@/hooks/useLocaleFormatting', () => ({
  useLocaleFormatting: () => ({
    formatNumber: (value: number) => String(value),
    formatPercent: (value: number) => `${Math.round(value * 100)}%`,
  }),
}));

jest.doMock('@/hooks/useScrollIdle', () => ({
  useScrollIdle: () => ({
    isScrolling: false,
    onMomentumScrollBegin: jest.fn(),
    onMomentumScrollEnd: jest.fn(),
    onScrollBeginDrag: jest.fn(),
    onScrollEndDrag: jest.fn(),
  }),
}));

jest.doMock('@/hooks/useSubscription', () => ({
  useSubscription: () => mockUseSubscription(),
}));

jest.doMock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => mockTranslate(key, params),
  }),
}));

jest.doMock('@/lib/analytics', () => ({
  getPaywallTrigger: (trigger?: string) => trigger ?? 'direct',
  // Real bucketing: the previous stub answered '0' for every journal, so no assertion
  // could tell a journal-wide count from a period-scoped one — and `dream_count_bucket`
  // is precisely the property that must stay unfiltered.
  getStatsDreamCountBucket: (
    jest.requireActual('@/lib/analytics') as typeof import('@/lib/analytics')
  ).getStatsDreamCountBucket,
  trackProductEvent: mockTrackProductEvent,
}));

jest.doMock('@/constants/theme', () => ({
  Fonts: {
    fraunces: { bold: 'Fraunces-Bold', semiBold: 'Fraunces-SemiBold' },
    spaceGrotesk: {
      bold: 'SpaceGrotesk-Bold',
      medium: 'SpaceGrotesk-Medium',
      regular: 'SpaceGrotesk-Regular',
    },
  },
}));

const { default: StatisticsScreen } = require('@/app/(tabs)/statistics');

describe('Statistics screen dream profile Plus boundary', () => {
  it('[B] Given an unanalyzed anchor dream When viewing Stats Then the profile seed is visible', () => {
    mockUseDreams.mockReturnValue({
      dreams: [
        buildDream({
          id: 4,
          interpretation: '',
          isAnalyzed: false,
          analysisStatus: 'none',
          analyzedAt: undefined,
          memory: {
            origin: 'remembered',
            anchorDream: true,
            strongestFragment: 'place',
          },
        }),
      ],
      loaded: true,
    });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    expect(screen.getByTestId(TID.Component.DreamProfileCard)).toBeTruthy();
    expect(screen.queryByTestId(TID.Component.StatsInsight)).toBeNull();
    expect(screen.getByText('stats.profile.readiness.seeded.label')).toBeTruthy();
    expect(screen.getByText('stats.profile.next_action.capture_more.cta')).toBeTruthy();
    expect(screen.getByTestId(TID.Component.DreamProfilePlusPreview)).toBeTruthy();
  });

  it('[B] Given a free user When viewing Stats Then recurring profile signals are a Plus preview', () => {
    mockUseDreams.mockReturnValue({ dreams: profileDreams, loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    expect(screen.getByTestId(TID.Component.DreamProfilePlusPreview)).toBeTruthy();
    expect(screen.getByText('stats.profile.plus_preview.title')).toBeTruthy();
    expect(screen.getAllByText('stats.profile.plus_preview.locked_value')).toHaveLength(4);
    expect(screen.queryByText('dream.type.symbolic')).toBeNull();

    fireEvent.click(screen.getByTestId(TID.Button.DreamProfileUpgradeCta));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/paywall',
      params: { trigger: 'stats_profile' },
    });
  });

  it('[B] Given a Plus user When viewing Stats Then recurring profile signals are visible', () => {
    mockUseDreams.mockReturnValue({ dreams: profileDreams, loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: true, loading: false });

    render(<StatisticsScreen />);

    expect(screen.queryByTestId(TID.Component.DreamProfilePlusPreview)).toBeNull();
    expect(screen.getByText('dream.type.symbolic')).toBeTruthy();
    expect(screen.getByText('calm')).toBeTruthy();
    expect(screen.getByText('stats.profile.fragment.place')).toBeTruthy();
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;

// `filterDreamsByStatsPeriod` treats `dream.id` as a creation timestamp, so every
// period-aware fixture needs Date.now()-based ids (id: 1 is 1 January 1970 and any
// non-'all' period would empty the list).
//
// 2 recent dreams, unanalyzed, one of them remembered + 3 dreams older than 7 days,
// all analyzed.
//   all time -> 5 dreams, 3 analyzed  => readiness `living`, next action `analyze_unanalyzed`
//   7 days   -> 2 dreams, 1 seed      => readiness `seeded`, next action `capture_more`
const buildPeriodDreams = (): DreamAnalysis[] => {
  const now = Date.now();
  return [
    buildDream({
      id: now - 1 * DAY_MS,
      isAnalyzed: false,
      analysisStatus: 'none',
      interpretation: '',
      analyzedAt: undefined,
      memory: { origin: 'remembered', strongestFragment: 'place' },
    }),
    buildDream({
      id: now - 2 * DAY_MS,
      isAnalyzed: false,
      analysisStatus: 'none',
      interpretation: '',
      analyzedAt: undefined,
    }),
    buildDream({ id: now - 40 * DAY_MS }),
    buildDream({ id: now - 41 * DAY_MS }),
    buildDream({ id: now - 42 * DAY_MS }),
  ];
};

const selectPeriod = (period: 'all' | 'week' | 'month' | 'year') => {
  fireEvent.click(screen.getByTestId(TID.Button.HeaderStatsPeriod));
  fireEvent.click(screen.getByTestId(TID.Button.StatsPeriodOption(period)));
};

// Leave the tab and come back. The screen is not remounted, so whatever period the user
// selected is still applied when the next `stats_screen_viewed` fires.
const refocusScreen = () => {
  act(() => {
    mockFocusEpoch += 1;
    focusListeners.forEach((listener) => listener());
  });
};

describe('Statistics screen period filter', () => {
  it('[B] Given a 7-day period When older dreams exist Then the overview and the dream profile describe the same window', () => {
    mockUseDreams.mockReturnValue({ dreams: buildPeriodDreams(), loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    expect(screen.getByLabelText('stats.card.total_dreams: 5')).toBeTruthy();
    expect(screen.getByText('stats.profile.readiness.living.label')).toBeTruthy();
    expect(screen.getByText('stats.profile.next_action.analyze_unanalyzed.cta')).toBeTruthy();
    expect(screen.queryByTestId(TID.Button.StatsPeriodChip)).toBeNull();
    expect(screen.getByTestId(TID.Component.StatsInsight)).toBeTruthy();

    selectPeriod('week');

    // The profile follows the period (audit P1-7): if it still read the whole
    // journal it would keep saying "living / analyze the rest" over a 2-dream week.
    expect(screen.getByLabelText('stats.card.total_dreams: 2')).toBeTruthy();
    expect(screen.getByText('stats.profile.readiness.seeded.label')).toBeTruthy();
    expect(screen.getByText('stats.profile.next_action.capture_more.cta')).toBeTruthy();
    expect(screen.queryByText('stats.profile.next_action.analyze_unanalyzed.cta')).toBeNull();
    expect(screen.queryByText('stats.profile.readiness.living.label')).toBeNull();

    // ...but VISIBILITY stays journal-wide. This 7-day window holds only unanalyzed
    // dreams, so a period-scoped `hasAtLeastOneAnalysis` would drop the next-best-action
    // card exactly when "analyze your pending dreams" is the most actionable advice —
    // and, on a free account, would take the screen's only paywall entry point with it.
    expect(screen.getByTestId(TID.Component.StatsInsight)).toBeTruthy();
    expect(screen.getByTestId(TID.Component.DreamProfileCard)).toBeTruthy();
    expect(screen.getByTestId(TID.Component.DreamProfilePlusPreview)).toBeTruthy();

    // Active-period reminder in the page body (audit P1-8) and window-relative
    // cards withdrawn because they would merely restate the total (audit 22a).
    expect(screen.getByTestId(TID.Button.StatsPeriodChip)).toBeTruthy();
    expect(screen.queryByLabelText('stats.card.this_week: 2')).toBeNull();

    expect(mockTrackProductEvent).toHaveBeenCalledWith('stats_period_selected', {
      period: 'week',
      has_results: true,
    });
  });

  // 3 dreams inside the 7-day window, analyzed but never explored + 2 dreams older than
  // 7 days, unanalyzed and non-remembered.
  //   all time -> 5 dreams, 3 analyzed          => insight `analyze`, next action `analyze_unanalyzed`
  //   7 days   -> 3 dreams, 3 analyzed, 0 chats => insight `explore`, next action `explore_more`
  const buildRecentlyAnalyzedDreams = (): DreamAnalysis[] => {
    const now = Date.now();
    const unanalyzed = {
      isAnalyzed: false,
      analysisStatus: 'none' as const,
      interpretation: '',
      analyzedAt: undefined,
    };
    return [
      buildDream({ id: now - 1 * DAY_MS }),
      buildDream({ id: now - 2 * DAY_MS }),
      buildDream({ id: now - 3 * DAY_MS }),
      buildDream({ id: now - 40 * DAY_MS, ...unanalyzed }),
      buildDream({ id: now - 41 * DAY_MS, ...unanalyzed }),
    ];
  };

  it('[B] Given a 7-day period When the window is fully analyzed Then the next-best-action follows the window', () => {
    mockUseDreams.mockReturnValue({ dreams: buildRecentlyAnalyzedDreams(), loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    // Journal-wide there are still 2 dreams to analyze.
    expect(screen.getByText('stats.insight.analyze.title')).toBeTruthy();
    expect(screen.getByText('stats.profile.next_action.analyze_unanalyzed.cta')).toBeTruthy();

    selectPeriod('week');

    // Inside the window everything is analyzed, so the advice moves one rung up the
    // ladder. Reading the whole journal here would keep telling a user who has just
    // caught up to "analyze the rest".
    expect(screen.getByText('stats.insight.explore.title')).toBeTruthy();
    expect(screen.queryByText('stats.insight.analyze.title')).toBeNull();
    expect(screen.getByText('stats.profile.next_action.explore_more.cta')).toBeTruthy();
    expect(screen.queryByText('stats.profile.next_action.analyze_unanalyzed.cta')).toBeNull();

    fireEvent.click(screen.getByTestId(TID.Button.StatsInsightCta));

    expect(mockTrackProductEvent).toHaveBeenCalledWith('stats_cta_clicked', {
      cta: 'next_best_action',
      action: 'explore',
    });
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/journal');
  });

  it('[B] Given a period with no dream When statistics render Then the empty-period state replaces the stale sections', () => {
    const now = Date.now();
    mockUseDreams.mockReturnValue({
      dreams: [
        buildDream({ id: now - 40 * DAY_MS }),
        buildDream({ id: now - 41 * DAY_MS }),
        buildDream({ id: now - 42 * DAY_MS }),
      ],
      loaded: true,
    });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);
    selectPeriod('week');

    expect(screen.getByTestId(TID.Component.StatsPeriodEmpty)).toBeTruthy();
    expect(screen.getByText('stats.period.empty.title')).toBeTruthy();
    expect(screen.getByText('stats.period.empty.body')).toBeTruthy();
    expect(screen.queryByTestId(TID.Component.DreamProfileCard)).toBeNull();
    expect(screen.queryByTestId(TID.Component.StatsInsight)).toBeNull();
    // Nothing to share ("Dreams: 0") but the period control stays reachable —
    // together with the reset CTA it is the only way out of this state.
    expect(screen.queryByTestId(TID.Button.HeaderStatsShare)).toBeNull();
    expect(screen.getByTestId(TID.Button.HeaderStatsPeriod)).toBeTruthy();

    fireEvent.click(screen.getByTestId(TID.Button.StatsPeriodReset));

    expect(screen.queryByTestId(TID.Component.StatsPeriodEmpty)).toBeNull();
    expect(screen.getByLabelText('stats.card.total_dreams: 3')).toBeTruthy();
    expect(screen.getByTestId(TID.Button.HeaderStatsShare)).toBeTruthy();
  });
});

describe('Statistics screen empty and loading states', () => {
  it('[B] Given an empty journal When Stats renders Then the empty copy shows and the header actions are gone', () => {
    mockUseDreams.mockReturnValue({ dreams: [], loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    expect(screen.getByText('stats.empty.title')).toBeTruthy();
    expect(screen.getByText('stats.empty.body')).toBeTruthy();
    expect(screen.getByTestId(TID.Button.EmptyStartRememberedDream)).toBeTruthy();
    expect(screen.queryByTestId(TID.Button.HeaderStatsShare)).toBeNull();
    expect(screen.queryByTestId(TID.Button.HeaderStatsPeriod)).toBeNull();
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('[B] Given the journal has not loaded When Stats renders Then only the loading copy shows', () => {
    mockUseDreams.mockReturnValue({ dreams: [], loaded: false });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: true });

    render(<StatisticsScreen />);

    expect(screen.getByText('stats.loading')).toBeTruthy();
    expect(screen.queryByTestId(TID.Component.DreamProfileCard)).toBeNull();
    expect(screen.queryByTestId(TID.Button.HeaderStatsPeriod)).toBeNull();
  });
});

describe('Statistics screen view tracking', () => {
  it('[B] Given a signed-out visitor When Stats gains focus Then the view is reported once as a guest', () => {
    mockUseDreams.mockReturnValue({ dreams: profileDreams, loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false, status: null });

    const { rerender } = render(<StatisticsScreen />);

    // A guest never carries a RevenueCat status, so `status?.tier ?? 'free'` used to
    // file every signed-out visitor under the signed-in free cohort and left the
    // 'guest' value unreachable.
    expect(statsViewedPayloads()).toEqual([
      { tier: 'guest', dream_count_bucket: '3_9', profile_readiness: 'living' },
    ]);

    // Once per focus: re-rendering inside the same focus must not emit again.
    rerender(<StatisticsScreen />);

    expect(statsViewedPayloads()).toHaveLength(1);
  });

  it('[B] Given a signed-in account with no subscription When Stats gains focus Then the view is reported as free', () => {
    mockAuthState = { user: { id: 'user-1' }, loading: false };
    mockUseDreams.mockReturnValue({ dreams: [profileDreams[0]], loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false, status: null });

    render(<StatisticsScreen />);

    expect(statsViewedPayloads()).toEqual([
      { tier: 'free', dream_count_bucket: '1_2', profile_readiness: 'seeded' },
    ]);
  });

  it('[B] Given an unresolved entitlement When Stats gains focus Then the view waits for the real tier', () => {
    mockAuthState = { user: { id: 'user-1' }, loading: false };
    mockUseDreams.mockReturnValue({ dreams: profileDreams, loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: true, status: null });

    const { rerender } = render(<StatisticsScreen />);

    // Emitting now would stamp a Plus subscriber as 'free', and the once-per-focus
    // guard would then swallow the corrected value for the rest of the focus.
    expect(statsViewedPayloads()).toEqual([]);

    mockUseSubscription.mockReturnValue({
      isActive: true,
      loading: false,
      status: { tier: 'plus' },
    });
    rerender(<StatisticsScreen />);

    expect(statsViewedPayloads()).toEqual([
      { tier: 'plus', dream_count_bucket: '3_9', profile_readiness: 'living' },
    ]);
  });

  it('[B] Given auth has not resolved When Stats gains focus Then the view waits for the session', () => {
    mockAuthState = { user: null, loading: true };
    mockUseDreams.mockReturnValue({ dreams: profileDreams, loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false, status: null });

    const { rerender } = render(<StatisticsScreen />);

    // `user` is null while the session is being restored, which is indistinguishable
    // from a real guest until `loading` clears.
    expect(statsViewedPayloads()).toEqual([]);

    mockAuthState = { user: { id: 'user-1', app_metadata: { tier: 'plus' } }, loading: false };
    rerender(<StatisticsScreen />);

    expect(statsViewedPayloads()).toEqual([
      { tier: 'plus', dream_count_bucket: '3_9', profile_readiness: 'living' },
    ]);
  });

  it('[B] Given the journal has not loaded When Stats renders Then no view is reported', () => {
    mockUseDreams.mockReturnValue({ dreams: [], loaded: false });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false, status: null });

    render(<StatisticsScreen />);

    expect(statsViewedPayloads()).toEqual([]);
  });

  it('[B] Given a 7-day period When Stats regains focus Then the reported count and readiness stay journal-wide', () => {
    mockUseDreams.mockReturnValue({ dreams: buildPeriodDreams(), loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false, status: null });

    render(<StatisticsScreen />);

    // 5 dreams all-time, 3 analyzed.
    expect(statsViewedPayloads()).toEqual([
      { tier: 'guest', dream_count_bucket: '3_9', profile_readiness: 'living' },
    ]);

    // The window holds 2 dreams and 1 seed, so a period-scoped payload would report
    // `1_2` / `seeded` here. `dream_count_bucket` and `profile_readiness` describe the
    // journal, not the filter, or the funnel mixes two scales.
    selectPeriod('week');
    refocusScreen();

    expect(statsViewedPayloads()).toEqual([
      { tier: 'guest', dream_count_bucket: '3_9', profile_readiness: 'living' },
      { tier: 'guest', dream_count_bucket: '3_9', profile_readiness: 'living' },
    ]);
  });
});

describe('Statistics screen engagement', () => {
  const buildChat = (userMessages: number) =>
    Array.from({ length: userMessages }, (_, index) => ({
      id: `msg-${index}`,
      role: 'user' as const,
      text: 'Tell me more',
    }));

  it('[B] Given dreams with chat history When the engagement section renders Then the most discussed dream opens on press', () => {
    mockRunInteractionsImmediately = true;
    mockTranslate = mockParamTranslate;
    const now = Date.now();
    mockUseDreams.mockReturnValue({
      dreams: [
        buildDream({ id: now - 1 * DAY_MS, title: 'Quiet shore', chatHistory: buildChat(1) }),
        // Fewer messages first in insertion order, more messages here: the card must
        // rank on the message count, not on recency or position.
        buildDream({ id: now - 2 * DAY_MS, title: 'Endless staircase', chatHistory: buildChat(3) }),
      ],
      loaded: true,
    });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    const card = screen.getByTestId(TID.Button.StatsMostDiscussedDream);
    expect(card).toBeTruthy();
    expect(within(card).getByText('Endless staircase')).toBeTruthy();
    expect(within(card).getByText('stats.engagement.messages:count=3')).toBeTruthy();
    expect(card.getAttribute('aria-label')).toBe(
      'Endless staircase, stats.engagement.most_discussed.open',
    );

    fireEvent.click(card);

    expect(mockPush).toHaveBeenCalledWith(`/journal/${now - 2 * DAY_MS}`);
  });

  it('[B] Given a single chat message When the engagement section renders Then the singular string is used', () => {
    mockRunInteractionsImmediately = true;
    mockTranslate = mockParamTranslate;
    const now = Date.now();
    mockUseDreams.mockReturnValue({
      dreams: [buildDream({ id: now - 1 * DAY_MS, title: 'Quiet shore', chatHistory: buildChat(1) })],
      loaded: true,
    });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    const card = screen.getByTestId(TID.Button.StatsMostDiscussedDream);
    expect(within(card).getByText('stats.engagement.messages_one:count=1')).toBeTruthy();
    expect(within(card).queryByText('stats.engagement.messages:count=1')).toBeNull();
  });

  it('[B] Given no chat message anywhere When the engagement section renders Then the most discussed card is absent', () => {
    mockRunInteractionsImmediately = true;
    const now = Date.now();
    mockUseDreams.mockReturnValue({
      dreams: [buildDream({ id: now - 1 * DAY_MS, chatHistory: [] })],
      loaded: true,
    });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    expect(screen.getByText('stats.section.engagement')).toBeTruthy();
    expect(screen.queryByTestId(TID.Button.StatsMostDiscussedDream)).toBeNull();
  });
});

describe('Statistics screen share', () => {
  it('[B] Given a selected period When the user shares Then the message carries the period label and the filtered totals', async () => {
    mockTranslate = mockParamTranslate;
    mockUseDreams.mockReturnValue({ dreams: buildPeriodDreams(), loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);
    selectPeriod('week');

    fireEvent.click(screen.getByTestId(TID.Button.HeaderStatsShare));

    await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(1));
    const [payload] = mockShare.mock.calls[0];
    expect(payload.title).toBe('stats.share.title');
    expect(payload.message).toContain('period=stats.period.week');
    expect(payload.message).toContain('total=2');
    expect(payload.message).toContain('analyzed=0');
    await waitFor(() =>
      expect(mockTrackProductEvent).toHaveBeenCalledWith('stats_shared', {
        period: 'week',
        outcome: 'shared',
      }),
    );
  });

  it('[B] Given the share sheet rejects When the user shares Then the failure is swallowed and the screen stays mounted', async () => {
    // `__DEV__` is true under jest-expo, so the handler's dev-only log fires here.
    // Captured rather than left to pollute the run — and it doubles as proof the
    // rejection reached the catch block instead of escaping as an unhandled promise.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockShare.mockRejectedValueOnce(new Error('share dismissed'));
    mockUseDreams.mockReturnValue({ dreams: profileDreams, loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    fireEvent.click(screen.getByTestId(TID.Button.HeaderStatsShare));

    await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mockTrackProductEvent).toHaveBeenCalledWith('stats_shared', {
        period: 'all',
        outcome: 'failed',
      }),
    );
    expect(screen.getByTestId(TID.Component.DreamProfileCard)).toBeTruthy();
    expect(consoleError).toHaveBeenCalledWith(
      '[StatisticsScreen] Failed to share stats',
      expect.any(Error),
    );
    consoleError.mockRestore();
  });
});

describe('Statistics screen dream type legend', () => {
  it('[B] Given a translator When the dream type legend renders Then every label comes from the catalogue', () => {
    mockRunInteractionsImmediately = true;
    mockTranslate = mockMarkerTranslate;
    mockUseDreams.mockReturnValue({
      dreams: [
        buildDream({ id: 3, dreamType: 'Symbolic Dream' }),
        buildDream({ id: 2, dreamType: 'Symbolic Dream' }),
        buildDream({ id: 1, dreamType: 'Nightmare' }),
      ],
      loaded: true,
    });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    const legend = screen.getByTestId(TID.Component.StatsTypeLegend);
    expect(legend.textContent).toContain('[[dream.type.symbolic]]');
    expect(legend.textContent).toContain('[[dream.type.nightmare]]');
    // The raw DreamType values must never reach the UI (audit §6.2).
    expect(legend.textContent).not.toContain('Symbolic Dream');
    expect(legend.textContent).not.toContain('Nightmare');
    // Singular vs plural is selected on the raw count (audit §6.3).
    expect(legend.textContent).toContain('[[stats.legend.count]]');
    expect(legend.textContent).toContain('[[stats.legend.count_one]]');
    // Whatever is left once catalogue output is stripped must be punctuation only.
    expect((legend.textContent ?? '').replace(/\[\[[^\]]*\]\]/g, '')).toMatch(/^[\s()·%.,\d]*$/);
  });

  it('[B] Given a dream with no type When the legend renders Then the unknown bucket is translated', () => {
    mockRunInteractionsImmediately = true;
    mockTranslate = mockMarkerTranslate;
    mockUseDreams.mockReturnValue({
      dreams: [buildDream({ id: 1, dreamType: undefined as unknown as DreamAnalysis['dreamType'] })],
      loaded: true,
    });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    const legend = screen.getByTestId(TID.Component.StatsTypeLegend);
    expect(legend.textContent).toContain('[[dream.type.unknown]]');
    expect(legend.textContent).not.toContain('Unknown');
  });
});

describe('Statistics screen theme ordering', () => {
  it('[B] Given tied themes When Stats renders Then the paid theme signal matches the free ranking', () => {
    mockRunInteractionsImmediately = true;
    const now = Date.now();
    mockUseDreams.mockReturnValue({
      // Insertion order is mystical, calm, noir — all tied at 2. Before the shared
      // comparator the free section kept insertion order while the paid signal broke
      // the tie alphabetically, so the two disagreed (audit §7.2).
      dreams: [
        buildDream({ id: now - 1, theme: 'mystical' }),
        buildDream({ id: now - 2, theme: 'mystical' }),
        buildDream({ id: now - 3, theme: 'calm' }),
        buildDream({ id: now - 4, theme: 'calm' }),
        buildDream({ id: now - 5, theme: 'noir' }),
        buildDream({ id: now - 6, theme: 'noir' }),
      ],
      loaded: true,
    });
    mockUseSubscription.mockReturnValue({ isActive: true, loading: false });

    render(<StatisticsScreen />);

    const themeName = /^(calm|mystical|noir|surreal)$/;
    const paidSignal = within(screen.getByTestId(TID.Component.DreamProfileCard))
      .getAllByText(themeName)
      .map((node) => node.textContent);
    const freeRanking = within(screen.getByTestId(TID.Component.StatsTopThemes))
      .getAllByText(themeName)
      .map((node) => node.textContent);

    expect(paidSignal).toEqual(['calm']);
    expect(freeRanking).toEqual(['calm', 'mystical', 'noir']);
    expect(paidSignal[0]).toBe(freeRanking[0]);
  });
});
