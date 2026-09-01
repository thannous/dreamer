/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { TID } from '@/lib/testIDs';
import type { DreamAnalysis } from '@/lib/types';

const mockPush = jest.fn();
const mockUseDreams = jest.fn();

const NOW = new Date(2026, 7, 29, 18, 0, 0).getTime();
const localDay = (year: number, monthIndex: number, day: number, hour = 9): number =>
  new Date(year, monthIndex, day, hour, 0, 0).getTime();

jest.useFakeTimers();
jest.setSystemTime(NOW);

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
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
      contentContainerStyle,
      contentInsetAdjustmentBehavior,
      showsVerticalScrollIndicator,
      className,
      style,
      ...rest
    } = props;
    return {
      ...rest,
      ...(testID ? { 'data-testid': testID } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}),
      ...(accessibilityLiveRegion ? { 'aria-live': accessibilityLiveRegion } : {}),
      ...(accessible ? { 'aria-hidden': 'false' } : {}),
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
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
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
    expect(patterns.getByText('trends.patterns.item:label=dream.theme.calm|count=2')).toBeTruthy();
    expect(patterns.getByText('trends.patterns.item:label=dream.theme.noir|count=1')).toBeTruthy();
    expect(patterns.getByText('trends.patterns.item:label=stats.emotion.family.fear|count=2')).toBeTruthy();
    expect(patterns.getByText('trends.patterns.item:label=dream.type.recurring|count=1')).toBeTruthy();
    expect(patterns.getByText('trends.patterns.recurrence:count=3')).toBeTruthy();

    const evolution = within(screen.getByTestId('trends.section.evolution'));
    expect(evolution.queryByText('trends.evolution.empty')).toBeNull();
    expect(
      evolution.getByText('trends.evolution.point:date=2026-08-27|theme=dream.theme.noir|count=1'),
    ).toBeTruthy();
    expect(
      evolution.getByText('trends.evolution.point:date=2026-08-28|theme=dream.theme.calm|count=1'),
    ).toBeTruthy();
    expect(
      evolution.getByText('trends.evolution.point:date=2026-08-29|theme=dream.theme.calm|count=1'),
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
});
