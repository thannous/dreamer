/* @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

// NOT mocked: the real lexicon runs behind the emotion section, which is what makes the S2
// cases integration tests rather than restatements of their own fixture. The threshold is
// imported so the fixtures cannot drift from the module that owns it.
import { MIN_DREAMS_FOR_EMOTION_PROFILE } from '@/lib/dreamEmotions';
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

// Every props object the shared locked / not-enough components were rendered with, in
// document order. Populated by the partial mock further down.
const lockedSectionProps: Record<string, unknown>[] = [];
const notEnoughProps: Record<string, unknown>[] = [];

// Every call the screen made to `useDreamStatistics`, in order: the window it passed and the
// shape of the series it got back. `stats.dreamsOverTime` is computed but rendered nowhere,
// so this is the only place the activity series can be observed at screen level.
type StatsCall = { windowDays?: number | null; points: number; bucketDays: number };
const statsCalls: StatsCall[] = [];

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  mockTranslate = mockEchoTranslate;
  mockRunInteractionsImmediately = false;
  mockAuthState = guestAuthState();
  lockedSectionProps.length = 0;
  notEnoughProps.length = 0;
  statsCalls.length = 0;
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
      // Swallowed, not spread: the locked preview row sets both, and letting them through
      // makes React emit unknown-attribute noise on every locked-state render.
      accessibilityElementsHidden,
      importantForAccessibility,
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
      // The attributes the platform actually exposes for role="progressbar". Purely
      // additive — no existing assertion reads them — and it retroactively makes the
      // Top-Themes bar (and the ranked list extracted from it) testable for the first time.
      ...(accessibilityValue
        ? {
            'aria-valuemin': accessibilityValue.min,
            'aria-valuenow': accessibilityValue.now,
            'aria-valuemax': accessibilityValue.max,
            'aria-valuetext': accessibilityValue.text,
          }
        : {}),
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
  // Props-reflecting, NOT opaque. An opaque `<div data-testid="bar-chart"/>` repairs the
  // suite and makes every S1/S3 data assertion unfalsifiable: a chart drawing 3 bars
  // instead of 7, or dropping `frontColor`, or handed one series instead of three, renders
  // an identical div. `String(...)` is deliberate — a dropped colour prop serialises as the
  // literal 'undefined', which is exactly what the colour guards (S1-2, S3-1b) match on.
  BarChart: (props: any) => (
    <div
      data-testid="bar-chart"
      data-values={(props.data ?? []).map((d: any) => d.value).join(',')}
      data-labels={(props.data ?? []).map((d: any) => d.label).join(',')}
      data-front-colors={(props.data ?? []).map((d: any) => String(d.frontColor)).join(',')}
      data-axis-colors={[props.xAxisColor, props.yAxisColor, props.rulesColor]
        .map(String)
        .join(',')}
      data-max-value={String(props.maxValue)}
      data-sections={String(props.noOfSections)}
    />
  ),
  LineChart: (props: any) => (
    <div
      data-testid="line-chart"
      data-series={(props.dataSet ?? [])
        .map((s: any) => `${s.color}:${(s.data ?? []).map((p: any) => p.value).join('|')}`)
        .join(';')}
      data-x-labels={(props.xAxisLabelTexts ?? []).join(',')}
      data-axis-colors={[props.xAxisColor, props.yAxisColor, props.rulesColor]
        .map(String)
        .join(',')}
      data-max-value={String(props.maxValue)}
    />
  ),
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
  // S2 and S3 ship subtitles, so the mock must render them or the two `.subtitle` keys are
  // 10 dead strings the registry test certifies as healthy. Safe for every existing
  // assertion: getNodeText reads DIRECT text-node children only, so `getByText('stats.
  // section.engagement')` still matches the div exactly (that key has no subtitle).
  SectionHeading: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      {title}
      {subtitle ? <span>{subtitle}</span> : null}
    </div>
  ),
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
      accentText: '#b6a8ff',
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
    // Deterministic, local-time, and it encodes WHICH option set was requested, so a test
    // can tell a weekday label from a day/month label and can pin the exact weekday number
    // a bar was labelled with. A `'Mon'` / `() => ''` stub repairs the suite and makes the
    // `weekdayLabels[index]` vs `weekdayLabels[entry.weekday]` bug unwritable.
    formatDate: (value: Date | number, options?: Intl.DateTimeFormatOptions) => {
      const date = new Date(typeof value === 'number' ? value : value.getTime());
      return options?.weekday ? `wd${date.getDay()}` : `d${date.getDate()}m${date.getMonth() + 1}`;
    },
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

// Partial mock, NOT a stub: the real component still renders (so S2-2 / S3-5 keep full
// fidelity) and every call is recorded, which is the only way to prove ONE component has
// TWO consumers — two inlined duplicates render byte-identical DOM. Same shape as the
// '@/lib/analytics' partial mock above.
jest.doMock('@/components/stats/StatsLockedSection', () => {
  const React = require('react');
  const actual = jest.requireActual(
    '@/components/stats/StatsLockedSection',
  ) as typeof import('@/components/stats/StatsLockedSection');
  return {
    ...actual,
    StatsLockedSection: (props: any) => {
      lockedSectionProps.push(props);
      // createElement rather than a call: both exports are `memo(...)` objects.
      return React.createElement(actual.StatsLockedSection, props);
    },
    StatsNotEnoughData: (props: any) => {
      notEnoughProps.push(props);
      return React.createElement(actual.StatsNotEnoughData, props);
    },
  };
});

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

// Partial mock: the real hook still does the work, the wrapper only records the window it
// was given. A stub returning fixture statistics would make every assertion in this file
// about the screen's own arithmetic unfalsifiable.
jest.doMock('@/hooks/useDreamStatistics', () => {
  const actual = jest.requireActual(
    '@/hooks/useDreamStatistics',
  ) as typeof import('@/hooks/useDreamStatistics');
  return {
    ...actual,
    useDreamStatistics: (dreams: DreamAnalysis[], windowDays?: number | null) => {
      const stats = actual.useDreamStatistics(dreams, windowDays);
      statsCalls.push({
        windowDays,
        points: stats.dreamsOverTime.length,
        bucketDays: stats.dreamsOverTimeBucketDays,
      });
      return stats;
    },
  };
});

// `buildThemeTrend` is read off the SAME require as the screen: it is exported from
// app/(tabs)/statistics.tsx, which cannot be imported without the ~350 lines of jest.doMock
// preamble above. That is why its unit block lives at the end of this file rather than in one
// of its own.
const { default: StatisticsScreen, buildThemeTrend } = require('@/app/(tabs)/statistics') as {
  default: React.ComponentType;
  buildThemeTrend: typeof import('@/app/(tabs)/statistics').buildThemeTrend;
};

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

describe('Statistics screen activity window', () => {
  const lastCall = () => statsCalls[statsCalls.length - 1];

  it('[B] Given each period When Stats renders Then the statistics hook is handed that period as its window', () => {
    // The hook receives `periodDreams`, already filtered, which carries no trace of the
    // filter that produced it. Revert: call `useDreamStatistics(periodDreams)` with one
    // argument -> the window falls back to 30 days under every period, which is exactly the
    // series that used to contradict the "7 days" and "12 months" chips.
    mockUseDreams.mockReturnValue({ dreams: buildPeriodDreams(), loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    // 'all time' is the only period with no fixed length: null tells the hook to span the
    // journal itself. Revert: map it to 0 or to 30 -> the series stops covering the journal.
    expect(lastCall().windowDays).toBeNull();

    selectPeriod('week');
    expect(lastCall().windowDays).toBe(7);

    selectPeriod('month');
    expect(lastCall().windowDays).toBe(30);

    selectPeriod('year');
    expect(lastCall().windowDays).toBe(365);

    selectPeriod('all');
    expect(lastCall().windowDays).toBeNull();
  });

  it('[B] Given the 7-day and 12-month periods When the series is built Then it is seven daily points and then a bucketed year', () => {
    // The window argument reaching the hook is not enough on its own: this pins the series
    // the screen actually gets, one point per day under "7 days" and a bounded, bucketed
    // series under "12 months" rather than 365 points inside a nested ScrollView.
    mockUseDreams.mockReturnValue({ dreams: buildPeriodDreams(), loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    selectPeriod('week');
    expect(lastCall().points).toBe(7);
    expect(lastCall().bucketDays).toBe(1);

    selectPeriod('year');
    expect(lastCall().points).toBeLessThanOrEqual(30);
    expect(lastCall().bucketDays).toBeGreaterThan(1);
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

// Fixed calendar dates, not offsets: `filterDreamsByStatsPeriod` defaults to 'all', so
// absolute timestamps are safe here and make the weekday arithmetic readable.
const MON = new Date(2026, 0, 5, 12).getTime(); // Monday 5 January 2026
const WED = new Date(2026, 0, 7, 12).getTime();
const THU = new Date(2026, 0, 8, 12).getTime();

// 3 dreams on Monday, 1 on Wednesday, 1 on Thursday.
// => dreamsByDay, Mon -> Sun, is [3, 0, 1, 1, 0, 0, 0].
const buildRhythmDreams = (): DreamAnalysis[] => [
  buildDream({ id: MON }),
  buildDream({ id: MON + 1 }),
  buildDream({ id: MON + 2 }),
  buildDream({ id: WED }),
  buildDream({ id: THU }),
];

describe('Statistics screen rhythm section', () => {
  it('[B] Given dreams on three weekdays When the rhythm section renders Then seven bars carry the per-weekday counts in Mon-to-Sun order', () => {
    mockRunInteractionsImmediately = true;
    mockTranslate = mockParamTranslate;
    mockUseDreams.mockReturnValue({ dreams: buildRhythmDreams(), loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    const chart = screen.getByTestId('bar-chart');

    // (a) Seven bars, the real per-weekday counts.
    // Revert: slice stats.dreamsByDay, or feed the chart topDreamTypes -> fails.
    expect(chart.getAttribute('data-values')).toBe('3,0,1,1,0,0,0');

    // (b) THE ONLY TEST THAT KILLS THE INDEXING BUG. `formatDate` is stubbed to `wd<getDay()>`,
    // so the labels encode which weekday each bar was actually named after.
    // Revert: `label: weekdayLabels[index]` instead of `weekdayLabels[entry.weekday]` ->
    // 'wd0,wd1,wd2,wd3,wd4,wd5,wd6' -> fails.
    expect(chart.getAttribute('data-labels')).toBe('wd1,wd2,wd3,wd4,wd5,wd6,wd0');

    // (c) One accessible element carrying every number a sighted user reads off the bars,
    // built from the REUSED `stats.section.dreams_by_day` key and the reused
    // `stats.legend.count{,_one}` pair.
    // Reverts: mint `stats.section.rhythm` -> fails; drop the a11y wrapper -> getByTestId
    // fails; write `count <= 1 ? _one : count` -> the four zero days flip to _one -> fails.
    expect(screen.getByTestId(TID.Component.StatsRhythmChart).getAttribute('aria-label')).toBe(
      'stats.section.dreams_by_day, wd1: stats.legend.count:count=3, wd2: stats.legend.count:count=0, wd3: stats.legend.count_one:count=1, wd4: stats.legend.count_one:count=1, wd5: stats.legend.count:count=0, wd6: stats.legend.count:count=0, wd0: stats.legend.count:count=0',
    );
  });

  it('[B] Given a colour-defaulting chart library When the rhythm bars render Then no colour prop is left unset', () => {
    // gifted-charts-core defaults: BarDefaults.frontColor 'black', xAxisColor / yAxisColor
    // 'black', rulesColor 'lightgray'. This is the §6.1 defect class (the dark-mode donut
    // hole) as a test rather than a code comment.
    // Revert: delete `frontColor: noctalia.accent.base` from the barData map, or drop
    // `rulesColor` -> the prop serialises as the literal 'undefined' -> fails.
    mockRunInteractionsImmediately = true;
    mockUseDreams.mockReturnValue({ dreams: buildRhythmDreams(), loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    const chart = screen.getByTestId('bar-chart');
    expect(chart.getAttribute('data-front-colors')).not.toContain('undefined');
    expect(chart.getAttribute('data-axis-colors')).not.toContain('undefined');
  });

  it('[B] Given the sections have not been deferred yet When Stats first renders Then the rhythm section is absent', () => {
    // Revert: drop `showDeferredSections &&` from the S1 JSX gate -> the chart mounts on the
    // first frame, which is the cost the deferral exists to avoid.
    mockUseDreams.mockReturnValue({ dreams: buildRhythmDreams(), loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    expect(screen.queryByTestId(TID.Component.StatsRhythm)).toBeNull();
    expect(screen.getByTestId(TID.Component.DreamProfileCard)).toBeTruthy();
  });

  it('[B] Given a period holding no dream When Stats renders Then the rhythm section is gone with the rest', () => {
    // This is a PLACEMENT test, not a guard test: the screen early-returns to
    // StatsPeriodEmpty whenever `periodDreams` is empty, so what it pins is that the S1 JSX
    // sits below that return.
    // Revert: move the S1 block above the empty-period early return -> the bar chart
    // survives into the empty state -> fails.
    mockRunInteractionsImmediately = true;
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
    expect(screen.queryByTestId(TID.Component.StatsRhythm)).toBeNull();
    expect(screen.queryByTestId('bar-chart')).toBeNull();
  });
});

const emo = (...names: string[]) => names.map((name) => ({ name, insight: '' }));

// FOUR dreams, deliberately built so dreams (4) != dreamsWithEmotions (3) != distinctFamilies
// (2). A 3-dream / 3-family fixture could not tell the locked count apart from either.
//   fear 2 dreams, joy 1 dream.
const buildEmotionDreams = (): DreamAnalysis[] => {
  const now = Date.now();
  return [
    buildDream({ id: now - 1 * DAY_MS, emotions: emo('peur', 'terreur') }),
    buildDream({ id: now - 2 * DAY_MS, emotions: emo('peur') }),
    buildDream({ id: now - 3 * DAY_MS, emotions: emo('joie') }),
    buildDream({ id: now - 4 * DAY_MS }),
  ];
};

// `MIN_DREAMS_FOR_EMOTION_PROFILE - 1` emotion-bearing dreams plus one without: exactly one
// dream short of the threshold, derived from the module constant so it cannot drift.
const buildBelowThresholdEmotionDreams = (): DreamAnalysis[] => {
  const now = Date.now();
  return [
    ...Array.from({ length: MIN_DREAMS_FOR_EMOTION_PROFILE - 1 }, (_, index) =>
      buildDream({ id: now - (index + 1) * DAY_MS, emotions: emo('peur') }),
    ),
    buildDream({ id: now - MIN_DREAMS_FOR_EMOTION_PROFILE * DAY_MS }),
  ];
};

describe('Statistics screen emotion families', () => {
  it('[B] Given a Plus user with three dreams carrying emotions When the section renders Then the families are ranked and every label comes from the catalogue', () => {
    mockRunInteractionsImmediately = true;
    mockTranslate = mockMarkerTranslate;
    mockUseDreams.mockReturnValue({ dreams: buildEmotionDreams(), loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: true, loading: false });

    render(<StatisticsScreen />);

    const section = screen.getByTestId(TID.Component.StatsEmotions);
    expect(section.textContent).toContain('[[stats.emotion.family.fear]]');
    expect(section.textContent).toContain('[[stats.emotion.family.joy]]');
    // count 0 — never rendered.
    expect(section.textContent).not.toContain('[[stats.emotion.family.loneliness]]');

    const labels = within(section)
      .getAllByText(/^\[\[stats\.emotion\.family\./)
      .map((node) => node.textContent);
    expect(labels).toEqual(['[[stats.emotion.family.fear]]', '[[stats.emotion.family.joy]]']);

    // House marker-strip assertion, copied from the dream-type legend case above: the raw
    // family id must never reach the UI.
    // Reverts: the label helper returns the id -> the stripped remainder contains 'fear' ->
    // fails; it points at `stats.emotion.<id>` -> the getAllByText list is empty -> fails.
    expect((section.textContent ?? '').replace(/\[\[[^\]]*\]\]/g, '')).toMatch(
      /^[\s()·%.,\d]*$/,
    );

    // The section subtitle. Without this the two `.subtitle` keys are 10 translated strings
    // the registry test certifies as healthy and no UI reads.
    // Revert: drop the `subtitle` prop from the SectionHeading call.
    expect(screen.getByText('[[stats.section.emotion_families.subtitle]]')).toBeTruthy();
  });

  it('[B] Given a free user When the emotions section renders Then the locked count is the number of families and the families stay hidden', () => {
    mockRunInteractionsImmediately = true;
    mockTranslate = mockParamTranslate;
    mockUseDreams.mockReturnValue({ dreams: buildEmotionDreams(), loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    const locked = screen.getByTestId(TID.Component.StatsEmotionsLocked);
    // "Show the count, lock the detail" as an executable statement. Each revert produces a
    // different visible number: `dreams.length` -> 4; `profile.dreamsWithEmotions` -> 3.
    expect(within(locked).getByText('stats.emotions.locked.count:count=2')).toBeTruthy();
    expect(within(locked).queryByText(/count=[^2]/)).toBeNull();
    expect(within(locked).getByText('stats.emotions.locked.body')).toBeTruthy();
    // The SHARED CTA key, not a per-section one.
    expect(within(locked).getByText('stats.locked.cta')).toBeTruthy();
    // No family label leaks behind the lock.
    expect(screen.queryByText('stats.emotion.family.fear')).toBeNull();
    expect(screen.queryByTestId(TID.Component.StatsEmotions)).toBeNull();
  });

  it('[B] Given two dreams carrying emotions When the section renders Then the not-enough state names the single remaining dream', () => {
    mockRunInteractionsImmediately = true;
    mockTranslate = mockParamTranslate;
    mockUseDreams.mockReturnValue({ dreams: buildBelowThresholdEmotionDreams(), loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    // Scoped: S3 renders its own not-enough card on this fixture and shares the title key,
    // which is the point of SH-3 below.
    const notEnough = screen.getByTestId(TID.Component.StatsEmotionsNotEnough);
    expect(within(notEnough).getByText('stats.not_enough.title')).toBeTruthy();
    // Reverts: compute the shortfall from `dreams.length` -> count=0 -> fails; drop the
    // `_one` selection -> the plural key fires -> fails; reintroduce a per-section
    // `stats.emotions.not_enough.title` -> the shared-title assertion fails.
    expect(within(notEnough).getByText('stats.emotions.not_enough.body_one:count=1')).toBeTruthy();
    expect(screen.queryByTestId(TID.Component.StatsEmotionsLocked)).toBeNull();
  });

  it('[B] Given one dream carrying emotions When the section renders Then the plural shortfall is used', () => {
    // The mirror of the case above: this is what kills a `count <= 1` selector.
    mockRunInteractionsImmediately = true;
    mockTranslate = mockParamTranslate;
    const now = Date.now();
    mockUseDreams.mockReturnValue({
      dreams: [
        buildDream({ id: now - 1 * DAY_MS, emotions: emo('peur') }),
        buildDream({ id: now - 2 * DAY_MS }),
      ],
      loaded: true,
    });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    const notEnough = screen.getByTestId(TID.Component.StatsEmotionsNotEnough);
    expect(within(notEnough).getByText('stats.emotions.not_enough.body:count=2')).toBeTruthy();
  });

  it('[B] Given a Plus user below the threshold When the section renders Then the tier does not unlock the list', () => {
    // Branch-order bugs are invisible to every free-user test.
    // Revert: order the branches tier-first (`if (isPlusActive) return <list/>` before the
    // threshold check) -> a Plus user with two dreams sees a one-item "ranked list" -> fails.
    mockRunInteractionsImmediately = true;
    mockTranslate = mockParamTranslate;
    mockUseDreams.mockReturnValue({ dreams: buildBelowThresholdEmotionDreams(), loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: true, loading: false });

    render(<StatisticsScreen />);

    const notEnough = screen.getByTestId(TID.Component.StatsEmotionsNotEnough);
    expect(within(notEnough).getByText('stats.not_enough.title')).toBeTruthy();
    expect(screen.queryByTestId(TID.Component.StatsEmotions)).toBeNull();
    expect(screen.queryByText('stats.emotion.family.fear')).toBeNull();
  });

  it('[B] Given a free user When the locked emotions CTA is pressed Then the stats_profile paywall opens through the existing event', () => {
    mockRunInteractionsImmediately = true;
    mockUseDreams.mockReturnValue({ dreams: buildEmotionDreams(), loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    fireEvent.click(screen.getByTestId(TID.Button.StatsEmotionsUpgradeCta));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/paywall',
      params: { trigger: 'stats_profile' },
    });
    // DELIBERATE SECOND FUNCTION: this assertion goes RED the moment anyone introduces
    // `cta: 'emotion_families'` client-side. That value cannot ship until the server-side
    // allow-list in supabase/functions/api/routes/analytics.ts is widened; shipping the
    // client half early produces a silently-rejected, silently-purged event. The test is
    // the enforcement of that sequencing.
    expect(mockTrackProductEvent).toHaveBeenCalledWith('stats_cta_clicked', {
      cta: 'plus_upgrade',
      action: 'unlock_signals',
    });
  });

  it('[B] Given a journal with no emotion data at all When Stats renders Then the emotions section is absent', () => {
    // Revert: drop the `emotionProfile.dreamsWithEmotions > 0` gate -> a user with 200
    // pre-feature dreams is told to "record 3 more dreams" -> fails. S3 has the same rule
    // (`series.length > 0`); the two Plus sections must behave alike in the empty case.
    mockRunInteractionsImmediately = true;
    mockUseDreams.mockReturnValue({ dreams: profileDreams, loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    expect(screen.queryByTestId(TID.Component.StatsEmotions)).toBeNull();
    expect(screen.queryByTestId(TID.Component.StatsEmotionsNotEnough)).toBeNull();
    expect(screen.queryByTestId(TID.Component.StatsEmotionsLocked)).toBeNull();
  });

  it('[B] Given the ranked list When it renders Then each row exposes the Top-Themes progressbar shape', () => {
    // Contract line 40 ("reuse the existing Top themes visual, do not invent one") made
    // checkable. Revert: style a fresh row instead of rendering components/stats/
    // StatsRankedList, dropping the accessibilityRole/accessibilityValue -> zero
    // progressbars -> fails.
    mockRunInteractionsImmediately = true;
    mockTranslate = mockMarkerTranslate;
    mockUseDreams.mockReturnValue({ dreams: buildEmotionDreams(), loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: true, loading: false });

    render(<StatisticsScreen />);

    const bars = within(screen.getByTestId(TID.Component.StatsEmotions)).getAllByRole(
      'progressbar',
    );
    expect(bars).toHaveLength(2);
    expect(bars.map((bar) => bar.getAttribute('aria-label'))).toEqual([
      '[[stats.emotion.family.fear]]',
      '[[stats.emotion.family.joy]]',
    ]);
    expect(bars.map((bar) => bar.getAttribute('aria-valuenow'))).toEqual(['2', '1']);

    // The extraction guard: Top Themes must still render the same progressbar shape after
    // being rewired onto the shared component.
    expect(
      within(screen.getByTestId(TID.Component.StatsTopThemes)).getAllByRole('progressbar').length,
    ).toBeGreaterThan(0);
  });

  it('[B] Given three families tied at one dream When the list renders Then the shared comparator breaks the tie', () => {
    // Revert: swap the module's sort for a count-only sort -> V8's stable sort keeps Map
    // insertion order and joy comes first -> fails.
    mockRunInteractionsImmediately = true;
    mockTranslate = mockMarkerTranslate;
    const now = Date.now();
    mockUseDreams.mockReturnValue({
      dreams: [
        buildDream({ id: now - 1 * DAY_MS, emotions: emo('joie') }),
        buildDream({ id: now - 2 * DAY_MS, emotions: emo('peur') }),
        buildDream({ id: now - 3 * DAY_MS, emotions: emo('solitude') }),
      ],
      loaded: true,
    });
    mockUseSubscription.mockReturnValue({ isActive: true, loading: false });

    render(<StatisticsScreen />);

    const labels = within(screen.getByTestId(TID.Component.StatsEmotions))
      .getAllByText(/^\[\[stats\.emotion\.family\./)
      .map((node) => node.textContent);
    expect(labels).toEqual([
      '[[stats.emotion.family.fear]]',
      '[[stats.emotion.family.joy]]',
      '[[stats.emotion.family.loneliness]]',
    ]);
  });

  it('[B] Given a selected period When the emotions section renders Then the profile describes the window', () => {
    // Revert: feed the memo `dreams` instead of `periodDreams` -> the count stays 3 after
    // the filter -> fails. This is the audit P1-7 defect the Dream Profile already had to be
    // fixed for; S2 must not reintroduce it.
    mockRunInteractionsImmediately = true;
    mockTranslate = mockParamTranslate;
    const now = Date.now();
    mockUseDreams.mockReturnValue({
      dreams: [
        buildDream({ id: now - 1 * DAY_MS, emotions: emo('peur') }),
        buildDream({ id: now - 1 * DAY_MS - 1000, emotions: emo('peur') }),
        buildDream({ id: now - 2 * DAY_MS, emotions: emo('peur') }),
        buildDream({ id: now - 40 * DAY_MS, emotions: emo('peur', 'joie', 'solitude') }),
        buildDream({ id: now - 41 * DAY_MS, emotions: emo('peur', 'joie', 'solitude') }),
        buildDream({ id: now - 42 * DAY_MS, emotions: emo('peur', 'joie', 'solitude') }),
      ],
      loaded: true,
    });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    expect(
      within(screen.getByTestId(TID.Component.StatsEmotionsLocked)).getByText(
        'stats.emotions.locked.count:count=3',
      ),
    ).toBeTruthy();

    selectPeriod('week');

    expect(
      within(screen.getByTestId(TID.Component.StatsEmotionsLocked)).getByText(
        'stats.emotions.locked.count_one:count=1',
      ),
    ).toBeTruthy();
  });
});

// 6 dreams: calm 3, noir 2, mystical 1. Observed span = 20 days (now-20d .. now-1d), while
// the 'all' window is 21 days. The two numbers differ ON PURPOSE — see S3-5.
const buildTimelineDreams = (): DreamAnalysis[] => {
  const now = Date.now();
  return [
    buildDream({ id: now - 20 * DAY_MS, theme: 'calm' }),
    buildDream({ id: now - 18 * DAY_MS, theme: 'calm' }),
    buildDream({ id: now - 10 * DAY_MS, theme: 'noir' }),
    buildDream({ id: now - 5 * DAY_MS, theme: 'noir' }),
    buildDream({ id: now - 2 * DAY_MS, theme: 'calm' }),
    buildDream({ id: now - 1 * DAY_MS, theme: 'mystical' }),
  ];
};

describe('Statistics screen theme timeline', () => {
  it('[B] Given a Plus user with six themed dreams over twenty days When the timeline renders Then one series per theme is drawn in the theme colour', () => {
    mockRunInteractionsImmediately = true;
    mockTranslate = mockMarkerTranslate;
    mockUseDreams.mockReturnValue({ dreams: buildTimelineDreams(), loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: true, loading: false });

    render(<StatisticsScreen />);

    const chart = screen.getByTestId('line-chart');

    // (a) Three things at once: one series per present theme, the colour comes from
    // colors.tags rather than the library's black/blue/red defaults, and the series are
    // ranked calm(3) > noir(2) > mystical(1). Exact hexes from the ThemeContext mock.
    // Reverts: drop `color` from the DataSet map -> 'undefined' -> fails; use accent for
    // every series -> three identical hexes -> fails.
    expect(chart.getAttribute('data-series')?.split(';').map((s) => s.split(':')[0])).toEqual([
      '#8bd3c7',
      '#77819a',
      '#b6a8ff',
    ]);

    // (b) Same colour guard as S1-2. LineDefaults.endFillColor is literally 'white' but is
    // inert while areaChart stays off; enabling areaChart means extending this attribute.
    expect(chart.getAttribute('data-axis-colors')).not.toContain('undefined');

    // (c) THE TEST THAT PINS THE LABEL SOURCE. The legend reads `dream.theme.*` ("Calme"),
    // not the glossed `stats.theme.*` ("Calme (doux, rassurant)") that Top Themes uses.
    // Reverts: reintroduce a local getStatsThemeLabel -> the not.toContain fails; render the
    // raw enum -> the strip regex leaves 'calm' -> fails.
    const legend = screen.getByTestId(TID.Component.StatsThemeTrendLegend);
    expect(legend.textContent).toContain('[[dream.theme.calm]]');
    expect(legend.textContent).not.toContain('[[stats.theme.calm]]');
    expect((legend.textContent ?? '').replace(/\[\[[^\]]*\]\]/g, '')).toMatch(/^[\s()·%.,\d]*$/);

    // Revert: drop the `subtitle` prop from S3's SectionHeading call.
    expect(screen.getByText('[[stats.section.theme_timeline.subtitle]]')).toBeTruthy();

    // (d) The chart's text alternative. Without this, deleting `accessibilityLabel` and
    // `testID` from the wrapper left typecheck, lint and all 1788 tests green — the chart
    // became invisible to a screen reader with nothing to catch it.
    // Reverts: drop the testID -> getByTestId throws; drop accessibilityLabel -> null;
    // build the label from raw enums -> the `dream.theme.*` marker is missing;
    // drop the a11y_range interpolation -> the range marker is missing.
    const chartFrame = screen.getByTestId(TID.Component.StatsThemeTrendChart);
    const chartLabel = chartFrame.getAttribute('aria-label') ?? '';
    expect(chartLabel).toContain('[[stats.section.theme_timeline]]');
    expect(chartLabel).toContain('[[dream.theme.calm]]');
    expect(chartLabel).toContain('[[stats.theme_timeline.a11y_range]]');
  });

  it('[B] Given exactly fourteen days of span and exactly five analysed dreams When the timeline renders Then the chart is drawn', () => {
    // Both boundaries on the wire in one fixture. Revert: `>` instead of `>=` on either
    // threshold -> the not-enough card appears -> fails.
    mockRunInteractionsImmediately = true;
    const now = Date.now();
    mockUseDreams.mockReturnValue({
      dreams: [
        buildDream({ id: now - 13 * DAY_MS }),
        buildDream({ id: now - 10 * DAY_MS }),
        buildDream({ id: now - 7 * DAY_MS }),
        buildDream({ id: now - 3 * DAY_MS }),
        buildDream({ id: now }),
      ],
      loaded: true,
    });
    mockUseSubscription.mockReturnValue({ isActive: true, loading: false });

    render(<StatisticsScreen />);

    expect(screen.getByTestId('line-chart')).toBeTruthy();
    expect(screen.queryByTestId(TID.Component.StatsThemeTrendNotEnough)).toBeNull();
  });

  it('[B] Given thirteen days of span and five analysed dreams When the timeline renders Then the not-enough state asks for one more day', () => {
    // The singular day shortfall IS reachable — this fixture reaches it.
    // Reverts: use a `{days}` parameter with no singular form -> key/param mismatch ->
    // fails; use the requested window length instead of the observed span -> the shortfall
    // goes to zero or negative -> fails.
    mockRunInteractionsImmediately = true;
    mockTranslate = mockParamTranslate;
    const now = Date.now();
    mockUseDreams.mockReturnValue({
      dreams: [
        buildDream({ id: now - 12 * DAY_MS }),
        buildDream({ id: now - 9 * DAY_MS }),
        buildDream({ id: now - 6 * DAY_MS }),
        buildDream({ id: now - 3 * DAY_MS }),
        buildDream({ id: now }),
      ],
      loaded: true,
    });
    mockUseSubscription.mockReturnValue({ isActive: true, loading: false });

    render(<StatisticsScreen />);

    const notEnough = screen.getByTestId(TID.Component.StatsThemeTrendNotEnough);
    expect(
      within(notEnough).getByText('stats.theme_timeline.not_enough.days_one:count=1'),
    ).toBeTruthy();
  });

  it('[B] Given four analysed dreams spread over thirty days When the timeline renders Then the dream shortfall is named, not the span', () => {
    // Revert: check the span branch first -> the span shortfall is 14 - 31 = -17 and a
    // negative count is rendered -> fails. Nothing else pins the branch order.
    mockRunInteractionsImmediately = true;
    mockTranslate = mockParamTranslate;
    const now = Date.now();
    mockUseDreams.mockReturnValue({
      dreams: [
        buildDream({ id: now - 30 * DAY_MS }),
        buildDream({ id: now - 20 * DAY_MS }),
        buildDream({ id: now - 10 * DAY_MS }),
        buildDream({ id: now }),
      ],
      loaded: true,
    });
    mockUseSubscription.mockReturnValue({ isActive: true, loading: false });

    render(<StatisticsScreen />);

    const notEnough = screen.getByTestId(TID.Component.StatsThemeTrendNotEnough);
    expect(
      within(notEnough).getByText('stats.theme_timeline.not_enough.dreams_one:count=1'),
    ).toBeTruthy();
    expect(within(notEnough).queryByText(/not_enough\.days/)).toBeNull();
  });

  it('[B] Given a free user above the threshold When the timeline renders Then the locked count reports the real themes and the observed span', () => {
    mockRunInteractionsImmediately = true;
    mockTranslate = mockParamTranslate;
    mockUseDreams.mockReturnValue({ dreams: buildTimelineDreams(), loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    const locked = screen.getByTestId(TID.Component.StatsThemeTrendLocked);
    // Each revert a different visible number: pass `trend.analyzedDreams` (6) as the count ->
    // fails; pass the 21-day window instead of the observed 20-day span -> fails, and THAT
    // is the observed-span-vs-requested-window rule as an executable assertion.
    expect(
      within(locked).getByText('stats.theme_timeline.locked.count:count=3|days=20'),
    ).toBeTruthy();
    expect(within(locked).getByText('stats.locked.cta')).toBeTruthy();
    expect(screen.queryByTestId('line-chart')).toBeNull();
    expect(screen.queryByTestId(TID.Component.StatsThemeTrendLegend)).toBeNull();
  });

  it('[B] Given a free user with a single theme When the timeline renders Then the singular locked count is used', () => {
    // Revert: drop the `_one` selection -> the plural key fires -> fails.
    mockRunInteractionsImmediately = true;
    mockTranslate = mockParamTranslate;
    mockUseDreams.mockReturnValue({
      dreams: buildTimelineDreams().map((dream) => ({ ...dream, theme: 'calm' as const })),
      loaded: true,
    });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    expect(
      within(screen.getByTestId(TID.Component.StatsThemeTrendLocked)).getByText(
        'stats.theme_timeline.locked.count_one:count=1|days=20',
      ),
    ).toBeTruthy();
  });

  it('[B] Given a free user When the locked timeline CTA is pressed Then the stats_profile paywall opens through the existing event', () => {
    // Tested separately from S2-5 on purpose: a copy-paste wiring both CTAs to the same
    // testID would otherwise go unnoticed.
    mockRunInteractionsImmediately = true;
    mockUseDreams.mockReturnValue({ dreams: buildTimelineDreams(), loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    fireEvent.click(screen.getByTestId(TID.Button.StatsThemeTrendUpgradeCta));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/paywall',
      params: { trigger: 'stats_profile' },
    });
    expect(mockTrackProductEvent).toHaveBeenCalledWith('stats_cta_clicked', {
      cta: 'plus_upgrade',
      action: 'unlock_signals',
    });
  });

  it('[B] Given no themed analysed dream When Stats renders Then the timeline section is absent entirely', () => {
    // Revert: drop `themeTrend.series.length > 0` from the JSX gate -> a brand-new user gets
    // a "come back later" card -> fails.
    mockRunInteractionsImmediately = true;
    const now = Date.now();
    mockUseDreams.mockReturnValue({
      dreams: [
        buildDream({
          id: now - 1 * DAY_MS,
          theme: undefined as unknown as DreamAnalysis['theme'],
        }),
        buildDream({
          id: now - 2 * DAY_MS,
          theme: undefined as unknown as DreamAnalysis['theme'],
        }),
        buildDream({
          id: now - 3 * DAY_MS,
          isAnalyzed: false,
          analysisStatus: 'none',
          interpretation: '',
          analyzedAt: undefined,
        }),
      ],
      loaded: true,
    });
    mockUseSubscription.mockReturnValue({ isActive: true, loading: false });

    render(<StatisticsScreen />);

    expect(screen.queryByTestId(TID.Component.StatsThemeTrend)).toBeNull();
    expect(screen.queryByTestId('line-chart')).toBeNull();
  });
});

describe('Statistics screen shared locked sections', () => {
  // buildTimelineDreams plus emotions on four of the six dreams, so S2 clears its 3-dream
  // threshold AND S3 clears 14 days / 5 dreams in the SAME render. Exactly two emotion
  // families (fear 2, joy 2) and three themes, which is what SH-4 counts.
  const buildBothLockedDreams = (): DreamAnalysis[] => {
    const emotionsByIndex = [emo('peur'), emo('joie'), emo('peur'), emo('joie')];
    return buildTimelineDreams().map((dream, index) =>
      index < emotionsByIndex.length ? { ...dream, emotions: emotionsByIndex[index] } : dream,
    );
  };

  const renderBothLocked = () => {
    mockRunInteractionsImmediately = true;
    mockTranslate = mockParamTranslate;
    mockUseDreams.mockReturnValue({ dreams: buildBothLockedDreams(), loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });
    render(<StatisticsScreen />);
  };

  it('[B] Given a free user above both thresholds When Stats renders Then both locked sections come from the one shared component', () => {
    // THE REVERT THIS TEST EXISTS FOR: inline a duplicate locked card into either section
    // instead of importing components/stats/StatsLockedSection -> only one recorded call ->
    // the toEqual on a 2-element array fails and names which consumer went missing. No DOM
    // assertion can catch this; two inlined duplicates render identical markup.
    // The array ORDER also pins the mandated document order (Top themes -> S2 -> S3).
    renderBothLocked();

    expect(lockedSectionProps.map((props) => props.testID)).toEqual([
      TID.Component.StatsEmotionsLocked,
      TID.Component.StatsThemeTrendLocked,
    ]);
    expect(lockedSectionProps.map((props) => props.ctaTestID)).toEqual([
      TID.Button.StatsEmotionsUpgradeCta,
      TID.Button.StatsThemeTrendUpgradeCta,
    ]);
    // Kills a copy-paste that passes S2's count into S3.
    expect(new Set(lockedSectionProps.map((props) => props.countLabel)).size).toBe(2);
  });

  it('[B] Given both locked sections When they render Then they share one CTA label key', () => {
    // Revert: reintroduce a per-section `stats.theme_timeline.locked.cta` -> the two labels
    // differ -> fails. This is what stops `stats.locked.cta` becoming a dead string.
    renderBothLocked();

    expect(lockedSectionProps.map((props) => props.ctaLabel)).toEqual([
      'stats.locked.cta',
      'stats.locked.cta',
    ]);
  });

  it('[B] Given both sections below their thresholds When Stats renders Then both use the shared not-enough title', () => {
    // One render is enough: two analysed themed dreams, ONE of them carrying emotions, clears
    // both "render nothing at all" guards (dreamsWithEmotions > 0, series.length > 0) while
    // failing both thresholds (1 < 3 dreams with emotions; 2 < 5 analysed dreams).
    // Revert: reintroduce a per-section not-enough title -> the titles differ -> fails.
    mockRunInteractionsImmediately = true;
    mockTranslate = mockParamTranslate;
    const now = Date.now();
    mockUseDreams.mockReturnValue({
      dreams: [
        buildDream({ id: now - 1 * DAY_MS, theme: 'calm', emotions: emo('peur') }),
        buildDream({ id: now - 2 * DAY_MS, theme: 'calm' }),
      ],
      loaded: true,
    });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    expect(notEnoughProps.map((props) => props.title)).toEqual([
      'stats.not_enough.title',
      'stats.not_enough.title',
    ]);
    // ...but each names its own shortfall.
    expect(new Set(notEnoughProps.map((props) => props.body)).size).toBe(2);
  });

  it('[B] Given the locked preview bars When they render Then they carry no real proportion', () => {
    // "The count is honest, the shape is not the answer" as an assertion.
    // Revert: pass real proportions (fear 2/4, joy 2/4; calm 3/6, noir 2/6, mystical 1/6) ->
    // fails. Rounded before comparing because 1 - 1 * 0.18 is 0.8200000000000001 in binary
    // floating point; the revert it exists for moves the values far more than 1e-16.
    renderBothLocked();

    expect(
      lockedSectionProps.map((props) =>
        (props.previewRows as { ratio: number }[]).map((row) => Number(row.ratio.toFixed(2))),
      ),
    ).toEqual([
      [1, 0.82],
      [1, 0.82, 0.64],
    ]);
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

// `now` is fixed and passed explicitly so the day arithmetic cannot straddle midnight mid-run.
// DST IS NOT TESTED, and that is a stated gap rather than one papered over: `dayDiff` uses
// Math.round specifically to survive 23- and 25-hour days, and exercising it requires pinning
// TZ for the whole run. The minimal form, if it is ever wanted, is one case under
// TZ=Europe/Paris across the last Sunday in March.
const TREND_NOW = new Date(2026, 5, 15, 12).getTime();

const themed = (offsetDays: number, theme: DreamAnalysis['theme']) =>
  buildDream({ id: TREND_NOW - offsetDays * DAY_MS, theme });

describe('buildThemeTrend', () => {
  it('[B] Given a year of dreams When the trend is built Then the points are bucketed to at most thirty', () => {
    // 30 is a POINT BUDGET with bucket width ceil(windowDays / 30), not a fixed 30-day window.
    // Revert: pin bucketDays to 1 -> 365 points inside a nested ScrollView -> fails.
    const dreams = Array.from({ length: 400 }, (_, index) => themed(index, 'calm'));

    const trend = buildThemeTrend(dreams, 'year', TREND_NOW);

    expect(trend.points.length).toBeLessThanOrEqual(30);
    expect(trend.bucketDays).toBe(Math.ceil(365 / 30));
    expect(trend.points.length).toBe(Math.ceil(365 / Math.ceil(365 / 30)));
  });

  it('[B] Given a seven-day period When the trend is built Then every day is its own point', () => {
    // Revert: ceil the wrong way round (MAX_POINTS / windowDays) -> fails.
    const dreams = Array.from({ length: 7 }, (_, index) => themed(index, 'calm'));

    const trend = buildThemeTrend(dreams, 'week', TREND_NOW);

    expect(trend.bucketDays).toBe(1);
    expect(trend.points).toHaveLength(7);
  });

  it('[B] Given a bounded period shorter than the span minimum When the trend is built Then the ceiling is the period, not the journal', () => {
    // The 7-day period caps spanDays at 7 while THEME_TREND_MIN_SPAN_DAYS is 14, so an
    // uncapped threshold made S3 permanently unsatisfiable under that filter — it told the
    // user to keep going for more days no matter how full their journal was.
    // Revert: `maxSpanDays: null` for every period -> the week case reverts to 14 -> fails.
    expect(buildThemeTrend([themed(0, 'calm')], 'week', TREND_NOW).maxSpanDays).toBe(7);
    expect(buildThemeTrend([themed(0, 'calm')], 'month', TREND_NOW).maxSpanDays).toBe(30);
    // 'all' stays unbounded: its window is derived from the journal itself, so capping the
    // threshold to it would dissolve the 14-day minimum instead of protecting it.
    expect(buildThemeTrend([themed(0, 'calm')], 'all', TREND_NOW).maxSpanDays).toBeNull();
  });

  it('[B] Given tied theme totals When the trend is built Then the shared comparator breaks the tie', () => {
    // Insertion order mystical, mystical, calm, calm — both totals 2. Same defect class as
    // the audit §7.2 fix; this is its S3 instance.
    // Revert: `.sort((a, b) => b.total - a.total)` -> V8's stable sort keeps Map insertion
    // order -> ['mystical', 'calm'] -> fails.
    const trend = buildThemeTrend(
      [themed(0, 'mystical'), themed(1, 'mystical'), themed(2, 'calm'), themed(3, 'calm')],
      'week',
      TREND_NOW,
    );

    expect(trend.series.map((series) => series.theme)).toEqual(['calm', 'mystical']);
  });

  it('[B] Given dreams outside the window When the trend is built Then they are excluded from every count', () => {
    // Revert: drop the `offset < 0 || offset >= windowDays` filter -> 5 -> fails.
    const trend = buildThemeTrend(
      [
        themed(0, 'calm'),
        themed(1, 'calm'),
        themed(40, 'noir'),
        themed(41, 'noir'),
        themed(42, 'noir'),
      ],
      'week',
      TREND_NOW,
    );

    expect(trend.analyzedDreams).toBe(2);
    expect(trend.series.reduce((total, series) => total + series.total, 0)).toBe(2);
  });

  it('[B] Given unanalysed and untyped dreams When the trend is built Then only analysed themed dreams count', () => {
    // Revert: drop `isDreamAnalyzed(dream)` from the filter -> the >= 5 threshold is cleared
    // by unanalysed dreams and the S3 gate opens early -> fails.
    const trend = buildThemeTrend(
      [
        themed(0, 'calm'),
        themed(1, 'calm'),
        buildDream({
          id: TREND_NOW - 2 * DAY_MS,
          theme: 'noir',
          isAnalyzed: false,
          analysisStatus: 'none',
          interpretation: '',
          analyzedAt: undefined,
        }),
        themed(3, undefined as unknown as DreamAnalysis['theme']),
      ],
      'week',
      TREND_NOW,
    );

    expect(trend.analyzedDreams).toBe(2);
    expect(trend.series.map((series) => series.theme)).toEqual(['calm']);
  });

  it('[B] Given dreams inside a wide window When the trend is built Then spanDays is the observed span, not the window', () => {
    // Revert: `spanDays = windowDays` -> 365 -> fails, and with it the whole "selecting 12
    // months must not instantly satisfy a 14-day requirement" rule. The unit-level
    // complement of the locked-count assertion in the S3 block.
    const dreams = Array.from({ length: 5 }, (_, index) => themed(index, 'calm'));

    const trend = buildThemeTrend(dreams, 'year', TREND_NOW);

    expect(trend.spanDays).toBeLessThanOrEqual(7);
  });

  it('[B] Given no themed dream When the trend is built Then the empty trend is returned', () => {
    // Asserted literally rather than against the module's EMPTY_THEME_TREND, which stays
    // private. This is the object S3's JSX guard reads.
    // Revert: return a partially-built object -> fails.
    expect(buildThemeTrend([], 'all', TREND_NOW)).toEqual({
      points: [],
      series: [],
      spanDays: 0,
      analyzedDreams: 0,
      bucketDays: 1,
      maxCount: 0,
      // 0, not null: the required span is Math.max(1, maxSpanDays), so an empty trend can
      // never clear its own threshold — null would mean "unbounded" and restore the full 14.
      maxSpanDays: 0,
    });
  });

  it('[B] Given multiple dreams in one bucket When the trend is built Then maxCount is the highest single bucket', () => {
    // Revert: compute maxCount from series totals rather than per-bucket values -> a series
    // with 3 spread over 3 days would report 3 instead of 1 and the y axis would be wrong.
    const sameDay = [
      buildDream({ id: TREND_NOW, theme: 'calm' }),
      buildDream({ id: TREND_NOW - 1000, theme: 'calm' }),
      buildDream({ id: TREND_NOW - 2000, theme: 'calm' }),
    ];

    expect(buildThemeTrend(sameDay, 'week', TREND_NOW).maxCount).toBe(3);
  });
});
