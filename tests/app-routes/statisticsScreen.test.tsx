/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { TID } from '@/lib/testIDs';
import type { DreamAnalysis } from '@/lib/types';

const mockPush = jest.fn();
const mockUseDreams = jest.fn();
const mockWindow = { width: 390, height: 844, scale: 1, fontScale: 1 };

const NOW = new Date(2026, 7, 29, 18, 0, 0).getTime();
const localDay = (year: number, monthIndex: number, day: number, hour = 9): number =>
  new Date(year, monthIndex, day, hour, 0, 0).getTime();

jest.useFakeTimers();
jest.setSystemTime(NOW);

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  mockWindow.width = 390;
  mockWindow.height = 844;
  mockWindow.fontScale = 1;
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
  router: { push: mockPush },
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
      ...rest
    } = props;
    return {
      ...rest,
      ...(className ? { className } : {}),
      ...(style ? { 'data-style': JSON.stringify(style) } : {}),
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
    Platform: {
      OS: 'web',
      select: (values: Record<string, any>) => values?.web ?? values?.default,
    },
    Pressable: createElement('button'),
    ScrollView: createElement('div'),
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

jest.mock('@/components/inspiration/AtmosphericBackground', () => ({
  AtmosphericBackground: () => null,
}));
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
jest.mock('@/components/dev/MockNavigationRail', () => ({
  MockNavigationRail: () => null,
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
jest.mock('@/context/ThemeContext', () => {
  const { DarkTheme } = require('@/constants/journalTheme');
  return {
    useTheme: () => ({ colors: DarkTheme, mode: 'dark' }),
  };
});

const { default: StatisticsScreen } = require('@/app/(tabs)/statistics') as {
  default: React.ComponentType;
};

const SECTION_IDS = [
  'trends.section.week',
  'trends.section.patterns',
  'trends.section.evolution',
] as const;

const RETIRED_IDS = [
  TID.Button.HeaderStatsShare,
  TID.Button.HeaderStatsPeriod,
  TID.Button.StatsPeriodChip,
  TID.Button.DreamProfileUpgradeCta,
  TID.Button.StatsInsightCta,
  TID.Button.StatsMostDiscussedDream,
  TID.Component.DreamProfileCard,
  TID.Component.DreamProfilePlusPreview,
  TID.Component.StatsInsight,
  TID.Component.StatsPeriodEmpty,
  TID.Stats.TotalChatsValue,
  TID.Stats.DreamsWithChatValue,
] as const;

function expectVNextShell() {
  expect(SECTION_IDS.map((id) => screen.getByTestId(id))).toHaveLength(3);
  expect(screen.getAllByTestId(/trends\.section\./)).toHaveLength(3);
  expect(screen.getByTestId('trends.cta.primary')).toBeTruthy();
  for (const id of RETIRED_IDS) {
    expect(screen.queryByTestId(id)).toBeNull();
  }
}

function expectUngroupedSection(testID: string, heading: string) {
  const section = screen.getByTestId(testID);
  expect(section.getAttribute('data-accessible')).toBe('false');
  expect(section.getAttribute('role')).toBe('none');
  expect(section.getAttribute('aria-label')).toBeNull();
  expect(section.querySelector('[role="header"]')?.textContent).toBe(heading);
}

describe('Statistics screen VNext trends', () => {
  it('keeps loading accessible until dreams are ready', () => {
    mockUseDreams.mockReturnValue({ dreams: [], loaded: false });

    render(<StatisticsScreen />);

    expect(screen.getByRole('progressbar', { name: 'trends.loading' })).toBeTruthy();
    expect(screen.getByText('trends.loading')).toBeTruthy();
    expect(screen.queryByTestId('trends.section.week')).toBeNull();
    expect(screen.queryByTestId('trends.cta.primary')).toBeNull();
  });

  it('renders exactly three sections with an honest empty journal', () => {
    mockUseDreams.mockReturnValue({ dreams: [], loaded: true });

    render(<StatisticsScreen />);

    expectVNextShell();
    expectUngroupedSection('trends.section.week', 'trends.section.week');
    expectUngroupedSection('trends.section.patterns', 'trends.section.patterns');
    expectUngroupedSection('trends.section.evolution', 'trends.section.evolution');
    expect(screen.getByLabelText('trends.cta.capture_first')).toBeTruthy();
    expect(screen.getByText('trends.week.last_activity.empty')).toBeTruthy();
    expect(screen.getByText('trends.patterns.empty')).toBeTruthy();
    expect(screen.getByText('trends.evolution.empty')).toBeTruthy();
    expect(screen.queryByText('trends.week.average')).toBeNull();
  });

  it('routes capture_first to recording', () => {
    mockUseDreams.mockReturnValue({ dreams: [], loaded: true });

    render(<StatisticsScreen />);
    fireEvent.click(screen.getByTestId('trends.cta.primary'));

    expect(mockPush).toHaveBeenCalledWith('/recording');
  });

  it('exposes settings from the trends header without a fifth tab', () => {
    mockUseDreams.mockReturnValue({ dreams: [], loaded: true });

    render(<StatisticsScreen />);
    const settings = screen.getByTestId(TID.Button.HeaderTrendsSettings);
    expect(settings.getAttribute('aria-label')).toBe('nav.settings');
    fireEvent.click(settings);
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings');
    expect(screen.queryByTestId(TID.Tab.Settings)).toBeNull();
  });

  it('hides the weekly average when the model returns null', () => {
    mockUseDreams.mockReturnValue({
      dreams: [analyzed(localDay(2026, 7, 29), { theme: 'calm' })],
      loaded: true,
    });

    render(<StatisticsScreen />);

    expectVNextShell();
    expect(screen.queryByText('trends.week.average')).toBeNull();
    expect(screen.getByText('trends.patterns.empty')).toBeTruthy();
  });

  it('renders motifs and chronological evolution', () => {
    mockUseDreams.mockReturnValue({
      dreams: [
        analyzed(localDay(2026, 7, 27), {
          dreamType: 'Recurring Dream',
          theme: 'noir',
          emotions: [{ name: 'fear', insight: '' }],
        }),
        analyzed(localDay(2026, 7, 28), {
          theme: 'calm',
          emotions: [{ name: 'angoisse', insight: '' }],
          memory: { recurring: true },
        }),
        analyzed(localDay(2026, 7, 29), {
          dreamType: 'Lucid Dream',
          theme: 'calm',
          memory: { rememberedKind: 'recurring' },
        }),
      ],
      loaded: true,
    });

    render(<StatisticsScreen />);

    expectVNextShell();
    const patterns = within(screen.getByTestId('trends.section.patterns'));
    expect(patterns.queryByText('trends.patterns.empty')).toBeNull();
    expect(patterns.getByText('dream.theme.calm')).toBeTruthy();
    expect(patterns.getByText('dream.theme.noir')).toBeTruthy();
    expect(patterns.getAllByText('stats.legend.count:count=2').length).toBeGreaterThan(0);
    expect(patterns.getAllByText('stats.legend.count_one:count=1').length).toBeGreaterThan(0);
    expect(patterns.getByText('stats.emotion.family.fear')).toBeTruthy();
    expect(patterns.getByText('dream.type.recurring')).toBeTruthy();
    expect(patterns.getByText('trends.patterns.recurrence:count=3')).toBeTruthy();

    const calmBar = patterns.getByRole('progressbar', { name: 'dream.theme.calm' });
    expect(calmBar.getAttribute('aria-valuenow')).toBe('2');
    expect(calmBar.getAttribute('aria-valuemax')).toBe('2');
    expect(calmBar.getAttribute('aria-valuetext')).toBe('stats.legend.count:count=2');

    const evolution = within(screen.getByTestId('trends.section.evolution'));
    expect(evolution.queryByText('trends.evolution.empty')).toBeNull();
    expect(screen.getByTestId('trends.evolution.chart').getAttribute('data-accessible')).toBe('false');
    const firstPoint = screen.getByRole('progressbar', {
      name: 'trends.evolution.point:date=2026-08-27|theme=dream.theme.noir|count=1',
    });
    expect(firstPoint.getAttribute('data-testid')).toBe('trends.evolution.chart.day.2026-08-27');
    expect(firstPoint.getAttribute('data-accessible')).toBe('true');
    expect(firstPoint.getAttribute('aria-valuetext')).toBe('stats.legend.count_one:count=1');
    expect(
      evolution.getByLabelText('trends.evolution.point:date=2026-08-27|theme=dream.theme.noir|count=1'),
    ).toBeTruthy();
    expect(
      evolution.getByLabelText('trends.evolution.point:date=2026-08-28|theme=dream.theme.calm|count=1'),
    ).toBeTruthy();
    expect(
      evolution.getByLabelText('trends.evolution.point:date=2026-08-29|theme=dream.theme.calm|count=1'),
    ).toBeTruthy();
    expect(screen.queryByText('trends.week.average')).toBeNull();
  });

  it('routes review_patterns to the journal', () => {
    mockUseDreams.mockReturnValue({
      dreams: [
        analyzed(localDay(2026, 7, 27), { theme: 'noir' }),
        analyzed(localDay(2026, 7, 28), { theme: 'calm' }),
        analyzed(localDay(2026, 7, 29), { theme: 'calm' }),
      ],
      loaded: true,
    });

    render(<StatisticsScreen />);

    expect(screen.getByLabelText('trends.cta.review_patterns')).toBeTruthy();
    fireEvent.click(screen.getByTestId('trends.cta.primary'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/journal');
  });

  it('does not expose share, period, profile, paywall or chat surfaces', () => {
    mockUseDreams.mockReturnValue({ dreams: [], loaded: true });

    render(<StatisticsScreen />);

    expectVNextShell();
    expect(screen.queryByText(/stats\.(share|period|profile|empty|insight)/)).toBeNull();
    expect(screen.queryByText(/paywall/i)).toBeNull();
    expect(screen.queryByText(/chat/i)).toBeNull();
  });

  it('exposes labelled rhythm bars whose values are readable without colour', () => {
    mockUseDreams.mockReturnValue({
      dreams: [
        analyzed(localDay(2026, 7, 24), { theme: 'calm' }),
        analyzed(localDay(2026, 7, 29), { theme: 'noir' }),
        analyzed(localDay(2026, 7, 29, 12), { theme: 'calm' }),
      ],
      loaded: true,
    });

    render(<StatisticsScreen />);

    const chart = screen.getByTestId('trends.week.rhythm');
    expect(chart.getAttribute('aria-label')).toBe('trends.week.rhythm');
    expect(chart.getAttribute('data-accessible')).toBe('false');
    expect(chart.getAttribute('role')).toBe('none');

    const monday = screen.getByRole('progressbar', { name: 'trends.week.weekday.mon' });
    const saturday = screen.getByRole('progressbar', { name: 'trends.week.weekday.sat' });
    expect(monday.getAttribute('data-testid')).toBe('trends.week.rhythm.day.1');
    expect(monday.getAttribute('data-accessible')).toBe('true');
    expect(monday.getAttribute('aria-valuenow')).toBe('1');
    expect(monday.getAttribute('aria-valuetext')).toBe('stats.legend.count_one:count=1');
    expect(saturday.getAttribute('aria-valuenow')).toBe('2');
    expect(saturday.getAttribute('aria-valuetext')).toBe('stats.legend.count:count=2');
    expect(screen.getByTestId('trends.week.rhythm.day.1')).toBeTruthy();
    expect(screen.getByTestId('trends.week.rhythm.day.0')).toBeTruthy();
    expect(screen.queryByTestId('trends.layout.compact')).toBeNull();
  });

  it('keeps the three sections and labelled charts usable at 320 dp', () => {
    mockWindow.width = 320;
    mockUseDreams.mockReturnValue({
      dreams: [
        analyzed(localDay(2026, 7, 27), { theme: 'noir', dreamType: 'Recurring Dream' }),
        analyzed(localDay(2026, 7, 28), { theme: 'calm' }),
        analyzed(localDay(2026, 7, 29), { theme: 'calm' }),
      ],
      loaded: true,
    });

    render(<StatisticsScreen />);

    expectVNextShell();
    expect(screen.getByTestId('trends.layout.compact')).toBeTruthy();
    expect(screen.getByTestId('trends.week.rhythm')).toBeTruthy();
    for (const weekday of [1, 2, 3, 4, 5, 6, 0]) {
      expect(screen.getByTestId(`trends.week.rhythm.day.${weekday}`)).toBeTruthy();
    }
    expect(screen.getByTestId('trends.patterns.themes.list')).toBeTruthy();
    expect(screen.getByTestId('trends.evolution.chart')).toBeTruthy();
    expect(screen.getByTestId('trends.evolution.chart.day.2026-08-27')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'dream.theme.calm' }).getAttribute('aria-valuenow')).toBe('2');
  });

  it('keeps weekly metrics inline at default text scale', () => {
    mockUseDreams.mockReturnValue({ dreams: [], loaded: true });

    render(<StatisticsScreen />);

    const metrics = screen.getByTestId('trends.week.metrics.inline');
    expect(metrics.getAttribute('class')).toContain('flex-row');
    expect(metrics.getAttribute('class')).toContain('flex-wrap');
    expect(metrics.getAttribute('class')).not.toContain('flex-col');
    expect(screen.queryByTestId('trends.week.metrics.stacked')).toBeNull();
    expect(screen.getByText('trends.week.count').getAttribute('class')).toContain('shrink');
    expect(screen.getByText('trends.week.active_days').getAttribute('data-number-of-lines')).toBeNull();
    expect(screen.getByText('trends.week.streak.current').getAttribute('data-allow-font-scaling')).toBeNull();
    expect(screen.getByText('trends.week.streak.longest')).toBeTruthy();
  });

  it('stacks weekly metrics at fontScale 2 without clipping labels', () => {
    mockWindow.fontScale = 2;
    mockUseDreams.mockReturnValue({ dreams: [], loaded: true });

    render(<StatisticsScreen />);

    const metrics = screen.getByTestId('trends.week.metrics.stacked');
    expect(metrics.getAttribute('class')).toContain('flex-col');
    expect(metrics.getAttribute('class')).not.toContain('flex-row');
    expect(screen.queryByTestId('trends.week.metrics.inline')).toBeNull();
    expect(screen.queryByTestId('trends.layout.compact')).toBeNull();

    for (const label of [
      'trends.week.count',
      'trends.week.active_days',
      'trends.week.streak.current',
      'trends.week.streak.longest',
    ]) {
      const node = screen.getByText(label);
      expect(node.getAttribute('data-number-of-lines')).toBeNull();
      expect(node.getAttribute('data-allow-font-scaling')).toBeNull();
      expect(node.getAttribute('class')).toContain('shrink');
      expect(node.parentElement?.getAttribute('class')).toContain('w-full');
    }
  });
});
