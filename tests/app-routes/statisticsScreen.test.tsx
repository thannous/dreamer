/* @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { TID } from '@/lib/testIDs';
import type { DreamAnalysis, DreamTheme } from '@/lib/types';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
const mockSealProps = jest.fn();
const mockFiguresProps = jest.fn();
const mockUseDreams = jest.fn();
const mockWindow = { width: 390, height: 844, scale: 1, fontScale: 1 };
let mockBottomInset = 0;
let mockInSideColumn = false;
let mockPlatformOS: 'web' | 'ios' = 'web';
let mockUser: { id: string } | null = null;
let mockQuota: { tier: string; usage?: unknown; loading: boolean; error: Error | null } = { tier: 'guest', loading: false, error: null };
jest.mock('@/components/ui/NightSkyBand', () => ({ NightSkyBand: () => null }));
// This DOM fixture models the web scroll view; jest-expo otherwise selects .native.
jest.mock('@/components/trends/useTrendsReveal', () => jest.requireActual('@/components/trends/useTrendsReveal.ts'));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: mockBottomInset, left: 0, right: 0 }),
}));
jest.mock('@/context/SideColumnTabBarContext', () => ({ useTabBarInSideColumn: () => mockInSideColumn }));

const NOW = new Date(2026, 7, 29, 18, 0, 0).getTime();
const localDay = (year: number, monthIndex: number, day: number, hour = 9): number =>
  new Date(year, monthIndex, day, hour, 0, 0).getTime();

jest.useFakeTimers();
jest.setSystemTime(NOW);

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  jest.setSystemTime(NOW);
  mockWindow.width = 390;
  mockWindow.height = 844;
  mockWindow.fontScale = 1;
  mockBottomInset = 0;
  mockInSideColumn = false;
  mockPlatformOS = 'web';
  mockUser = null;
  mockQuota = { tier: 'guest', loading: false, error: null };
});

const analyzed = (
  id: number,
  overrides: Partial<DreamAnalysis> = {},
): DreamAnalysis => ({
  id,
  transcript: 'I walked through a quiet hallway.',
  title: 'Quiet hallway',
  interpretation: 'A complete reading.',
  shareableQuote: '',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  isAnalyzed: true,
  analysisStatus: 'done',
  analyzedAt: id,
  ...overrides,
});

jest.mock('expo-router', () => ({
  router: { push: mockPush, navigate: mockNavigate },
}));

jest.mock('react-native', () => {
  const React = require('react');
  const toDomProps = (props: Record<string, any>) => {
    const {
      testID,
      onPress,
      accessible,
      accessibilityRole,
      accessibilityLabel,
      accessibilityLiveRegion,
      accessibilityValue,
      accessibilityElementsHidden,
      importantForAccessibility,
      contentContainerStyle,
      contentInsetAdjustmentBehavior,
      showsVerticalScrollIndicator,
      className,
      style,
      numberOfLines,
      allowFontScaling,
      onLayout: _onLayout,
      ...rest
    } = props;
    return {
      ...rest,
      ...(className ? { className } : {}),
      ...(style ? { 'data-style': JSON.stringify(style) } : {}),
      ...(contentContainerStyle ? { 'data-content-container-style': JSON.stringify(contentContainerStyle) } : {}),
      ...(numberOfLines != null ? { 'data-number-of-lines': String(numberOfLines) } : {}),
      ...(allowFontScaling === false ? { 'data-allow-font-scaling': 'false' } : {}),
      ...(testID ? { 'data-testid': testID } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}),
      ...(accessibilityLiveRegion ? { 'aria-live': accessibilityLiveRegion } : {}),
      ...(accessible === true ? { 'data-accessible': 'true' } : {}),
      ...(accessible === false ? { 'data-accessible': 'false' } : {}),
      ...(accessibilityElementsHidden ? { 'aria-hidden': 'true' } : {}),
      ...(importantForAccessibility ? { 'data-important-for-accessibility': importantForAccessibility } : {}),
      ...(accessibilityValue?.min !== undefined ? { 'aria-valuemin': String(accessibilityValue.min) } : {}),
      ...(accessibilityValue?.max !== undefined ? { 'aria-valuemax': String(accessibilityValue.max) } : {}),
      ...(accessibilityValue?.now !== undefined ? { 'aria-valuenow': String(accessibilityValue.now) } : {}),
      ...(accessibilityValue?.text !== undefined ? { 'aria-valuetext': String(accessibilityValue.text) } : {}),
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
    AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
    Platform: {
      get OS() {
        return mockPlatformOS;
      },
      select: (values: Record<string, any>) => values?.[mockPlatformOS] ?? values?.default,
    },
    Pressable: createElement('button'),
    ScrollView: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'trends-scroll', ...toDomProps(props) }, children),
    Text: createElement('span'),
    View: createElement('div'),
    useWindowDimensions: () => mockWindow,
    StyleSheet: {
      create: <T extends Record<string, any>>(styles: T) => styles,
      flatten: (style: any) => style,
      hairlineWidth: 1,
    },
  };
});

jest.mock('react-native-svg', () => ({ __esModule: true, default: () => null, Path: () => null }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/motion', () => ({
  PressableScale: ({ children, onPress, testID, accessibilityLabel }: any) => (
    <button type="button" data-testid={testID} aria-label={accessibilityLabel} onClick={onPress}>{children}</button>
  ),
}));
// The seal, the calendar and the rest have their own motion; here they only report what the page hands them.
jest.mock('@/components/trends/PeriodSeal', () => ({
  PERIOD_SEAL_SIZE: 312,
  PeriodSeal: (props: any) => {
    mockSealProps(props);
    return <div data-testid="seal" />;
  },
}));
jest.mock('@/components/trends/TrendsFigures', () => ({
  TrendsFigures: (props: any) => {
    mockFiguresProps(props);
    return <div data-testid="figures" />;
  },
}));
jest.mock('@/components/trends/TrendsPeriodSwitch', () => ({
  TrendsPeriodSwitch: ({ onChange }: any) => (
    <div>
      {['7', '30', 'all'].map((period) => (
        <button key={period} type="button" data-testid={`trends.period.${period}`} onClick={() => onChange(period)} />
      ))}
    </div>
  ),
}));
jest.mock('@/components/trends/TrendsNights', () => ({
  TrendsNights: () => <div data-testid="trends.section.nights" />,
}));
jest.mock('@/components/trends/TrendsReturns', () => ({
  TrendsReturns: ({ onOpenUnanalyzed, onOpenType, plusHint }: any) => (
    <div data-testid="trends.section.returns">
      <button type="button" data-testid="returns.unanalyzed" onClick={onOpenUnanalyzed} />
      <button type="button" data-testid="returns.type" onClick={() => onOpenType('Nightmare')} />
      {plusHint ? <button type="button" data-testid="returns.plusHint" onClick={plusHint.onPress}>{plusHint.text}</button> : null}
    </div>
  ),
}));
jest.mock('@/components/trends/TrendsSky', () => ({
  TrendsSky: ({ sky, onOpenDream }: any) => (
    <div data-testid="trends.section.sky" data-stars={sky.stars.length}>
      <button type="button" data-testid="sky.newest" onClick={() => onOpenDream(sky.stars.at(-1).dream)} />
    </div>
  ),
}));
jest.mock('@/components/journal/symbols/DreamSymbolSheet', () => ({ DreamSymbolSheet: () => null }));
jest.mock('@/components/NoctaliaScreenHeader', () => ({
  NoctaliaScreenHeader: ({
    titleKey,
    actions = [],
  }: {
    titleKey: string;
    actions?: { testID?: string; accessibilityLabel?: string; onPress?: () => void }[];
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
jest.mock('@/components/ScreenContainer', () => ({
  ScreenContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/hooks/useClearWebFocus', () => ({
  useClearWebFocus: () => undefined,
}));
jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    currentLang: 'en',
    t: (key: string, params?: Record<string, string | number>) =>
      params
        ? `${key}:${Object.entries(params)
            .map(([name, value]) => `${name}=${value}`)
            .join('|')}`
        : key,
  }),
}));
jest.mock('@/hooks/useLocaleFormatting', () => ({
  useLocaleFormatting: () => ({
    locale: 'en-US',
    formatNumber: (value: number) => String(value),
    formatDate: (value: Date | number) => {
      const date = new Date(typeof value === 'number' ? value : value.getTime());
      return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
    },
  }),
}));
jest.mock('@/context/DreamsContext', () => ({
  useDreams: () => mockUseDreams(),
}));
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock('@/hooks/useQuota', () => ({
  useQuota: () => mockQuota,
}));
jest.mock('@/context/ThemeContext', () => {
  const { DarkTheme } = require('@/constants/journalTheme');
  return {
    useTheme: () => ({ colors: DarkTheme, mode: 'dark' }),
  };
});

const { default: StatisticsScreen } = require('@/app/(tabs)/statistics') as {
  default: React.ComponentType;
};

// Saturday 29 August 2026: the 30 nights run from 31 July, the 30 before from 1 July.
const nightsAgo = (days: number) => localDay(2026, 7, 29 - days);
const lastSeal = () => mockSealProps.mock.calls.at(-1)?.[0] as any;
const sentence = () => screen.getByTestId('trends.seal.sentence').textContent;

function renderJournal(dreams: DreamAnalysis[]) {
  mockUseDreams.mockReturnValue({ dreams, loaded: true });
  return render(<StatisticsScreen />);
}

describe('Tendances screen', () => {
  it.each([false, true])('keeps loading=%s and the settings header in a usable compact scroll viewport', (loaded: boolean) => {
    mockUseDreams.mockReturnValue({ dreams: [], loaded });
    mockBottomInset = 24;
    const view = render(<StatisticsScreen />);
    for (const [width, height] of [[640, 320], [915, 412]]) {
      for (const scale of [1, 1.5, 2]) {
        Object.assign(mockWindow, { width, height, fontScale: scale });
        view.rerender(<StatisticsScreen />);
        const scroll = screen.queryByTestId('trends-scroll');
        const settings = screen.getByTestId(TID.Button.HeaderTrendsSettings);
        expect(screen.getAllByTestId(TID.Button.HeaderTrendsSettings)).toHaveLength(1);
        // Loaded trends scroll their header away as on Today; the brief loading state only does so in compact large text.
        expect(Boolean(scroll?.contains(settings))).toBe(loaded || scale >= 1.3);
        if (scale >= 1.3) {
          const style = JSON.parse(scroll!.getAttribute('data-style') ?? '{}');
          const content = JSON.parse(scroll!.getAttribute('data-content-container-style') ?? '{}');
          expect(height - style.marginBottom).toBeGreaterThanOrEqual(120);
          expect(content.paddingBottom).toBeLessThan(50);
          expect(scroll!.textContent).toContain(loaded ? 'trends.empty.body' : 'trends.loading');
          if (!loaded) {
            const message = screen.getByText('trends.loading').parentElement!;
            expect(message.className).toContain('shrink-0');
            expect(message.className).not.toContain('flex-1');
            expect(message.getAttribute('aria-live')).toBe('polite');
          }
        }
        Object.assign(mockWindow, { width: height, height: width });
        view.rerender(<StatisticsScreen />);
        expect(screen.queryByTestId('trends-scroll')?.contains(screen.getByTestId(TID.Button.HeaderTrendsSettings)) ?? false).toBe(loaded);
      }
    }
  });

  it('keeps loading accessible until dreams are ready', () => {
    mockUseDreams.mockReturnValue({ dreams: [], loaded: false });

    render(<StatisticsScreen />);

    expect(screen.getByRole('progressbar', { name: 'trends.loading' })).toBeTruthy();
    expect(screen.queryByTestId('screen.trends')).toBeNull();
    expect(screen.queryByTestId('trends.cta.primary')).toBeNull();
  });

  it('welcomes an empty journal with one capture button instead of a row of zeros', () => {
    renderJournal([]);

    expect(screen.getByTestId('trends.empty').textContent).toContain('trends.empty.body');
    expect(screen.queryByTestId('figures')).toBeNull();
    expect(screen.queryByTestId('seal')).toBeNull();
    fireEvent.click(screen.getByTestId('trends.cta.primary'));
    expect(mockPush).toHaveBeenCalledWith('/recording');
  });

  it('exposes settings from the trends header without a fifth tab', () => {
    renderJournal([]);

    const settings = screen.getByTestId(TID.Button.HeaderTrendsSettings);
    expect(settings.getAttribute('aria-label')).toBe('nav.settings');
    fireEvent.click(settings);
    expect(mockPush).toHaveBeenCalledWith('/settings');
    expect(screen.queryByTestId(TID.Tab.Settings)).toBeNull();
  });

  it('says where the month leans, against the 30 nights before, and opens those dreams', () => {
    renderJournal([
      analyzed(nightsAgo(0), { theme: 'mystical' }),
      analyzed(nightsAgo(3), { theme: 'mystical' }),
      analyzed(nightsAgo(9), { theme: 'mystical' }),
      analyzed(nightsAgo(12), { theme: 'calm' }),
      analyzed(nightsAgo(40), { theme: 'mystical' }),
    ]);

    expect(screen.getByTestId('trends.range').textContent).toBe('trends.range:start=2026-07-31|end=2026-08-29 · trends.compare.30');
    expect(lastSeal()).toMatchObject({ shown: 'mystical', selected: null });
    expect(sentence()).toBe(
      'trends.seal.leans:scope=trends.scope.30|toward=trends.seal.toward.mystical|count=3|total=4, '
      + 'trends.compare.more:count=2|previous=trends.previous.30.',
    );
    expect(screen.getByTestId('trends.seal.open').textContent).toBe('trends.seal.open:count=3');
    fireEvent.click(screen.getByTestId('trends.seal.open'));
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/(tabs)/journal',
      params: { filter: expect.any(String), theme: 'mystical', from: '2026-07-31', to: '2026-08-29' },
    });
  });

  it('turns the seal to a chosen sign and lets a new period start from what leads', () => {
    renderJournal([
      analyzed(nightsAgo(0), { theme: 'mystical' }),
      analyzed(nightsAgo(3), { theme: 'mystical' }),
      analyzed(nightsAgo(12), { theme: 'calm' }),
    ]);

    act(() => lastSeal().onSelect('noir'));
    expect(lastSeal()).toMatchObject({ shown: 'noir', selected: 'noir' });
    expect(sentence()).toBe('trends.seal.theme_zero:theme=dream.theme.noir|count=0|total=3.');
    // Nothing to open for a sign without dreams.
    expect(screen.queryByTestId('trends.seal.open')).toBeNull();

    act(() => lastSeal().onSelect('calm'));
    expect(screen.getByTestId('trends.seal.open').textContent).toBe('trends.seal.open_one:count=1');

    fireEvent.click(screen.getByTestId('trends.period.7'));
    expect(lastSeal()).toMatchObject({ selected: null });
  });

  it.each([
    ['a tie', ['mystical', 'mystical', 'calm', 'calm'], 'trends.seal.tied'],
    ['too few themed dreams', ['mystical', 'mystical'], 'trends.seal.early_one:count=1'],
    ['no theme yet', [undefined, undefined, undefined], 'trends.seal.unthemed'],
  ])('does not claim a lean with %s', (_case: string, themes: (DreamTheme | undefined)[], expected: string) => {
    renderJournal(themes.map((theme, index) => analyzed(nightsAgo(index + 1), { theme })));

    expect(lastSeal().shown).toBeNull();
    expect(sentence()).toBe(expected);
    expect(screen.queryByTestId('trends.seal.open')).toBeNull();
    // Nothing came before these 30 nights, so nothing is compared.
    expect(screen.getByTestId('trends.range').textContent).not.toContain('trends.compare');
  });

  it('says a quiet period is quiet and opens the whole journal without dates', () => {
    renderJournal([analyzed(nightsAgo(20), { theme: 'calm', dreamType: 'Nightmare' })]);

    fireEvent.click(screen.getByTestId('trends.period.7'));
    expect(sentence()).toBe('trends.seal.quiet');
    fireEvent.click(screen.getByTestId('returns.unanalyzed'));
    expect(mockNavigate).toHaveBeenLastCalledWith({
      pathname: '/(tabs)/journal',
      params: { filter: expect.any(String), analysis: 'unanalyzed', from: '2026-08-23', to: '2026-08-29' },
    });

    fireEvent.click(screen.getByTestId('trends.period.all'));
    expect(screen.getByTestId('trends.range').textContent).toBe('trends.range.since:date=2026-08-09 · trends.compare.all:count=3');
    fireEvent.click(screen.getByTestId('returns.type'));
    expect(mockNavigate).toHaveBeenLastCalledWith({
      pathname: '/(tabs)/journal',
      params: { filter: expect.any(String), type: 'Nightmare', analysis: 'analyzed' },
    });
  });

  it('draws the period’s dreams in its sky, and a star reopens its dream', () => {
    const newest = analyzed(nightsAgo(2), { theme: 'calm' });
    renderJournal([analyzed(nightsAgo(20), { theme: 'calm' }), newest]);

    expect(screen.getByTestId('trends.section.sky').getAttribute('data-stars')).toBe('2');
    fireEvent.click(screen.getByTestId('trends.period.7'));
    expect(screen.getByTestId('trends.section.sky').getAttribute('data-stars')).toBe('1');
    fireEvent.click(screen.getByTestId('sky.newest'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/journal/[id]', params: expect.objectContaining({ id: String(newest.id) }) });
  });

  it('reads on the new day once midnight passes with the page open', () => {
    renderJournal([analyzed(nightsAgo(0), { theme: 'calm' })]);
    expect(screen.getByTestId('trends.range').textContent).toBe('trends.range:start=2026-07-31|end=2026-08-29');

    // 18:00 to 01:00 the next morning.
    act(() => {
      jest.advanceTimersByTime(7 * 60 * 60 * 1000);
    });
    expect(screen.getByTestId('trends.range').textContent).toBe('trends.range:start=2026-08-01|end=2026-08-30');
  });

  it('tells a journal younger than two weeks in nights', () => {
    renderJournal([analyzed(nightsAgo(0), { theme: 'calm' })]);
    fireEvent.click(screen.getByTestId('trends.period.all'));
    expect(screen.getByTestId('trends.range').textContent).toBe('trends.range.since:date=2026-08-29 · trends.compare.all_nights_one:count=1');
  });

  it('stacks the figures at fontScale 2 and reserves scroll padding above the tab bar', () => {
    mockWindow.fontScale = 2;
    renderJournal([analyzed(nightsAgo(1), { theme: 'calm' })]);

    expect(mockFiguresProps.mock.calls.at(-1)?.[0]).toMatchObject({ stacked: true });
    const { getBottomNavigationLayout } = require('@/constants/layout');
    const { ThemeLayout } = require('@/constants/journalTheme');
    const layout = getBottomNavigationLayout(390, 844, 2);
    const expected = layout.barHeight + layout.minimumBottomInset + ThemeLayout.spacing.lg;
    const scroller = screen.getByTestId('trends.section.seal').closest('[data-content-container-style]');
    expect(scroller?.getAttribute('data-content-container-style')).toContain(`"paddingBottom":${expected}`);
  });

  it('scrolls to the bottom safe area when the navigation stands in the iPhone Duo side column', () => {
    // The column is iOS's alone.
    mockPlatformOS = 'ios';
    mockInSideColumn = true;
    mockBottomInset = 34;
    mockWindow.width = 382;
    mockWindow.height = 678;
    renderJournal([analyzed(nightsAgo(1), { theme: 'calm' })]);

    const { ThemeLayout } = require('@/constants/journalTheme');
    const scroller = screen.getByTestId('trends.section.seal').closest('[data-content-container-style]');
    expect(scroller?.getAttribute('data-content-container-style')).toContain(`"paddingBottom":${34 + ThemeLayout.spacing.lg}`);
  });

  it('fits the seal and keeps every section at 320 dp', () => {
    mockWindow.width = 320;
    renderJournal([analyzed(nightsAgo(1), { theme: 'calm' })]);

    expect(lastSeal().size).toBe(280);
    expect(mockFiguresProps.mock.calls.at(-1)?.[0]).toMatchObject({ stacked: false });
    for (const id of ['trends.section.period', 'trends.section.seal', 'trends.section.nights', 'trends.section.returns', 'trends.section.sky', 'trends.layout.compact']) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
  });
  it('points a free account with used analyses to Plus for its unread dreams', () => {
    mockUser = { id: 'user-1' };
    mockQuota = { tier: 'free', usage: { analysis: { used: 3, limit: 3, remaining: 0 } }, loading: false, error: null };
    const unread = { isAnalyzed: false, analysisStatus: 'none', interpretation: '', analyzedAt: undefined } as Partial<DreamAnalysis>;
    renderJournal([analyzed(nightsAgo(1)), analyzed(nightsAgo(2), unread), analyzed(nightsAgo(3), unread)]);

    const hint = screen.getByTestId('returns.plusHint');
    expect(hint.textContent).toMatch(/^trends\.returns\.plus_hint:date=.+\|count=2$/);
    fireEvent.click(hint);
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/paywall', params: { trigger: 'stats_profile' } });
  });

  it('leaves out of the Plus hint a dream whose analysis is under way or can resume', () => {
    mockUser = { id: 'user-1' };
    mockQuota = { tier: 'free', usage: { analysis: { used: 3, limit: 3, remaining: 0 } }, loading: false, error: null };
    const unread = { isAnalyzed: false, analysisStatus: 'none', interpretation: '', analyzedAt: undefined } as Partial<DreamAnalysis>;
    const pending = {
      ...unread,
      analysisStatus: 'pending',
      analysisRequestId: '8f14e45f-ceea-4e6b-9a3c-2b1d0f6a7c11',
    } as Partial<DreamAnalysis>;
    renderJournal([analyzed(nightsAgo(1)), analyzed(nightsAgo(2), unread), analyzed(nightsAgo(3), pending)]);
    expect(screen.getByTestId('returns.plusHint').textContent).toMatch(/^trends\.returns\.plus_hint_one:date=.+$/);

    cleanup();
    renderJournal([analyzed(nightsAgo(1)), analyzed(nightsAgo(3), pending)]);
    expect(screen.queryByTestId('returns.plusHint')).toBeNull();
  });

  it('says nothing about Plus while free analyses remain', () => {
    mockUser = { id: 'user-1' };
    mockQuota = { tier: 'free', usage: { analysis: { used: 1, limit: 3, remaining: 2 } }, loading: false, error: null };
    const unread = { isAnalyzed: false, analysisStatus: 'none', interpretation: '', analyzedAt: undefined } as Partial<DreamAnalysis>;
    renderJournal([analyzed(nightsAgo(1)), analyzed(nightsAgo(2), unread)]);

    expect(screen.queryByTestId('returns.plusHint')).toBeNull();
  });
});
