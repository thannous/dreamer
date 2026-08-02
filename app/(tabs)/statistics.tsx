import { router, useFocusEffect, type Href } from 'expo-router';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  InteractionManager,
  Platform,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { StaticFlatGlassCard } from '@/components/inspiration/GlassCard';
import { PageHeader } from '@/components/inspiration/PageHeader';
import { SectionHeading } from '@/components/inspiration/SectionHeading';
import { NoctaliaScreenHeader, type NoctaliaHeaderAction } from '@/components/NoctaliaScreenHeader';
import { ScreenContainer } from '@/components/ScreenContainer';
import { StatsLockedSection, StatsNotEnoughData } from '@/components/stats/StatsLockedSection';
import { StatsRankedList, type StatsRankedRow } from '@/components/stats/StatsRankedList';
import { MockNavigationRail } from '@/components/dev/MockNavigationRail';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DESKTOP_BREAKPOINT, getBottomNavigationLayout } from '@/constants/layout';
import type { DataSet, LabelLineConfig, barDataItem, pieDataItem } from 'react-native-gifted-charts';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import { Line, Rect, Svg, Text as SvgText } from 'react-native-svg';

import { DecoLines, ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens, type NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useDreams } from '@/context/DreamsContext';
import { ScrollPerfProvider } from '@/context/ScrollPerfContext';
import { useTheme } from '@/context/ThemeContext';
import { useDreamStatistics } from '@/hooks/useDreamStatistics';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useScrollIdle } from '@/hooks/useScrollIdle';
import { useSubscription } from '@/hooks/useSubscription';
import { useTranslation } from '@/hooks/useTranslation';
import { getStatsDreamCountBucket, trackProductEvent } from '@/lib/analytics';
import { buildEmotionProfile, type EmotionProfile } from '@/lib/dreamEmotions';
import { compareDreamFacets } from '@/lib/dreamFacets';
import { buildDreamProfile, type DreamProfile } from '@/lib/dreamProfile';
import { getDreamThemeLabel, getDreamTypeLabel, getEmotionFamilyLabel } from '@/lib/dreamLabels';
import { getDreamStatsInsight, type DreamStatsInsightKind } from '@/lib/dreamStatsInsight';
import { isDreamAnalyzed } from '@/lib/dreamUsage';
import { buildPaywallHref } from '@/lib/paywallRoute';
import { splitLabelText } from '@/lib/pieLabelUtils';
import { deriveUserTier } from '@/lib/quotaTier';
import { startOfDay } from '@/lib/streakUtils';
import type { DreamAnalysis, DreamTheme, DreamType, SubscriptionTier } from '@/lib/types';
import { TID } from '@/lib/testIDs';

const CHART_HORIZONTAL_INSET = ThemeLayout.spacing.lg * 3;
const PIE_LABEL_MARGIN = ThemeLayout.spacing.sm;
const PIE_LABEL_VERTICAL_MARGIN = ThemeLayout.spacing.md;
const LABEL_TEXT_MARGIN = ThemeLayout.spacing.sm;
const LABEL_VERTICAL_PADDING = ThemeLayout.spacing.xs;
const LABEL_TEXT_LINE_HEIGHT = 14;
const LABEL_DETAIL_LINE_HEIGHT = 13;
const MAX_LABEL_LINES = 3;
const MAX_LABEL_CHARS_PER_LINE = 10;
const MIN_PIE_RADIUS = 62;
const MAX_PIE_RADIUS = 90;
const MIN_LABEL_WIDTH = 84;
const MAX_LABEL_WIDTH = 196;
const MIN_LABEL_LINE = 14;
const MAX_LABEL_LINE = 28;

// `getPieMetrics` subtracts CHART_HORIZONTAL_INSET (= 72) from the window width, but the real
// horizontal chrome around a chart is scrollContent padding (md x2) + sectionInner padding
// (22 x2) + chartContainer paddingHorizontal (md x2) = 108. That under-count is why the pie
// callouts touch the donut at 390 px (audit §6.5, excluded item #20). The two new charts
// measure it honestly rather than inheriting the bug.
const SECTION_INNER_PADDING = 22;
const CHART_CONTENT_INSET =
  ThemeLayout.spacing.md * 2 + SECTION_INNER_PADDING * 2 + ThemeLayout.spacing.md * 2;
// Desktop web lays the sections out in a wrapped row, so useWindowDimensions() reports the
// window, not the column the chart lives in. The pie survives that only because
// MAX_PIE_RADIUS caps it; a bar or line chart sized from the raw window width would spill out
// of its card at 1440 px. Capping avoids an onLayout pass and a second render.
// Checked against the narrowest desktop column the grid can produce: at DESKTOP_BREAKPOINT
// (1024) a 60% chart column yields (1024 - 32) * 0.6 - 44 - 32 ~= 519 usable px.
const MAX_CHART_CONTENT_WIDTH = 460;
const MIN_CHART_CONTENT_WIDTH = 200;

const RHYTHM_CHART_HEIGHT = 132;
const RHYTHM_Y_AXIS_LABEL_WIDTH = 26;
const RHYTHM_MIN_BAR_WIDTH = 10;
const RHYTHM_MAX_BAR_WIDTH = 26;
const RHYTHM_MIN_SPACING = 4;
const RHYTHM_MAX_SPACING = 22;

const THEME_TREND_CHART_HEIGHT = 148;
const THEME_TREND_Y_AXIS_LABEL_WIDTH = 26;
const THEME_TREND_MAX_POINTS = 30;
const THEME_TREND_MIN_SPAN_DAYS = 14;
const THEME_TREND_MIN_ANALYZED_DREAMS = 5;
const THEME_TREND_MAX_X_LABELS = 5;
const THEME_TREND_HIDE_POINTS_ABOVE = 12;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const WEEKDAY_LABEL_OPTIONS: Intl.DateTimeFormatOptions = { weekday: 'short' };
const TREND_LABEL_OPTIONS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

// Indexed BY WEEKDAY NUMBER, not by position in `stats.dreamsByDay`: 2023-12-31 was a Sunday,
// so WEEKDAY_REFERENCE_BY_DAY[d].getDay() === d for d in 0..6. Reading the label off
// `entry.weekday` instead of the array index keeps the row correct even if ORDERED_WEEKDAYS
// in useDreamStatistics is ever reordered. Local-time constructor, so no timezone shift.
const WEEKDAY_REFERENCE_BY_DAY = Array.from({ length: 7 }, (_, day) =>
  new Date(2023, 11, 31 + day).getTime(),
);

type IconName = Parameters<typeof IconSymbol>[0]['name'];
type StatsPeriod = 'all' | 'week' | 'month' | 'year';

const STATS_PERIOD_OPTIONS: { id: StatsPeriod; labelKey: string }[] = [
  { id: 'all', labelKey: 'stats.period.all' },
  { id: 'week', labelKey: 'stats.period.week' },
  { id: 'month', labelKey: 'stats.period.month' },
  { id: 'year', labelKey: 'stats.period.year' },
];

const STATS_PERIOD_DAYS: Record<Exclude<StatsPeriod, 'all'>, number> = {
  week: 7,
  month: 30,
  year: 365,
};

function filterDreamsByStatsPeriod(dreams: DreamAnalysis[], period: StatsPeriod, now = Date.now()) {
  if (period === 'all') {
    return dreams;
  }

  const cutoff = now - STATS_PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
  return dreams.filter((dream) => dream.id >= cutoff);
}

const STATS_INSIGHT_ICON: Record<DreamStatsInsightKind, IconName> = {
  record: 'moon.stars.fill',
  analyze: 'sparkles',
  explore: 'bubble.left.and.bubble.right.fill',
  favorite: 'heart.fill',
  streak: 'flame.fill',
  steady: 'checkmark.circle.fill',
};

const DREAM_PROFILE_NEXT_ROUTE: Record<DreamProfile['nextAction'], Href> = {
  add_anchor: '/recording?intent=remembered&source=profile',
  capture_more: '/recording',
  analyze_unanalyzed: '/(tabs)/journal',
  explore_more: '/(tabs)/journal',
  review_patterns: '/(tabs)/journal',
};

// Entry stagger. StaticFlatGlassCard fades each card in over 650 ms (GlassCard.tsx), so the
// delays stay short: every section starts fading within 120 ms of its own mount instead of 750 ms.
// The three deferred sections mount later (InteractionManager), so their ramp restarts at 0.
const SECTION_ANIMATION_DELAY = {
  overview: 0,
  profile: 40,
  insight: 80,
  streaks: 120,
  // Deferred group: these mount together, later, so the ramp restarts at 0.
  rhythm: 0,
  dreamTypes: 40,
  topThemes: 80,
  // Second restart. The two content sections sit a full viewport below Top themes, and the
  // property this ramp exists to hold — every section starts fading within 120 ms of its own
  // mount (audit P2-19) — must survive adding three sections. Extending linearly to 200 ms
  // would have broken it. The same discontinuity already exists at streaks(120) ->
  // dreamTypes.
  emotions: 0,
  themeTrend: 40,
  engagement: 80,
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// Bars in the S2 locked preview. Decorative and capped on purpose: the honest number is the
// count line above them, so the bar count never has to equal `distinctFamilies`.
const EMOTION_LOCKED_PREVIEW_ROWS = 5;
const LOCKED_PREVIEW_RATIO_STEP = 0.18;

// __DEV__-only lexicon-rot alarm. Ratio only — never `unmatched.samples`, which is raw
// dream-derived free text (lib/dreamEmotions.ts privacy note).
const EMOTION_COVERAGE_ALERT_MENTIONS = 20;
const EMOTION_COVERAGE_ALERT_RATIO = 0.8;

function getLabelHeight(lineCount: number) {
  const safeCount = Math.max(1, lineCount);
  return LABEL_VERTICAL_PADDING * 2 + safeCount * LABEL_TEXT_LINE_HEIGHT + LABEL_DETAIL_LINE_HEIGHT;
}

const PIE_LABEL_HEIGHT = getLabelHeight(MAX_LABEL_LINES);

const getChartContentWidth = (screenWidth: number) =>
  clamp(
    Math.min(screenWidth, MAX_CHART_CONTENT_WIDTH + CHART_CONTENT_INSET) - CHART_CONTENT_INSET,
    MIN_CHART_CONTENT_WIDTH,
    MAX_CHART_CONTENT_WIDTH,
  );

// gifted-charts labels the y axis with `showFractionalValues: false`, so a maxValue that is
// not a multiple of noOfSections silently prints repeated integers. Derive an integer step.
const getIntegerAxis = (maxCount: number, maxSections = 4) => {
  const safeMax = Math.max(1, maxCount);
  const noOfSections = Math.min(maxSections, safeMax);
  const stepValue = Math.ceil(safeMax / noOfSections);
  return { noOfSections, maxValue: stepValue * noOfSections };
};

type RhythmMetrics = {
  plotWidth: number;
  barWidth: number;
  spacing: number;
  initialSpacing: number;
  endSpacing: number;
};

// Same discipline as getPieMetrics: derive every dimension from the window width once, in a
// pure function, and memoise the call. The wrapper lays a bar chart out as
// initialSpacing + n x (barWidth + spacing) + endSpacing, which is where the +0.5 comes from
// (it mirrors the library's own adjustToWidth formula, gifted-charts-core BarChart/index.js).
function getRhythmMetrics(screenWidth: number, barCount: number): RhythmMetrics {
  const plotWidth = Math.max(getChartContentWidth(screenWidth) - RHYTHM_Y_AXIS_LABEL_WIDTH, 120);
  const slot = plotWidth / (Math.max(1, barCount) + 0.5);
  const barWidth = Math.round(clamp(slot * 0.6, RHYTHM_MIN_BAR_WIDTH, RHYTHM_MAX_BAR_WIDTH));
  const spacing = Math.round(clamp(slot - barWidth, RHYTHM_MIN_SPACING, RHYTHM_MAX_SPACING));
  const leftover = plotWidth - barCount * (barWidth + spacing);
  const initialSpacing = Math.round(Math.max(spacing, leftover / 2 + spacing / 2));

  return { plotWidth, barWidth, spacing, initialSpacing, endSpacing: spacing };
}

type ThemeTrendMetrics = {
  plotWidth: number;
  spacing: number;
  initialSpacing: number;
  endSpacing: number;
};

function getThemeTrendMetrics(screenWidth: number, pointCount: number): ThemeTrendMetrics {
  const plotWidth = Math.max(
    getChartContentWidth(screenWidth) - THEME_TREND_Y_AXIS_LABEL_WIDTH,
    120,
  );
  const initialSpacing = 10;
  const endSpacing = 10;
  const spacing = (plotWidth - initialSpacing - endSpacing) / Math.max(1, pointCount - 1);

  return { plotWidth, spacing, initialSpacing, endSpacing };
}

type PieMetrics = {
  chartWidth: number;
  pieLabelWidth: number;
  pieLabelLineLength: number;
  pieExtraRadius: number;
  pieRadius: number;
  pieInnerRadius: number;
  pieLabelTailLength: number;
  pieChartDimension: number;
  pieChartCenter: number;
};

function getPieMetrics(screenWidth: number): PieMetrics {
  const chartWidth = screenWidth - CHART_HORIZONTAL_INSET;

  // Balance the donut radius and external label width so callouts stay visible on all breakpoints.
  const baseLabelWidth = clamp(chartWidth * 0.38, MIN_LABEL_WIDTH, MAX_LABEL_WIDTH);
  const baseLabelLineLength = clamp(chartWidth * 0.05, MIN_LABEL_LINE, MAX_LABEL_LINE);
  const maxPaddingPerSide = Math.max(
    (chartWidth - MIN_PIE_RADIUS * 2) / 2,
    PIE_LABEL_MARGIN + MIN_LABEL_LINE + 24,
  );

  let pieLabelWidth = baseLabelWidth;
  let pieLabelLineLength = baseLabelLineLength;
  let piePaddingPerSide = pieLabelWidth + pieLabelLineLength + PIE_LABEL_MARGIN;

  if (piePaddingPerSide > maxPaddingPerSide) {
    const availableForElements = Math.max(maxPaddingPerSide - PIE_LABEL_MARGIN, MIN_LABEL_LINE);
    const totalDesired = (pieLabelWidth + pieLabelLineLength) || 1;
    const lineWeight = pieLabelLineLength / totalDesired;
    pieLabelLineLength = clamp(availableForElements * lineWeight, MIN_LABEL_LINE, MAX_LABEL_LINE);
    pieLabelWidth = clamp(availableForElements - pieLabelLineLength, 48, MAX_LABEL_WIDTH);
    const overflow = pieLabelWidth + pieLabelLineLength - availableForElements;
    if (overflow > 0) {
      pieLabelWidth = Math.max(40, pieLabelWidth - overflow);
    }
    piePaddingPerSide = pieLabelWidth + pieLabelLineLength + PIE_LABEL_MARGIN;
  }

  const pieExtraRadius = piePaddingPerSide;
  const pieRadius = clamp(chartWidth / 2 - pieExtraRadius, MIN_PIE_RADIUS, MAX_PIE_RADIUS);

  return {
    chartWidth,
    pieLabelWidth,
    pieLabelLineLength,
    pieExtraRadius,
    pieRadius,
    pieInnerRadius: pieRadius * 0.62,
    pieLabelTailLength: Math.max(
      10,
      Math.min(pieLabelLineLength * 0.45, pieLabelLineLength - 4)
    ),
    pieChartDimension: pieRadius * 2 + pieExtraRadius * 2,
    pieChartCenter: pieRadius + pieExtraRadius,
  };
}

export type ThemeTrendSeries = {
  theme: DreamTheme;
  /** One bucket count per entry in `ThemeTrend.points`. */
  counts: number[];
  total: number;
};

export type ThemeTrend = {
  /** Bucket start timestamps, ascending. Empty when there is nothing to plot. */
  points: number[];
  /** One entry per theme actually present, ranked with compareDreamFacets. At most 4. */
  series: ThemeTrendSeries[];
  /** Observed span between the first and last plotted dream, inclusive. */
  spanDays: number;
  /** Analysed, themed dreams that landed inside the window. */
  analyzedDreams: number;
  /** Days per bucket. 1 until the window needs more than THEME_TREND_MAX_POINTS points. */
  bucketDays: number;
  /**
   * Hard ceiling the selected period puts on `spanDays`, or null for 'all' (unbounded).
   * The span threshold is capped to it: under the 7-day period a 14-day span is unreachable
   * by construction, so an uncapped threshold would make this section permanently
   * unsatisfiable rather than merely empty. Deliberately NOT the resolved window length —
   * for 'all' that is derived from the journal itself, and capping to it would dissolve the
   * threshold entirely.
   */
  maxSpanDays: number | null;
  /** Highest single bucket value across all series. Drives the y axis. */
  maxCount: number;
};

const EMPTY_THEME_TREND: ThemeTrend = {
  points: [],
  series: [],
  spanDays: 0,
  analyzedDreams: 0,
  bucketDays: 1,
  maxCount: 0,
  maxSpanDays: 0,
};

// Math.round, not Math.floor: startOfDay() returns local midnight, and across a DST boundary
// a one-day gap is 23 or 25 hours, which floor() would count as zero days.
const dayDiff = (fromDayStart: number, toDayStart: number) =>
  Math.round((toDayStart - fromDayStart) / DAY_IN_MS);

/**
 * Theme x day aggregation for "Themes over time" (S3).
 *
 * Lives here, not on useDreamStatistics, on purpose. The hook receives an already-filtered
 * array and cannot know which window produced it — which is exactly why its `dreamsOverTime`
 * hard-codes 30 days and has never been renderable under a 7-day or 12-month filter. Teaching
 * it the period would change its signature and ripple into every caller and its test file.
 * Re-render cost is identical either way (both recompute on the same `periodDreams` identity
 * change), so the decision rests on coupling alone.
 *
 * Exported so a unit test can drive it without rendering the screen. Expo Router only reads
 * `default`, `ErrorBoundary` and `unstable_settings` from a route module; other named exports
 * are ignored.
 *
 * `now` is a defaulted parameter rather than an argument the memo passes, mirroring
 * `filterDreamsByStatsPeriod` above: it keeps the clock read out of the hook body (which
 * react-hooks/purity flags) while staying injectable from a test.
 */
export function buildThemeTrend(
  dreams: DreamAnalysis[],
  period: StatsPeriod,
  now: number = Date.now(),
): ThemeTrend {
  const themed = dreams.filter((dream) => Boolean(dream.theme) && isDreamAnalyzed(dream));
  if (themed.length === 0) return EMPTY_THEME_TREND;

  const todayStart = startOfDay(now).getTime();
  let earliestDay = todayStart;
  themed.forEach((dream) => {
    const day = startOfDay(dream.id).getTime();
    if (day < earliestDay) earliestDay = day;
  });

  // 'all' is anchored on today so the right edge always means "now", like dreamsOverTime.
  const windowDays =
    period === 'all'
      ? Math.max(1, dayDiff(earliestDay, todayStart) + 1)
      : STATS_PERIOD_DAYS[period];
  const windowStart = todayStart - (windowDays - 1) * DAY_IN_MS;

  // Bucketing keeps the point count bounded: 'all' on a two-year journal would otherwise be
  // 730 x-positions x 4 series inside a nested ScrollView.
  const bucketDays = Math.max(1, Math.ceil(windowDays / THEME_TREND_MAX_POINTS));
  const pointCount = Math.max(1, Math.ceil(windowDays / bucketDays));

  const counts = new Map<DreamTheme, number[]>();
  let analyzedDreams = 0;
  let firstDay = todayStart;
  let lastDay = windowStart;

  themed.forEach((dream) => {
    const day = startOfDay(dream.id).getTime();
    const offset = dayDiff(windowStart, day);
    if (offset < 0 || offset >= windowDays) return;

    const theme = dream.theme as DreamTheme;
    const bucket = Math.min(Math.floor(offset / bucketDays), pointCount - 1);
    const series = counts.get(theme) ?? new Array<number>(pointCount).fill(0);
    series[bucket] += 1;
    counts.set(theme, series);

    analyzedDreams += 1;
    if (day < firstDay) firstDay = day;
    if (day > lastDay) lastDay = day;
  });

  if (analyzedDreams === 0) return EMPTY_THEME_TREND;

  const series = Array.from(counts.entries())
    .map(([theme, values]) => ({
      theme,
      counts: values,
      total: values.reduce((sum, value) => sum + value, 0),
    }))
    // Same comparator as the pie and Top themes. Audit §7.2: two rankings of the same facet
    // on one screen must never disagree on a tie.
    .sort((a, b) => compareDreamFacets(a.total, a.theme, b.total, b.theme));

  const maxCount = series.reduce(
    (max, item) => item.counts.reduce((inner, value) => Math.max(inner, value), max),
    0,
  );

  return {
    points: Array.from(
      { length: pointCount },
      (_, index) => windowStart + index * bucketDays * DAY_IN_MS,
    ),
    series,
    // Observed span, not the requested window: five dreams inside one week must not clear a
    // 14-day threshold merely because '12 months' happens to be selected.
    spanDays: dayDiff(firstDay, lastDay) + 1,
    analyzedDreams,
    bucketDays,
    maxCount,
    maxSpanDays: period === 'all' ? null : STATS_PERIOD_DAYS[period],
  };
}

/**
 * Span the timeline needs before it will draw, capped to the requested window.
 * Uncapped, the 7-day period could never reach the 14-day minimum — the section would tell
 * the user to "keep going for 7 more days" forever, whatever their journal contained.
 */
function getThemeTrendRequiredSpan(trend: ThemeTrend): number {
  if (trend.maxSpanDays === null) return THEME_TREND_MIN_SPAN_DAYS;
  return Math.min(THEME_TREND_MIN_SPAN_DAYS, Math.max(1, trend.maxSpanDays));
}

type DreamPieDataItem = pieDataItem & {
  typeLabel: string;
  count: number;
  percentage: number;
  typeLines: string[];
  labelHeight: number;
};

type PieLabelLayout = {
  anchorX: number;
  anchorY: number;
  isRightHalf: boolean;
  labelCenterY: number;
  midAngle: number;
  item: DreamPieDataItem;
};

const distributeLabelsOnSide = (labels: PieLabelLayout[], chartHeight: number) => {
  if (labels.length === 0) return [];

  const sorted = labels
    .map((label) => ({ ...label }))
    .sort((a, b) => a.anchorY - b.anchorY);

  sorted.forEach((label, index) => {
    const previous = sorted[index - 1];
    const minCenterY =
      previous && previous.item
        ? previous.labelCenterY + previous.item.labelHeight / 2 + label.item.labelHeight / 2 + PIE_LABEL_VERTICAL_MARGIN
        : label.anchorY;

    const topBound = PIE_LABEL_VERTICAL_MARGIN + label.item.labelHeight / 2;
    label.labelCenterY = Math.max(label.anchorY, minCenterY, topBound);
  });

  const bottomLimit = chartHeight - PIE_LABEL_VERTICAL_MARGIN;
  const last = sorted[sorted.length - 1];
  const overflow = last.labelCenterY + last.item.labelHeight / 2 - bottomLimit;

  if (overflow > 0) {
    last.labelCenterY -= overflow;
    for (let i = sorted.length - 2; i >= 0; i -= 1) {
      const next = sorted[i + 1];
      const maxCenterY =
        next.labelCenterY - next.item.labelHeight / 2 - sorted[i].item.labelHeight / 2 - PIE_LABEL_VERTICAL_MARGIN;
      sorted[i].labelCenterY = Math.min(sorted[i].labelCenterY, maxCenterY);
    }
  }

  const first = sorted[0];
  const topOverflow = first.labelCenterY - first.item.labelHeight / 2 - PIE_LABEL_VERTICAL_MARGIN;
  if (topOverflow < 0) {
    sorted.forEach((label) => {
      label.labelCenterY -= topOverflow;
    });
  }

  return sorted;
};

const buildPieLabelLayouts = (data: DreamPieDataItem[], metrics: PieMetrics): PieLabelLayout[] => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (!total) return [];

  let accumulated = 0;
  const rawLayouts: PieLabelLayout[] = data.map((item) => {
    const sliceAngle = (item.value / total) * Math.PI * 2;
    const midAngle = accumulated + sliceAngle / 2;
    accumulated += sliceAngle;

    const anchorX = metrics.pieChartCenter + metrics.pieRadius * Math.sin(midAngle);
    const anchorY = metrics.pieChartCenter - metrics.pieRadius * Math.cos(midAngle);
    const isRightHalf = anchorX >= metrics.pieChartCenter;

    return {
      anchorX,
      anchorY,
      isRightHalf,
      labelCenterY: anchorY,
      midAngle,
      item,
    };
  });

  const left = distributeLabelsOnSide(
    rawLayouts.filter((layout) => !layout.isRightHalf),
    metrics.pieChartDimension,
  );
  const right = distributeLabelsOnSide(
    rawLayouts.filter((layout) => layout.isRightHalf),
    metrics.pieChartDimension,
  );

  return [...left, ...right];
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  noctalia: NoctaliaDesignTokens;
  valueTestID?: string;
}

function StatCard({ title, value, subtitle, noctalia, valueTestID }: StatCardProps) {
  const valueText = typeof value === 'number' ? String(value) : value;
  const accessibilityLabel = `${title}: ${valueText}`;

  return (
    <View style={styles.statCard}>
      <Text style={[styles.statTitle, { color: noctalia.text.secondary }]}>{title}</Text>
      <Text
        style={[styles.statValue, { color: noctalia.accent.base }]}
        testID={valueTestID}
        accessibilityLabel={accessibilityLabel}
      >
        {value}
      </Text>
      <View style={[styles.statValueUnderline, { backgroundColor: noctalia.accent.base }]} />
      {subtitle && <Text style={[styles.statSubtitle, { color: noctalia.text.tertiary }]}>{subtitle}</Text>}
    </View>
  );
}

// ─── Section Glass Wrapper ────────────────────────────────────────────────────

const SectionGlass = memo(function SectionGlass({
  children,
  noctalia,
  animationDelay = 0,
}: {
  children: React.ReactNode;
  noctalia: NoctaliaDesignTokens;
  animationDelay?: number;
}) {
  return (
    <StaticFlatGlassCard
      intensity="subtle"
      animationDelay={animationDelay}
      style={styles.sectionGlassCard}
    >
      <View style={[styles.sectionAccentStripe, { backgroundColor: noctalia.accent.base }]} />
      <View style={styles.sectionInner}>
        {children}
      </View>
    </StaticFlatGlassCard>
  );
});

type StatsRhythmSectionProps = {
  noctalia: NoctaliaDesignTokens;
  colors: ReturnType<typeof useTheme>['colors'];
  dreamsByDay: { weekday: number; count: number }[];
  weekdayLabels: string[];
  metrics: RhythmMetrics;
  t: ReturnType<typeof useTranslation>['t'];
  formatNumber: ReturnType<typeof useLocaleFormatting>['formatNumber'];
};

/**
 * "Rythme" (S1, free). Renders stats.dreamsByDay, which has been computed since day one and
 * shown nowhere (audit §3.3).
 *
 * Every colour prop below has a hard-coded library default of black, gray or lightgray
 * (gifted-charts-core/dist/utils/constants.js: BarDefaults.frontColor = 'black',
 * AxesAndRulesDefaults.xAxisColor / yAxisColor = 'black', rulesColor = 'lightgray'), and both
 * axis label styles fall through to React Native's own black Text default. This is the exact
 * trap that made the donut hole unreadable in dark mode (audit §6.1) — every one of them is
 * bound to a noctalia token, explicitly.
 */
const StatsRhythmSection = memo(function StatsRhythmSection({
  noctalia,
  colors,
  dreamsByDay,
  weekdayLabels,
  metrics,
  t,
  formatNumber,
}: StatsRhythmSectionProps) {
  const countLabel = (count: number) =>
    t(count === 1 ? 'stats.legend.count_one' : 'stats.legend.count', {
      count: formatNumber(count),
    });

  const axis = getIntegerAxis(
    dreamsByDay.reduce((max, entry) => Math.max(max, entry.count), 0),
  );

  const barData: barDataItem[] = dreamsByDay.map((entry) => ({
    value: entry.count,
    label: weekdayLabels[entry.weekday],
    frontColor: noctalia.accent.base,
  }));

  // Same contract as the pie: one accessible element carrying every number a sighted user
  // reads off the bars.
  const accessibilityLabel = [
    t('stats.section.dreams_by_day'),
    ...dreamsByDay.map(
      (entry) => `${weekdayLabels[entry.weekday]}: ${countLabel(entry.count)}`,
    ),
  ].join(', ');

  return (
    <SectionGlass noctalia={noctalia} animationDelay={SECTION_ANIMATION_DELAY.rhythm}>
      <SectionHeading
        title={t('stats.section.dreams_by_day')}
        icon="waveform"
        colors={colors}
      />
      <View style={styles.chartContainer}>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={accessibilityLabel}
          testID={TID.Component.StatsRhythmChart}
          style={styles.chartFrame}
        >
          <BarChart
            data={barData}
            width={metrics.plotWidth}
            height={RHYTHM_CHART_HEIGHT}
            barWidth={metrics.barWidth}
            spacing={metrics.spacing}
            initialSpacing={metrics.initialSpacing}
            endSpacing={metrics.endSpacing}
            barBorderTopLeftRadius={4}
            barBorderTopRightRadius={4}
            maxValue={axis.maxValue}
            noOfSections={axis.noOfSections}
            yAxisLabelWidth={RHYTHM_Y_AXIS_LABEL_WIDTH}
            // The wrapper always mounts a horizontal ScrollView; disabling it keeps 7 bars
            // from becoming draggable and stops it competing with the page scroll.
            disableScroll
            showScrollIndicator={false}
            // Defaults to false today; pinned so a library bump cannot start animating
            // inside the ScrollView.
            isAnimated={false}
            frontColor={noctalia.accent.base}
            backgroundColor="transparent"
            xAxisColor={noctalia.surface.border}
            yAxisColor={noctalia.surface.border}
            rulesColor={noctalia.surface.border}
            yAxisTextStyle={[styles.chartAxisLabel, { color: noctalia.text.tertiary }]}
            xAxisLabelTextStyle={[styles.chartXAxisLabel, { color: noctalia.text.secondary }]}
          />
        </View>
      </View>
    </SectionGlass>
  );
});

type StatsHeaderActionsRowProps = {
  actions: NoctaliaHeaderAction[];
  noctalia: NoctaliaDesignTokens;
};

/**
 * Desktop web keeps the centered PageHeader, which accepts no actions.
 * This row restores the period filter and the share action just below it.
 */
const StatsHeaderActionsRow = memo(function StatsHeaderActionsRow({
  actions,
  noctalia,
}: StatsHeaderActionsRowProps) {
  return (
    <View style={styles.desktopHeaderActions}>
      {actions.map((action) => (
        <Pressable
          key={action.testID ?? action.accessibilityLabel}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel}
          testID={action.testID}
          onPress={action.onPress}
          hitSlop={8}
          style={({ pressed }) => [
            styles.desktopHeaderActionButton,
            {
              backgroundColor: action.active ? noctalia.action.primary : noctalia.surface.soft,
              borderColor: action.active ? noctalia.action.primaryBorder : noctalia.surface.border,
            },
            pressed && styles.pressedButton,
          ]}
        >
          <IconSymbol
            name={action.icon}
            size={20}
            color={action.active ? noctalia.action.primaryText : noctalia.text.secondary}
          />
        </Pressable>
      ))}
    </View>
  );
});

type StatsInsightCardProps = {
  noctalia: NoctaliaDesignTokens;
  insight: ReturnType<typeof getDreamStatsInsight>;
  t: ReturnType<typeof useTranslation>['t'];
  formatPercent: ReturnType<typeof useLocaleFormatting>['formatPercent'];
  onPress: () => void;
};

const StatsInsightCard = memo(function StatsInsightCard({
  noctalia,
  insight,
  t,
  formatPercent,
  onPress,
}: StatsInsightCardProps) {
  const progressItems = [
    {
      id: 'analysis',
      label: t('stats.insight.metric.analysis'),
      value: formatPercent(insight.analysisRatio),
      ratio: insight.analysisRatio,
    },
    {
      id: 'exploration',
      label: t('stats.insight.metric.exploration'),
      value: formatPercent(insight.explorationRatio),
      ratio: insight.explorationRatio,
    },
    {
      id: 'streak',
      label: t('stats.insight.metric.streak'),
      value: formatPercent(insight.streakGoalRatio),
      ratio: insight.streakGoalRatio,
    },
  ];

  return (
    <StaticFlatGlassCard
      intensity="moderate"
      animationDelay={SECTION_ANIMATION_DELAY.insight}
      style={styles.insightCard}
      testID={TID.Component.StatsInsight}
    >
      <View style={[styles.insightAccent, { backgroundColor: noctalia.accent.base }]} />
      <View style={styles.insightInner}>
        <View style={styles.insightHeaderRow}>
          <View
            style={[
              styles.insightIconWrap,
              {
                backgroundColor: noctalia.surface.soft,
              },
            ]}
          >
            <IconSymbol
              name={STATS_INSIGHT_ICON[insight.kind]}
              size={22}
              color={noctalia.accent.base}
            />
          </View>
          <View style={styles.insightCopy}>
            <Text style={[styles.insightEyebrow, { color: noctalia.accent.base }]}>
              {t('stats.insight.eyebrow')}
            </Text>
            <Text style={[styles.insightTitle, { color: noctalia.text.primary }]}>
              {t(insight.titleKey)}
            </Text>
            <Text style={[styles.insightBody, { color: noctalia.text.secondary }]}>
              {t(insight.bodyKey)}
            </Text>
          </View>
        </View>

        <View style={styles.insightProgressGrid}>
          {progressItems.map((item) => (
            <View
              key={item.id}
              style={[
                styles.insightProgressItem,
                {
                  borderColor: noctalia.surface.border,
                  backgroundColor: noctalia.surface.soft,
                },
              ]}
            >
              <View style={styles.insightMetricRow}>
                <Text style={[styles.insightMetricLabel, { color: noctalia.text.secondary }]}>
                  {item.label}
                </Text>
                <Text style={[styles.insightMetricValue, { color: noctalia.text.primary }]}>
                  {item.value}
                </Text>
              </View>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel={item.label}
                accessibilityValue={{
                  min: 0,
                  max: 100,
                  now: Math.round(clamp(item.ratio, 0, 1) * 100),
                  text: item.value,
                }}
                style={[
                  styles.insightTrack,
                  {
                    backgroundColor: noctalia.surface.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.insightFill,
                    {
                      width: `${Math.max(5, item.ratio * 100)}%`,
                      backgroundColor: noctalia.accent.base,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(insight.ctaKey)}
          testID={TID.Button.StatsInsightCta}
          onPress={onPress}
          style={({ pressed }) => [
            styles.insightButton,
            { backgroundColor: noctalia.action.primary },
            pressed && styles.pressedButton,
          ]}
        >
          <Text style={[styles.insightButtonText, { color: noctalia.action.primaryText }]}>
            {t(insight.ctaKey)}
          </Text>
          <IconSymbol name="arrow.right" size={16} color={noctalia.action.primaryText} />
        </Pressable>
      </View>
    </StaticFlatGlassCard>
  );
});

type DreamProfileCardProps = {
  noctalia: NoctaliaDesignTokens;
  profile: DreamProfile;
  t: ReturnType<typeof useTranslation>['t'];
  formatNumber: ReturnType<typeof useLocaleFormatting>['formatNumber'];
  canShowPremiumSignals: boolean;
  onPress: () => void;
  onUpgradePress: () => void;
};

const DreamProfileCard = memo(function DreamProfileCard({
  noctalia,
  profile,
  t,
  formatNumber,
  canShowPremiumSignals,
  onPress,
  onUpgradePress,
}: DreamProfileCardProps) {
  const topType = profile.topTypes[0];
  const topTheme = profile.topThemes[0];
  const topFragment = profile.topFragments[0];
  const topPeriod = profile.topPeriods[0];
  const topTypeLabel = topType
    ? getDreamTypeLabel(topType.value, t) ?? topType.value
    : t('stats.profile.signal.none');
  const topThemeLabel = topTheme
    ? (() => {
        const key = `stats.theme.${topTheme.value}`;
        const label = t(key);
        return label === key ? topTheme.value : label;
      })()
    : t('stats.profile.signal.none');
  const topFragmentLabel = topFragment
    ? t(`stats.profile.fragment.${topFragment.value}`)
    : t('stats.profile.signal.none');
  const topPeriodLabel = topPeriod
    ? t(`stats.profile.period.${topPeriod.value}`)
    : t('stats.profile.signal.none');
  const profileMetrics = [
    {
      id: 'anchor',
      label: t('stats.profile.metric.anchor'),
      value: formatNumber(profile.anchorDreams),
    },
    {
      id: 'remembered',
      label: t('stats.profile.metric.remembered'),
      value: formatNumber(profile.rememberedDreams),
    },
    {
      id: 'recurring',
      label: t('stats.profile.metric.recurring'),
      value: formatNumber(profile.recurringDreams),
    },
    {
      id: 'explored',
      label: t('stats.profile.metric.explored'),
      value: formatNumber(profile.exploredDreams),
    },
  ];
  const signalItems = [
    {
      id: 'type',
      label: t('stats.profile.signal.type'),
      value: topTypeLabel,
    },
    {
      id: 'theme',
      label: t('stats.profile.signal.theme'),
      value: topThemeLabel,
    },
    {
      id: 'fragment',
      label: t('stats.profile.signal.fragment'),
      value: topFragmentLabel,
    },
    {
      id: 'period',
      label: t('stats.profile.signal.period'),
      value: topPeriodLabel,
    },
  ];

  return (
    <StaticFlatGlassCard
      intensity="moderate"
      animationDelay={SECTION_ANIMATION_DELAY.profile}
      style={styles.profileCard}
      testID={TID.Component.DreamProfileCard}
    >
      <View style={[styles.profileAccent, { backgroundColor: noctalia.accent.base }]} />
      <View style={styles.profileInner}>
        <View style={styles.profileHeaderRow}>
          <View
            style={[
              styles.profileIconWrap,
              {
                backgroundColor: noctalia.surface.soft,
              },
            ]}
          >
            <IconSymbol name="brain" size={23} color={noctalia.accent.base} />
          </View>
          <View style={styles.profileCopy}>
            <Text style={[styles.profileEyebrow, { color: noctalia.accent.base }]}>
              {t('stats.profile.eyebrow')}
            </Text>
            <Text style={[styles.profileTitle, { color: noctalia.text.primary }]}>
              {t('stats.profile.title')}
            </Text>
            <Text style={[styles.profileBody, { color: noctalia.text.secondary }]}>
              {t(`stats.profile.readiness.${profile.readiness}.body`)}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.profileReadinessPill,
            {
              backgroundColor: noctalia.surface.soft,
              borderColor: noctalia.surface.borderStrong,
            },
          ]}
        >
          <IconSymbol
            name={profile.hasEnoughForPatterns ? 'checkmark.circle.fill' : 'hourglass'}
            size={16}
            color={noctalia.accent.base}
          />
          <Text style={[styles.profileReadinessText, { color: noctalia.text.primary }]}>
            {t(`stats.profile.readiness.${profile.readiness}.label`)}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(`stats.profile.next_action.${profile.nextAction}.cta`)}
          testID={TID.Button.DreamProfileCta}
          onPress={onPress}
          style={({ pressed }) => [
            styles.profileButton,
            { backgroundColor: noctalia.action.primary },
            pressed && styles.pressedButton,
          ]}
        >
          <Text style={[styles.profileButtonText, { color: noctalia.action.primaryText }]}>
            {t(`stats.profile.next_action.${profile.nextAction}.cta`)}
          </Text>
          <IconSymbol name="arrow.right" size={16} color={noctalia.action.primaryText} />
        </Pressable>

        <View style={styles.profileMetricGrid}>
          {profileMetrics.map((metric) => (
            <View
              key={metric.id}
              style={[
                styles.profileMetric,
                {
                  backgroundColor: noctalia.surface.soft,
                  borderColor: noctalia.surface.border,
                },
              ]}
            >
              <Text style={[styles.profileMetricValue, { color: noctalia.text.primary }]}>
                {metric.value}
              </Text>
              <Text style={[styles.profileMetricLabel, { color: noctalia.text.secondary }]}>
                {metric.label}
              </Text>
            </View>
          ))}
        </View>

        {canShowPremiumSignals ? (
          <View style={styles.profileSignalGrid}>
            {signalItems.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.profileSignal,
                  {
                    borderColor: noctalia.surface.border,
                    backgroundColor: noctalia.surface.soft,
                  },
                ]}
              >
                <Text style={[styles.profileSignalLabel, { color: noctalia.text.secondary }]}>
                  {item.label}
                </Text>
                <Text style={[styles.profileSignalValue, { color: noctalia.text.primary }]} numberOfLines={2}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View
            style={[
            styles.profilePlusPreview,
            {
                borderColor: noctalia.surface.borderStrong,
                backgroundColor: noctalia.surface.soft,
            },
          ]}
            testID={TID.Component.DreamProfilePlusPreview}
          >
            <View style={styles.profilePlusPreviewHeader}>
              <IconSymbol name="lock.fill" size={16} color={noctalia.accent.base} />
              <Text style={[styles.profilePlusPreviewTitle, { color: noctalia.text.primary }]}>
                {t('stats.profile.plus_preview.title')}
              </Text>
            </View>
            <Text style={[styles.profilePlusPreviewBody, { color: noctalia.text.secondary }]}>
              {t('stats.profile.plus_preview.body')}
            </Text>
            <View style={styles.profileSignalGrid}>
              {signalItems.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.profileSignal,
                    {
                      borderColor: noctalia.surface.border,
                      backgroundColor: noctalia.surface.raised,
                    },
                  ]}
                >
                  <Text style={[styles.profileSignalLabel, { color: noctalia.text.secondary }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.profileSignalLockedValue, { color: noctalia.accent.base }]} numberOfLines={1}>
                    {t('stats.profile.plus_preview.locked_value')}
                  </Text>
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('stats.profile.plus_preview.cta')}
              testID={TID.Button.DreamProfileUpgradeCta}
              onPress={onUpgradePress}
              style={({ pressed }) => [
                styles.profileUpgradeButton,
                { borderColor: noctalia.surface.borderStrong },
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={[styles.profileUpgradeButtonText, { color: noctalia.accent.base }]}>
                {t('stats.profile.plus_preview.cta')}
              </Text>
              <IconSymbol name="arrow.right" size={15} color={noctalia.accent.base} />
            </Pressable>
          </View>
        )}
      </View>
    </StaticFlatGlassCard>
  );
});

type StatsEmotionsSectionProps = {
  noctalia: NoctaliaDesignTokens;
  colors: ReturnType<typeof useTheme>['colors'];
  profile: EmotionProfile;
  rows: StatsRankedRow[];
  maxCount: number;
  canShowFamilies: boolean;
  t: ReturnType<typeof useTranslation>['t'];
  formatNumber: ReturnType<typeof useLocaleFormatting>['formatNumber'];
  onUpgradePress: () => void;
};

/**
 * "Émotions dominantes" (S2, Plus). The section this phase exists for: it replaces one of the
 * four identical "Insight Plus" cartouches the audit §7.1 condemned — zero information scent,
 * hiding values that were free two sections below — with a gate that states a real, computed
 * number and locks only the detail.
 *
 * Three states behind one heading, in THIS order. Threshold first, tier second:
 *   below threshold -> StatsNotEnoughData, naming how many more dreams are needed
 *   free            -> StatsLockedSection: "N emotions keep coming back", detail locked
 *   Plus            -> StatsRankedList, the SAME component Top themes renders
 * Reversing the two checks would show a subscriber a locked card, and would show a free user
 * "0 emotions keep coming back" — strictly worse than the cartouche this replaces.
 *
 * The list is unsliced. `stats.emotions.locked.count` promises `profile.distinctFamilies`;
 * the unlocked state must deliver exactly that many rows or the gate is a lie.
 */
const StatsEmotionsSection = memo(function StatsEmotionsSection({
  noctalia,
  colors,
  profile,
  rows,
  maxCount,
  canShowFamilies,
  t,
  formatNumber,
  onUpgradePress,
}: StatsEmotionsSectionProps) {
  const heading = (
    <SectionHeading
      title={t('stats.section.emotion_families')}
      subtitle={t('stats.section.emotion_families.subtitle')}
      icon="heart.fill"
      colors={colors}
    />
  );

  if (!profile.hasEnoughDreams) {
    return (
      <SectionGlass noctalia={noctalia} animationDelay={SECTION_ANIMATION_DELAY.emotions}>
        {heading}
        <StatsNotEnoughData
          noctalia={noctalia}
          title={t('stats.not_enough.title')}
          body={t(
            profile.dreamsUntilReady === 1
              ? 'stats.emotions.not_enough.body_one'
              : 'stats.emotions.not_enough.body',
            { count: formatNumber(profile.dreamsUntilReady) },
          )}
          testID={TID.Component.StatsEmotionsNotEnough}
        />
      </SectionGlass>
    );
  }

  if (!canShowFamilies) {
    return (
      <SectionGlass noctalia={noctalia} animationDelay={SECTION_ANIMATION_DELAY.emotions}>
        {heading}
        <StatsLockedSection
          noctalia={noctalia}
          countLabel={t(
            profile.distinctFamilies === 1
              ? 'stats.emotions.locked.count_one'
              : 'stats.emotions.locked.count',
            { count: formatNumber(profile.distinctFamilies) },
          )}
          bodyLabel={t('stats.emotions.locked.body')}
          ctaLabel={t('stats.locked.cta')}
          // Decorative ramp, capped at 5. The bars carry no count semantics — the line above
          // them does — so this cap never contradicts `distinctFamilies`.
          previewRows={profile.families
            .slice(0, EMOTION_LOCKED_PREVIEW_ROWS)
            .map((item, index) => ({
              id: item.family,
              ratio: 1 - index * LOCKED_PREVIEW_RATIO_STEP,
            }))}
          onPress={onUpgradePress}
          testID={TID.Component.StatsEmotionsLocked}
          ctaTestID={TID.Button.StatsEmotionsUpgradeCta}
        />
      </SectionGlass>
    );
  }

  return (
    <SectionGlass noctalia={noctalia} animationDelay={SECTION_ANIMATION_DELAY.emotions}>
      {heading}
      <StatsRankedList
        noctalia={noctalia}
        rows={rows}
        maxCount={maxCount}
        testID={TID.Component.StatsEmotions}
      />
    </SectionGlass>
  );
});

type StatsThemeTrendSectionProps = {
  noctalia: NoctaliaDesignTokens;
  colors: ReturnType<typeof useTheme>['colors'];
  trend: ThemeTrend;
  metrics: ThemeTrendMetrics;
  canShowChart: boolean;
  t: ReturnType<typeof useTranslation>['t'];
  formatNumber: ReturnType<typeof useLocaleFormatting>['formatNumber'];
  formatDate: ReturnType<typeof useLocaleFormatting>['formatDate'];
  onUpgradePress: () => void;
};

/**
 * "Themes over time" (S3, Plus). Three states inside one section, so the heading always has a
 * place on the page:
 *   - below threshold  -> StatsNotEnoughData, naming what is still missing
 *   - free             -> StatsLockedSection: the real count, a locked shape
 *   - Plus             -> the curve
 *
 * Colour defaults handled the same way as S1. LineChart adds one more trap worth naming:
 * LineDefaults.endFillColor is literally 'white' — the same defect as the donut's
 * innerCircleColor. It is inert only because areaChart stays off. Do not enable areaChart
 * without setting startFillColor AND endFillColor.
 *
 * The legend and the accessible label read `dream.theme.*` ("Calme"), not the glossed
 * `stats.theme.*` ("Calme (doux, rassurant)") that Top themes uses: the gloss is sized for a
 * list row, not a chart chip.
 */
const StatsThemeTrendSection = memo(function StatsThemeTrendSection({
  noctalia,
  colors,
  trend,
  metrics,
  canShowChart,
  t,
  formatNumber,
  formatDate,
  onUpgradePress,
}: StatsThemeTrendSectionProps) {
  const countLabel = (count: number) =>
    t(count === 1 ? 'stats.legend.count_one' : 'stats.legend.count', {
      count: formatNumber(count),
    });
  const themeColor = (theme: DreamTheme) => colors.tags[theme];

  const requiredSpan = getThemeTrendRequiredSpan(trend);
  const hasEnoughData =
    trend.spanDays >= requiredSpan &&
    trend.analyzedDreams >= THEME_TREND_MIN_ANALYZED_DREAMS;

  const heading = (
    <SectionHeading
      title={t('stats.section.theme_timeline')}
      subtitle={t('stats.section.theme_timeline.subtitle')}
      icon="chart.line.uptrend.xyaxis"
      colors={colors}
    />
  );

  if (!hasEnoughData) {
    // Dreams before days: it is the actionable one.
    const missingDreams = THEME_TREND_MIN_ANALYZED_DREAMS - trend.analyzedDreams;
    const missingDays = requiredSpan - trend.spanDays;
    const body =
      missingDreams > 0
        ? t(
            missingDreams === 1
              ? 'stats.theme_timeline.not_enough.dreams_one'
              : 'stats.theme_timeline.not_enough.dreams',
            { count: formatNumber(missingDreams) },
          )
        : t(
            missingDays === 1
              ? 'stats.theme_timeline.not_enough.days_one'
              : 'stats.theme_timeline.not_enough.days',
            { count: formatNumber(missingDays) },
          );

    return (
      <SectionGlass noctalia={noctalia} animationDelay={SECTION_ANIMATION_DELAY.themeTrend}>
        {heading}
        <StatsNotEnoughData
          noctalia={noctalia}
          title={t('stats.not_enough.title')}
          body={body}
          testID={TID.Component.StatsThemeTrendNotEnough}
        />
      </SectionGlass>
    );
  }

  if (!canShowChart) {
    return (
      <SectionGlass noctalia={noctalia} animationDelay={SECTION_ANIMATION_DELAY.themeTrend}>
        {heading}
        <StatsLockedSection
          noctalia={noctalia}
          countLabel={t(
            trend.series.length === 1
              ? 'stats.theme_timeline.locked.count_one'
              : 'stats.theme_timeline.locked.count',
            {
              count: formatNumber(trend.series.length),
              days: formatNumber(trend.spanDays),
            },
          )}
          bodyLabel={t('stats.theme_timeline.locked.body')}
          ctaLabel={t('stats.locked.cta')}
          // Decorative ramp, never the real proportions: the count is the honest part, the
          // shape is not the answer. Same step as S2 so the two locked cards cannot drift.
          previewRows={trend.series.map((item, index) => ({
            id: item.theme,
            ratio: 1 - index * LOCKED_PREVIEW_RATIO_STEP,
          }))}
          onPress={onUpgradePress}
          testID={TID.Component.StatsThemeTrendLocked}
          ctaTestID={TID.Button.StatsThemeTrendUpgradeCta}
        />
      </SectionGlass>
    );
  }

  const axis = getIntegerAxis(trend.maxCount);
  const hideDataPoints = trend.points.length > THEME_TREND_HIDE_POINTS_ABOVE;
  const labelStride = Math.max(1, Math.ceil(trend.points.length / THEME_TREND_MAX_X_LABELS));
  // With `dataSet`, the wrapper reads x labels from dataSet[0].data (LineChart/index.js:1121,
  // `(data0 ?? data).map`). Chart-level xAxisLabelTexts is consulted per index for those same
  // items, which is the only way to label a multi-series chart without coupling the labels to
  // whichever theme happens to rank first.
  const xAxisLabelTexts = trend.points.map((timestamp, index) =>
    index % labelStride === 0 ? formatDate(timestamp, TREND_LABEL_OPTIONS) : '',
  );

  const dataSet: DataSet[] = trend.series.map((item) => ({
    data: item.counts.map((value) => ({ value })),
    color: themeColor(item.theme),
    dataPointsColor: themeColor(item.theme),
    hideDataPoints,
  }));

  const rangeLabel = t('stats.theme_timeline.a11y_range', {
    from: formatDate(trend.points[0], TREND_LABEL_OPTIONS),
    to: formatDate(trend.points[trend.points.length - 1], TREND_LABEL_OPTIONS),
  });
  const accessibilityLabel = [
    t('stats.section.theme_timeline'),
    ...trend.series.map(
      (item) =>
        `${getDreamThemeLabel(item.theme, t) ?? item.theme}: ${countLabel(item.total)}, ${rangeLabel}`,
    ),
  ].join(', ');

  return (
    <SectionGlass noctalia={noctalia} animationDelay={SECTION_ANIMATION_DELAY.themeTrend}>
      {heading}
      <View style={styles.chartContainer}>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={accessibilityLabel}
          testID={TID.Component.StatsThemeTrendChart}
          style={styles.chartFrame}
        >
          <LineChart
            dataSet={dataSet}
            width={metrics.plotWidth}
            height={THEME_TREND_CHART_HEIGHT}
            spacing={metrics.spacing}
            initialSpacing={metrics.initialSpacing}
            endSpacing={metrics.endSpacing}
            thickness={2}
            dataPointsRadius={2.5}
            maxValue={axis.maxValue}
            noOfSections={axis.noOfSections}
            yAxisLabelWidth={THEME_TREND_Y_AXIS_LABEL_WIDTH}
            xAxisLabelTexts={xAxisLabelTexts}
            disableScroll
            showScrollIndicator={false}
            isAnimated={false}
            // Per-series colours are on the dataSet; these are the fallbacks the library
            // would otherwise resolve to 'black' / 'black' / 'gray'.
            color={noctalia.accent.base}
            dataPointsColor={noctalia.accent.base}
            textColor={noctalia.text.tertiary}
            backgroundColor="transparent"
            xAxisColor={noctalia.surface.border}
            yAxisColor={noctalia.surface.border}
            rulesColor={noctalia.surface.border}
            yAxisTextStyle={[styles.chartAxisLabel, { color: noctalia.text.tertiary }]}
            xAxisLabelTextStyle={[styles.chartXAxisLabel, { color: noctalia.text.secondary }]}
          />
        </View>
        <View style={styles.legendContainer} testID={TID.Component.StatsThemeTrendLegend}>
          {trend.series.map((item) => (
            <View
              key={item.theme}
              style={[styles.legendItem, { backgroundColor: noctalia.surface.soft }]}
            >
              <View style={[styles.legendColor, { backgroundColor: themeColor(item.theme) }]} />
              <Text style={[styles.legendText, { color: noctalia.text.primary }]}>
                {getDreamThemeLabel(item.theme, t) ?? item.theme} ({countLabel(item.total)})
              </Text>
            </View>
          ))}
        </View>
      </View>
    </SectionGlass>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StatisticsScreen() {
  const { dreams, loaded } = useDreams();
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { width, height } = useWindowDimensions();
  const scrollPerf = useScrollIdle();
  const { user, loading: authLoading } = useAuth();
  const {
    isActive: isPlusActive,
    status: subscriptionStatus,
    loading: subscriptionLoading,
  } = useSubscription();
  useClearWebFocus();
  const { formatDate, formatNumber, formatPercent } = useLocaleFormatting();
  const [selectedStatsPeriod, setSelectedStatsPeriod] = useState<StatsPeriod>('all');
  const [showStatsPeriodSheet, setShowStatsPeriodSheet] = useState(false);
  const periodDreams = useMemo(
    () => filterDreamsByStatsPeriod(dreams, selectedStatsPeriod),
    [dreams, selectedStatsPeriod],
  );
  const isPeriodFiltered = selectedStatsPeriod !== 'all';
  const stats = useDreamStatistics(periodDreams);
  const isDesktopLayout = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
  const navigationLayout = getBottomNavigationLayout(width, height);
  const scrollBottomPadding = isDesktopLayout
    ? ThemeLayout.spacing.xl
    : navigationLayout.barHeight
      + navigationLayout.minimumBottomInset
      + ThemeLayout.spacing.lg;
  // Hoisted above the memos that read it: `themeTrend` and `emotionProfile` are both gated on
  // it, and a `useState` declared further down would be a use-before-declaration.
  const [showDeferredSections, setShowDeferredSections] = useState(false);
  const pieMetrics = useMemo(() => getPieMetrics(width), [width]);
  const rhythmMetrics = useMemo(
    () => getRhythmMetrics(width, stats.dreamsByDay.length),
    [stats.dreamsByDay.length, width],
  );
  // Deferred on purpose: the section is behind `showDeferredSections`, and gating the memo
  // keeps the aggregation off the first frame the way the three existing deferred sections
  // keep their render off it (audit §5.7).
  const themeTrend = useMemo(
    () =>
      showDeferredSections
        ? buildThemeTrend(periodDreams, selectedStatsPeriod)
        : EMPTY_THEME_TREND,
    [periodDreams, selectedStatsPeriod, showDeferredSections],
  );
  const themeTrendMetrics = useMemo(
    () => getThemeTrendMetrics(width, themeTrend.points.length),
    [themeTrend.points.length, width],
  );
  // Period-scoped, like every other number on the page (audit P1-7): the profile describes
  // the active window, not the whole journal — the same rule `dreamProfile` follows. Deferred
  // for the same reason the theme trend is: it keeps the ~975-fragment lexicon index off the
  // first frame. Built by calling the real builder with `[]` while gated, so the neutral
  // profile cannot drift from the type.
  const emotionProfile = useMemo(
    () => buildEmotionProfile(showDeferredSections ? periodDreams : []),
    [periodDreams, showDeferredSections],
  );
  const maxEmotionCount = useMemo(
    () => Math.max(...emotionProfile.families.map((item) => item.count), 1),
    [emotionProfile.families],
  );
  // UNSLICED on purpose. The locked state sells `distinctFamilies`; if the unlocked list
  // showed fewer rows than the number the free user was shown, the gate would be a lie.
  // The ceiling is 12 by construction — the fixed family set.
  const emotionRows = useMemo<StatsRankedRow[]>(
    () =>
      emotionProfile.families.map((item) => ({
        id: item.family,
        label: getEmotionFamilyLabel(item.family, t) ?? item.family,
        countLabel: t(item.count === 1 ? 'stats.legend.count_one' : 'stats.legend.count', {
          count: formatNumber(item.count),
        }),
        count: item.count,
      })),
    [emotionProfile.families, formatNumber, t],
  );
  // The only consumer of `coverage`. The lexicon is data and it rots when the analysis prompt
  // or the model's vocabulary drifts; coverage falling is the only symptom, and it is silent.
  // __DEV__ only, RATIO only — never `unmatched.samples`, and never to analytics.
  useEffect(() => {
    if (!__DEV__) return;
    if (emotionProfile.totalMentions < EMOTION_COVERAGE_ALERT_MENTIONS) return;
    if (emotionProfile.coverage >= EMOTION_COVERAGE_ALERT_RATIO) return;
    console.warn(
      `[StatisticsScreen] Emotion lexicon coverage ${Math.round(
        emotionProfile.coverage * 100,
      )}% over ${emotionProfile.totalMentions} mentions`,
    );
  }, [emotionProfile.coverage, emotionProfile.totalMentions]);
  // Journal-wide profile. Only the analytics payload reads it: `stats_screen_viewed`
  // pairs `profile_readiness` with an unfiltered `dream_count_bucket`, so both
  // properties must describe the whole journal or the event mixes two scales.
  const journalDreamProfile = useMemo(() => buildDreamProfile(dreams), [dreams]);
  // Visible profile follows the active period (audit P1-7): the card, its signals and
  // its next action must describe the same window as every other number on the page.
  // Unfiltered, it reuses the journal-wide object, so the default period still costs
  // exactly one pass over the dreams.
  const dreamProfile = useMemo(
    () => (isPeriodFiltered ? buildDreamProfile(periodDreams) : journalDreamProfile),
    [isPeriodFiltered, journalDreamProfile, periodDreams],
  );
  const statsInsight = useMemo(() => getDreamStatsInsight(stats), [stats]);
  // Visibility is journal-wide on purpose; only the numbers inside the cards follow the
  // period. Scoping the gates to the window too (first pass at P1-7) hid the Dream Profile
  // and the next-best-action together as soon as the selected period held nothing but
  // unanalysed, non-remembered dreams — i.e. exactly when "analyse your pending dreams" is
  // the most actionable advice, and, for a free account, the screen's only paywall entry.
  const journalHasAnalysis = useMemo(() => dreams.some(isDreamAnalyzed), [dreams]);
  const journalHasDreamProfileSeed =
    journalDreamProfile.hasAnchorDream || journalDreamProfile.rememberedDreams > 0;
  const showDreamProfileSection = journalHasAnalysis || journalHasDreamProfileSeed;
  const canShowDreamProfileSignals = isPlusActive;
  const supabaseTier = useMemo(() => deriveUserTier(user), [user]);
  // Same ladder as `analysis_started` (hooks/useDreamJournal.ts): a signed-out visitor is a
  // 'guest', never a 'free' account. `subscriptionStatus` stays null for the whole guest
  // session, so `status?.tier ?? 'free'` silently merged both cohorts into one.
  const analyticsTier = useMemo<SubscriptionTier>(() => {
    if (!user) return 'guest';
    // Supabase already flags paid users; RevenueCat still overrides once it resolves.
    const optimisticPaidTier = supabaseTier === 'plus' ? supabaseTier : null;
    return subscriptionStatus?.tier ?? optimisticPaidTier ?? 'free';
  }, [subscriptionStatus?.tier, supabaseTier, user]);
  const handleAddDreamPress = useCallback(() => {
    router.push(DREAM_PROFILE_NEXT_ROUTE.add_anchor);
  }, []);
  const handleDreamProfilePress = useCallback(() => {
    void trackProductEvent('stats_cta_clicked', {
      cta: 'dream_profile',
      action: dreamProfile.nextAction,
    });
    router.push(DREAM_PROFILE_NEXT_ROUTE[dreamProfile.nextAction]);
  }, [dreamProfile.nextAction]);
  const handleDreamProfileUpgradePress = useCallback(() => {
    void trackProductEvent('stats_cta_clicked', {
      cta: 'plus_upgrade',
      action: 'unlock_signals',
    });
    router.push(buildPaywallHref('stats_profile'));
  }, []);
  const handleStatsInsightPress = useCallback(() => {
    void trackProductEvent('stats_cta_clicked', {
      cta: 'next_best_action',
      action: statsInsight.kind,
    });
    router.push(statsInsight.route);
  }, [statsInsight.kind, statsInsight.route]);
  const handleOpenStatsPeriodSheet = useCallback(() => {
    setShowStatsPeriodSheet(true);
  }, []);
  const handleResetStatsPeriod = useCallback(() => {
    setSelectedStatsPeriod('all');
    setShowStatsPeriodSheet(false);
  }, []);
  // Hoisted so the null check narrows inside the callback: TypeScript does not keep a
  // property-access narrowing (`stats.mostDiscussedDream`) across a function boundary.
  const mostDiscussedDreamId = stats.mostDiscussedDream?.id ?? null;
  const handleMostDiscussedDreamPress = useCallback(() => {
    if (mostDiscussedDreamId == null) {
      return;
    }
    router.push(`/journal/${mostDiscussedDreamId}`);
  }, [mostDiscussedDreamId]);
  const selectedPeriodLabel = useMemo(() => {
    const option = STATS_PERIOD_OPTIONS.find((item) => item.id === selectedStatsPeriod);
    return t(option?.labelKey ?? 'stats.period.all');
  }, [selectedStatsPeriod, t]);
  const handleShareStats = useCallback(async () => {
    const streakLabel = `${formatNumber(stats.currentStreak)} ${
      stats.currentStreak === 1 ? t('stats.card.day') : t('stats.card.days')
    }`;
    const message = t('stats.share.message', {
      period: selectedPeriodLabel,
      total: formatNumber(stats.totalDreams),
      favorites: formatNumber(stats.favoriteDreams),
      analyzed: formatNumber(stats.analyzedDreams),
      explored: formatNumber(stats.dreamsWithChat),
      streak: streakLabel,
    });

    try {
      const result = await Share.share({
        title: t('stats.share.title'),
        message,
      });
      void trackProductEvent('stats_shared', {
        period: selectedStatsPeriod,
        outcome: result?.action === 'dismissedAction' ? 'dismissed' : 'shared',
      });
    } catch (error) {
      void trackProductEvent('stats_shared', { period: selectedStatsPeriod, outcome: 'failed' });
      if (__DEV__) {
        console.error('[StatisticsScreen] Failed to share stats', error);
      }
    }
  }, [formatNumber, selectedPeriodLabel, selectedStatsPeriod, stats, t]);

  const [showAnimations, setShowAnimations] = useState(false);
  const [statsFocusEpoch, setStatsFocusEpoch] = useState(0);
  const statsViewTrackedEpochRef = useRef(0);
  const hasStatisticsContent = loaded && periodDreams.length > 0;
  // Unfiltered on purpose: with no dream at all there is nothing to filter, but as soon
  // as the journal holds one the period control must stay reachable — including from
  // inside an empty period, where it is the only way back. Share is gated separately on
  // `hasStatisticsContent` inside `statsHeaderActions`.
  const showHeaderActions = loaded && dreams.length > 0;

  useFocusEffect(
    useCallback(() => {
      setShowAnimations(true);
      setStatsFocusEpoch((value) => value + 1);
      return () => setShowAnimations(false);
    }, []),
  );

  useEffect(() => {
    if (!loaded || statsFocusEpoch === 0) return;
    // Hold the emit until both sources of `analyticsTier` have settled, otherwise a Plus
    // user whose entitlement has not resolved yet is stamped 'free' and the epoch guard
    // below suppresses the corrected re-run. The guard is only armed once we really emit,
    // so waiting here costs nothing and keeps the once-per-focus semantics intact.
    if (authLoading || subscriptionLoading) return;
    if (statsViewTrackedEpochRef.current === statsFocusEpoch) return;
    statsViewTrackedEpochRef.current = statsFocusEpoch;
    void trackProductEvent('stats_screen_viewed', {
      tier: analyticsTier,
      dream_count_bucket: getStatsDreamCountBucket(dreams.length),
      profile_readiness: journalDreamProfile.readiness,
    });
  }, [
    analyticsTier,
    authLoading,
    dreams.length,
    journalDreamProfile.readiness,
    loaded,
    statsFocusEpoch,
    subscriptionLoading,
  ]);

  useEffect(() => {
    if (!hasStatisticsContent) {
      setShowDeferredSections(false);
      return;
    }

    setShowDeferredSections(false);
    const task = InteractionManager.runAfterInteractions(() => {
      setShowDeferredSections(true);
    });

    return () => {
      task.cancel?.();
    };
  }, [hasStatisticsContent]);

  // Memoize color arrays to avoid re-allocation churn
  const dreamTypeColors = useMemo(() =>
    [
      noctalia.accent.base,
      colors.tags.calm,
      colors.tags.mystical,
      colors.tags.noir,
      colors.tags.surreal,
    ],
    [colors.tags.calm, colors.tags.mystical, colors.tags.noir, colors.tags.surreal, noctalia.accent.base]
  );

  // Memoize label config - depends on chart sizing + text token
  const pieLabelLineConfig: LabelLineConfig = useMemo(() => ({
    length: pieMetrics.pieLabelLineLength,
    tailLength: pieMetrics.pieLabelTailLength,
    color: noctalia.text.secondary,
    thickness: 1,
    labelComponentWidth: pieMetrics.pieLabelWidth,
    labelComponentHeight: PIE_LABEL_HEIGHT,
    labelComponentMargin: PIE_LABEL_VERTICAL_MARGIN,
    avoidOverlappingOfLabels: true,
  }), [
    noctalia.text.secondary,
    pieMetrics.pieLabelLineLength,
    pieMetrics.pieLabelTailLength,
    pieMetrics.pieLabelWidth,
  ]);

  // Locale-aware weekday abbreviations, no new i18n keys. Indexed by weekday number so the
  // labels cannot drift out of step with ORDERED_WEEKDAYS in useDreamStatistics.
  const weekdayLabels = useMemo(
    () =>
      WEEKDAY_REFERENCE_BY_DAY.map((timestamp) =>
        formatDate(timestamp, WEEKDAY_LABEL_OPTIONS),
      ),
    [formatDate],
  );

  const topDreamTypes = useMemo(() => stats.dreamTypeDistribution.slice(0, 5), [stats.dreamTypeDistribution]);

  // Memoize heavy pie chart data computation
  const pieChartData: DreamPieDataItem[] = useMemo(() =>
    topDreamTypes.map((item, index) => {
      const typeLabel = getDreamTypeLabel(item.type as DreamType, t) ?? item.type;
      const typeLines = splitLabelText(typeLabel, {
        maxCharsPerLine: MAX_LABEL_CHARS_PER_LINE,
        maxLines: MAX_LABEL_LINES,
      });
      const labelHeight = getLabelHeight(typeLines.length);

      return {
        value: item.count,
        color: dreamTypeColors[index % dreamTypeColors.length],
        count: item.count,
        percentage: item.percentage,
        typeLabel,
        typeLines,
        labelHeight,
        labelLineConfig: {
          ...pieLabelLineConfig,
          labelComponentHeight: labelHeight,
        },
      };
    }),
    [topDreamTypes, dreamTypeColors, pieLabelLineConfig, t]
  );

  const pieLabelLayouts = useMemo(
    () => buildPieLabelLayouts(pieChartData, pieMetrics),
    [pieChartData, pieMetrics],
  );

  // Screen readers get the same summary a sighted user reads off the callouts.
  const pieAccessibilityLabel = useMemo(
    () =>
      [
        t('stats.section.dream_types'),
        ...pieChartData.map(
          (item) =>
            `${item.typeLabel} ${formatNumber(item.count)} · ${formatPercent(item.percentage / 100)}`,
        ),
      ].join(', '),
    [formatNumber, formatPercent, pieChartData, t],
  );

  // Compute max theme count for proportional bars
  const maxThemeCount = useMemo(
    () => Math.max(...stats.topThemes.map((theme) => theme.count), 1),
    [stats.topThemes],
  );

  // Rows for the shared ranked-list visual. The `stats.theme.<value>` lookup and its
  // raw-enum fallback are carried over verbatim from the previous inline block — the
  // fallback is exactly what the tied-themes test reads back under the echo translator.
  const topThemeRows = useMemo<StatsRankedRow[]>(
    () =>
      stats.topThemes.map((theme) => {
        const themeKey = `stats.theme.${theme.theme}`;
        const themeTranslation = t(themeKey);
        return {
          id: theme.theme,
          label: themeTranslation === themeKey ? theme.theme : themeTranslation,
          countLabel: t(theme.count === 1 ? 'stats.legend.count_one' : 'stats.legend.count', {
            count: formatNumber(theme.count),
          }),
          count: theme.count,
        };
      }),
    [formatNumber, stats.topThemes, t],
  );

  const statsHeaderActions = useMemo<NoctaliaHeaderAction[]>(
    () => [
      // Always available while the journal has dreams — it is the only way out of the
      // empty-period state below.
      {
        icon: 'calendar' as IconName,
        onPress: handleOpenStatsPeriodSheet,
        accessibilityLabel: t('stats.header.period'),
        active: isPeriodFiltered,
        testID: TID.Button.HeaderStatsPeriod,
      },
      // Nothing to share while the active period holds no dream: the message would
      // read "Dreams: 0, Favorites: 0" to a user whose journal is full.
      ...(hasStatisticsContent
        ? [
            {
              icon: 'square.and.arrow.up' as IconName,
              onPress: () => {
                void handleShareStats();
              },
              accessibilityLabel: t('stats.header.share'),
              testID: TID.Button.HeaderStatsShare,
            },
          ]
        : []),
    ],
    [handleOpenStatsPeriodSheet, handleShareStats, hasStatisticsContent, isPeriodFiltered, t],
  );

  const header = isDesktopLayout ? (
    <>
      <PageHeader titleKey="stats.title" animationSeed={showAnimations ? 1 : 0} />
      {showHeaderActions ? (
        <ScreenContainer>
          <StatsHeaderActionsRow actions={statsHeaderActions} noctalia={noctalia} />
        </ScreenContainer>
      ) : null}
    </>
  ) : (
    <NoctaliaScreenHeader
      titleKey="stats.title"
      actions={showHeaderActions ? statsHeaderActions : undefined}
    />
  );

  const periodSheet = (
    <BottomSheet
      visible={showStatsPeriodSheet}
      onClose={() => setShowStatsPeriodSheet(false)}
      testID={TID.Modal.StatsPeriod}
      style={[styles.periodSheet, { backgroundColor: noctalia.surface.raised }]}
    >
      <Text style={[styles.periodSheetTitle, { color: noctalia.text.primary }]}>
        {t('stats.period.title')}
      </Text>
      <View style={styles.periodOptions}>
        {STATS_PERIOD_OPTIONS.map((option) => {
          const active = selectedStatsPeriod === option.id;

          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={t(option.labelKey)}
              testID={TID.Button.StatsPeriodOption(option.id)}
              onPress={() => {
                void trackProductEvent('stats_period_selected', {
                  period: option.id,
                  has_results: filterDreamsByStatsPeriod(dreams, option.id).length > 0,
                });
                setSelectedStatsPeriod(option.id);
                setShowStatsPeriodSheet(false);
              }}
              style={({ pressed }) => [
                styles.periodOption,
                {
                  borderColor: active ? noctalia.action.primaryBorder : noctalia.surface.border,
                  backgroundColor: active ? noctalia.action.primary : noctalia.surface.soft,
                },
                pressed && styles.pressedButton,
              ]}
            >
              <Text
                style={[
                  styles.periodOptionText,
                  { color: active ? noctalia.action.primaryText : noctalia.text.primary },
                ]}
              >
                {t(option.labelKey)}
              </Text>
              {active ? (
                <IconSymbol
                  name="checkmark"
                  size={18}
                  color={noctalia.action.primaryText}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );

  // Audit P1-8: nothing on the page said which window the numbers described. The pill
  // names the active period and doubles as the way back into the period sheet.
  const periodChip = isPeriodFiltered ? (
    <View style={styles.periodChipRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('stats.period.indicator', { period: selectedPeriodLabel })}
        testID={TID.Button.StatsPeriodChip}
        onPress={handleOpenStatsPeriodSheet}
        style={({ pressed }) => [
          styles.periodChip,
          {
            backgroundColor: noctalia.surface.soft,
            borderColor: noctalia.surface.borderStrong,
          },
          pressed && styles.pressedButton,
        ]}
      >
        <IconSymbol name="calendar" size={14} color={noctalia.accent.base} />
        <Text style={[styles.periodChipText, { color: noctalia.text.primary }]}>
          {t('stats.period.indicator', { period: selectedPeriodLabel })}
        </Text>
      </Pressable>
    </View>
  ) : null;

  if (!loaded) {
    return (
      <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
        <View style={[styles.container, { backgroundColor: noctalia.screen.background }]}>
          <AtmosphericBackground variant="subtle" />
          {header}
          {periodSheet}
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: noctalia.text.secondary }]}>{t('stats.loading')}</Text>
          </View>
        </View>
      </ScrollPerfProvider>
    );
  }

  if (dreams.length === 0) {
    return (
      <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
        <View style={[styles.container, { backgroundColor: noctalia.screen.background }]}>
          <AtmosphericBackground variant="subtle" />
          {header}
          {periodSheet}
          <ScrollView
            style={styles.scrollView}
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={[
              styles.emptyScrollContent,
              { paddingBottom: scrollBottomPadding },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <ScreenContainer>
              <MockNavigationRail />
              <View style={styles.emptyState}>
                <View style={styles.emptyCopy}>
                  <IconSymbol name="chart.bar.fill" size={40} color={noctalia.text.tertiary} />
                  <Text style={[styles.emptyHeading, { color: noctalia.text.primary }]}>
                    {t('stats.empty.title')}
                  </Text>
                  <Text style={[styles.emptyBody, { color: noctalia.text.secondary }]}>
                    {t('stats.empty.body')}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('stats.profile.next_action.add_anchor.cta')}
                  testID={TID.Button.EmptyStartRememberedDream}
                  onPress={handleAddDreamPress}
                  style={({ pressed }) => [
                    styles.emptyPrimaryButton,
                    {
                      backgroundColor: noctalia.action.primary,
                      borderColor: noctalia.action.primaryBorder,
                    },
                    pressed && styles.pressedButton,
                  ]}
                >
                  <IconSymbol name="pencil" size={18} color={noctalia.action.primaryText} />
                  <Text style={[styles.emptyPrimaryButtonText, { color: noctalia.action.primaryText }]}>
                    {t('stats.profile.next_action.add_anchor.cta')}
                  </Text>
                </Pressable>
              </View>
            </ScreenContainer>
          </ScrollView>
        </View>
      </ScrollPerfProvider>
    );
  }

  // Audit P1-9. The journal is not empty, the selected window is. Previously the page
  // rendered an all-zero Overview plus a profile built from every dream — two numbers
  // that contradicted each other. Now the whole page speaks about the same window.
  if (periodDreams.length === 0) {
    return (
      <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
        <View style={[styles.container, { backgroundColor: noctalia.screen.background }]}>
          <AtmosphericBackground variant="subtle" />
          {header}
          {periodSheet}
          <ScrollView
            style={styles.scrollView}
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={[
              styles.emptyScrollContent,
              { paddingBottom: scrollBottomPadding },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <ScreenContainer>
              <MockNavigationRail />
              <View style={styles.emptyState}>
                <View
                  style={[
                    styles.periodEmptyCard,
                    {
                      backgroundColor: noctalia.surface.soft,
                      borderColor: noctalia.surface.borderStrong,
                    },
                  ]}
                  testID={TID.Component.StatsPeriodEmpty}
                >
                  <IconSymbol name="calendar" size={22} color={noctalia.accent.base} />
                  <Text style={[styles.periodEmptyTitle, { color: noctalia.text.primary }]}>
                    {t('stats.period.empty.title')}
                  </Text>
                  <Text style={[styles.periodEmptyBody, { color: noctalia.text.secondary }]}>
                    {t('stats.period.empty.body')}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('stats.period.reset')}
                    testID={TID.Button.StatsPeriodReset}
                    onPress={handleResetStatsPeriod}
                    style={({ pressed }) => [
                      styles.emptyPrimaryButton,
                      {
                        backgroundColor: noctalia.action.primary,
                        borderColor: noctalia.action.primaryBorder,
                      },
                      pressed && styles.pressedButton,
                    ]}
                  >
                    <Text style={[styles.emptyPrimaryButtonText, { color: noctalia.action.primaryText }]}>
                      {t('stats.period.reset')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScreenContainer>
          </ScrollView>
        </View>
      </ScrollPerfProvider>
    );
  }

  return (
    <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
      <View style={[styles.container, { backgroundColor: noctalia.screen.background }]}>
        <AtmosphericBackground variant="subtle" />
        {header}
        {periodSheet}

        <ScrollView
          style={styles.scrollView}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={scrollPerf.onScrollBeginDrag}
          onScrollEndDrag={scrollPerf.onScrollEndDrag}
          onMomentumScrollBegin={scrollPerf.onMomentumScrollBegin}
          onMomentumScrollEnd={scrollPerf.onMomentumScrollEnd}
        >
          <ScreenContainer>
            <MockNavigationRail />
            <View style={[styles.scrollContent, isDesktopLayout && styles.scrollContentDesktop]}>
            {periodChip}
            {/* Overview Cards */}
            <View style={[styles.section, isDesktopLayout && styles.sectionOverviewDesktop]}>
              <SectionGlass noctalia={noctalia} animationDelay={SECTION_ANIMATION_DELAY.overview}>
                <SectionHeading
                  title={t('stats.section.overview')}
                  icon="chart.bar.fill"
                  colors={colors}
                />
                <View style={styles.statsGrid}>
                  <StatCard
                    title={t('stats.card.total_dreams')}
                    value={formatNumber(stats.totalDreams)}
                    noctalia={noctalia}
                  />
                  <StatCard
                    title={t('stats.card.favorites')}
                    value={formatNumber(stats.favoriteDreams)}
                    noctalia={noctalia}
                  />
                  {/*
                    Audit 22a: both counts are recomputed inside the already-filtered
                    set, so under "7 days" they simply restate the total. A Fragment,
                    not a View, so the two cards stay direct children of statsGrid.
                  */}
                  {isPeriodFiltered ? null : (
                    <>
                      <StatCard
                        title={t('stats.card.this_week')}
                        value={formatNumber(stats.dreamsThisWeek)}
                        noctalia={noctalia}
                      />
                      <StatCard
                        title={t('stats.card.this_month')}
                        value={formatNumber(stats.dreamsThisMonth)}
                        noctalia={noctalia}
                      />
                    </>
                  )}
                </View>
              </SectionGlass>
            </View>

            {/*
              Rythme (S1, free). Directly after Overview, as the contract binds, and deferred
              like the other charts. `stats.dreamsByDay` has been computed since day one and
              rendered nowhere (audit §3.3). No `stats.totalDreams > 0` half on the gate: the
              screen already early-returns to StatsPeriodEmpty when `periodDreams` is empty,
              and `stats` is computed from `periodDreams`, so the check is dead code.
            */}
            {showDeferredSections ? (
              <View
                style={[styles.section, isDesktopLayout && styles.sectionRhythmDesktop]}
                testID={TID.Component.StatsRhythm}
              >
                <StatsRhythmSection
                  noctalia={noctalia}
                  colors={colors}
                  dreamsByDay={stats.dreamsByDay}
                  weekdayLabels={weekdayLabels}
                  metrics={rhythmMetrics}
                  t={t}
                  formatNumber={formatNumber}
                />
              </View>
            ) : null}

            {showDreamProfileSection ? (
              <>
                <View style={[styles.section, isDesktopLayout && styles.sectionInsightDesktop]}>
                  <DreamProfileCard
                    noctalia={noctalia}
                    profile={dreamProfile}
                    t={t}
                    formatNumber={formatNumber}
                    canShowPremiumSignals={canShowDreamProfileSignals}
                    onPress={handleDreamProfilePress}
                    onUpgradePress={handleDreamProfileUpgradePress}
                  />
                </View>

                {journalHasAnalysis ? (
                  <View style={[styles.section, isDesktopLayout && styles.sectionInsightDesktop]}>
                    <StatsInsightCard
                      noctalia={noctalia}
                      insight={statsInsight}
                      t={t}
                      formatPercent={formatPercent}
                      onPress={handleStatsInsightPress}
                    />
                  </View>
                ) : null}
              </>
            ) : null}

            {/* Streaks */}
            <View style={[styles.section, isDesktopLayout && styles.sectionStreaksDesktop]}>
              <SectionGlass noctalia={noctalia} animationDelay={SECTION_ANIMATION_DELAY.streaks}>
                <SectionHeading
                  title={t('stats.section.streaks')}
                  icon="flame.fill"
                  colors={colors}
                />
                <View style={styles.statsRow}>
                  <StatCard
                    title={t('stats.card.current_streak')}
                    value={formatNumber(stats.currentStreak)}
                    subtitle={stats.currentStreak === 1 ? t('stats.card.day') : t('stats.card.days')}
                    noctalia={noctalia}
                  />
                  <StatCard
                    title={t('stats.card.longest_streak')}
                    value={formatNumber(stats.longestStreak)}
                    subtitle={stats.longestStreak === 1 ? t('stats.card.day') : t('stats.card.days')}
                    noctalia={noctalia}
                  />
                </View>
                <View style={styles.singleStatCard}>
                  <StatCard
                    title={t('stats.card.average_per_week')}
                    value={formatNumber(stats.averageDreamsPerWeek, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                    noctalia={noctalia}
                  />
                </View>
              </SectionGlass>
            </View>

            {/* Dream Type Distribution */}
            {showDeferredSections && stats.dreamTypeDistribution.length > 0 && (
              <View style={[styles.section, isDesktopLayout && styles.sectionChartDesktop]}>
                <SectionGlass noctalia={noctalia} animationDelay={SECTION_ANIMATION_DELAY.dreamTypes}>
                    <SectionHeading
                      title={t('stats.section.dream_types')}
                      icon="chart.pie.fill"
                      colors={colors}
                    />
                  <View style={styles.chartContainer}>
                    <View style={styles.pieChartWrapper}>
                      <View
                        accessible
                        accessibilityRole="image"
                        accessibilityLabel={pieAccessibilityLabel}
                        style={{ width: pieMetrics.pieChartDimension, height: pieMetrics.pieChartDimension }}
                      >
                        <PieChart
                          data={pieChartData}
                          donut
                          radius={pieMetrics.pieRadius}
                          innerRadius={pieMetrics.pieInnerRadius}
                          extraRadius={pieMetrics.pieExtraRadius}
                          strokeWidth={1.5}
                          strokeColor={noctalia.screen.background}
                          innerCircleColor={noctalia.screen.background}
                          showExternalLabels={false}
                          centerLabelComponent={() => (
                            <View>
                              <Text style={[styles.pieChartCenterText, { color: noctalia.text.primary }]}>
                                {formatNumber(stats.totalDreams)}
                              </Text>
                              <Text style={[styles.pieChartCenterSubtext, { color: noctalia.text.secondary }]}>
                                {t('stats.chart.pie_center')}
                              </Text>
                            </View>
                          )}
                        />
                        <Svg
                          width={pieMetrics.pieChartDimension}
                          height={pieMetrics.pieChartDimension}
                          style={StyleSheet.absoluteFill}
                        >
                          {pieLabelLayouts.map((layout) => {
                            const labelWidth = pieMetrics.pieLabelWidth;
                            const labelHeight = layout.item.labelHeight || PIE_LABEL_HEIGHT;
                            const labelX = layout.isRightHalf
                              ? pieMetrics.pieChartCenter + pieMetrics.pieRadius + PIE_LABEL_MARGIN
                              : pieMetrics.pieChartCenter - pieMetrics.pieRadius - PIE_LABEL_MARGIN - labelWidth;
                            const labelY = layout.labelCenterY - labelHeight / 2;
                            const textX = labelX + LABEL_TEXT_MARGIN;
                            const typeLines = layout.item.typeLines?.length
                              ? layout.item.typeLines
                              : [layout.item.typeLabel];
                            const detailText = `${formatNumber(layout.item.count)} · ${formatPercent(layout.item.percentage / 100)}`;
                            const typeStartY = labelY + LABEL_VERTICAL_PADDING + 12;
                            const detailY =
                              labelY +
                              LABEL_VERTICAL_PADDING +
                              typeLines.length * LABEL_TEXT_LINE_HEIGHT +
                              LABEL_DETAIL_LINE_HEIGHT -
                              2;
                            const connectorBendX =
                              pieMetrics.pieChartCenter +
                              (layout.isRightHalf ? 1 : -1) * (pieMetrics.pieRadius + pieMetrics.pieLabelTailLength);
                            const connectorEndX = layout.isRightHalf ? labelX : labelX + labelWidth;

                            return (
                              <React.Fragment key={`${layout.item.typeLabel}-${layout.item.count}`}>
                                <Line
                                  x1={layout.anchorX}
                                  y1={layout.anchorY}
                                  x2={connectorBendX}
                                  y2={layout.labelCenterY}
                                  stroke={noctalia.text.secondary}
                                  strokeWidth={1}
                                />
                                <Line
                                  x1={connectorBendX}
                                  y1={layout.labelCenterY}
                                  x2={connectorEndX}
                                  y2={layout.labelCenterY}
                                  stroke={noctalia.text.secondary}
                                  strokeWidth={1}
                                />
                                <Rect
                                  x={labelX}
                                  y={labelY}
                                  width={labelWidth}
                                  height={labelHeight}
                                  rx={ThemeLayout.borderRadius.sm}
                                  ry={ThemeLayout.borderRadius.sm}
                                  fill={noctalia.surface.raised}
                                  stroke={noctalia.surface.border}
                                  strokeWidth={1}
                                  opacity={0.95}
                                />
                                {typeLines.map((line, lineIndex) => (
                                  <SvgText
                                    key={`${layout.item.typeLabel}-${line}-${lineIndex}`}
                                    fill={noctalia.text.primary}
                                    fontSize={12}
                                    fontFamily="SpaceGrotesk_500Medium"
                                    x={textX}
                                    y={typeStartY + lineIndex * LABEL_TEXT_LINE_HEIGHT}
                                  >
                                    {line}
                                  </SvgText>
                                ))}
                                <SvgText
                                  fill={noctalia.text.secondary}
                                  fontSize={11}
                                  fontFamily="SpaceGrotesk_400Regular"
                                  x={textX}
                                  y={detailY}
                                >
                                  {detailText}
                                </SvgText>
                              </React.Fragment>
                            );
                          })}
                        </Svg>
                      </View>
                    </View>
                    <View style={styles.legendContainer} testID={TID.Component.StatsTypeLegend}>
                      {pieChartData.map((item, index) => (
                        <View
                          key={item.typeLabel}
                          style={[
                            styles.legendItem,
                            { backgroundColor: noctalia.surface.soft },
                          ]}
                        >
                          <View
                            style={[
                              styles.legendColor,
                              { backgroundColor: dreamTypeColors[index % dreamTypeColors.length] },
                            ]}
                          />
                          <Text style={[styles.legendText, { color: noctalia.text.primary }]}>
                            {item.typeLabel} ({t(item.count === 1 ? 'stats.legend.count_one' : 'stats.legend.count', { count: formatNumber(item.count) })})
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </SectionGlass>
              </View>
            )}

            {/* Top Themes */}
            {showDeferredSections && stats.topThemes.length > 0 && (
              <View style={[styles.section, isDesktopLayout && styles.sectionTopThemesDesktop]}>
                <SectionGlass noctalia={noctalia} animationDelay={SECTION_ANIMATION_DELAY.topThemes}>
                  <SectionHeading
                    title={t('stats.section.top_themes')}
                    icon="star.fill"
                    colors={colors}
                  />
                  <StatsRankedList
                    noctalia={noctalia}
                    rows={topThemeRows}
                    maxCount={maxThemeCount}
                    testID={TID.Component.StatsTopThemes}
                  />
                </SectionGlass>
              </View>
            )}

            {/*
              Émotions dominantes (S2, Plus). Between Top themes and Themes over time: the
              contract's thesis is "Plus describes your dreams", so the depth sections sit with
              the content, never below an activity counter.

              Hidden entirely when the active period holds no dream carrying emotions — the
              same rule the pie, Top themes and S3 follow. The "not enough yet" state is for a
              near miss (1-2 dreams); telling a user with zero analysed dreams to analyse three
              more only repeats the next-best-action card three sections above.
            */}
            {showDeferredSections &&
            emotionProfile.dreamsWithEmotions > 0 &&
            // Above the threshold the section only has something to say once at least one
            // family matched. The lexicon is not expected to cover everything, so a journal
            // can carry plenty of emotions and still rank none — and "0 emotions keep coming
            // back" is precisely the empty promise this phase exists to remove.
            (!emotionProfile.hasEnoughDreams || emotionProfile.distinctFamilies > 0) ? (
              <View style={[styles.section, isDesktopLayout && styles.sectionEmotionsDesktop]}>
                <StatsEmotionsSection
                  noctalia={noctalia}
                  colors={colors}
                  profile={emotionProfile}
                  rows={emotionRows}
                  maxCount={maxEmotionCount}
                  canShowFamilies={isPlusActive}
                  t={t}
                  formatNumber={formatNumber}
                  onUpgradePress={handleDreamProfileUpgradePress}
                />
              </View>
            ) : null}

            {/*
              Themes over time (S3, Plus). Sits with the content sections and above
              Engagement: the contract's thesis is "Plus describes your dreams", so the two
              depth sections must not sit below an activity counter. S2 (Émotions) goes
              immediately above this block.
            */}
            {showDeferredSections && themeTrend.series.length > 0 ? (
              <View
                style={[styles.section, isDesktopLayout && styles.sectionThemeTrendDesktop]}
                testID={TID.Component.StatsThemeTrend}
              >
                <StatsThemeTrendSection
                  noctalia={noctalia}
                  colors={colors}
                  trend={themeTrend}
                  metrics={themeTrendMetrics}
                  canShowChart={isPlusActive}
                  t={t}
                  formatNumber={formatNumber}
                  formatDate={formatDate}
                  onUpgradePress={handleDreamProfileUpgradePress}
                />
              </View>
            ) : null}

            {/* Engagement */}
            {showDeferredSections && (
              <View style={[styles.section, isDesktopLayout && styles.sectionEngagementDesktop]}>
                <SectionGlass noctalia={noctalia} animationDelay={SECTION_ANIMATION_DELAY.engagement}>
                  <SectionHeading
                    title={t('stats.section.engagement')}
                    icon="bubble.left.and.bubble.right.fill"
                    colors={colors}
                  />
                  <View style={styles.statsRow}>
                    <StatCard
                      title={t('stats.engagement.total_chats')}
                      value={formatNumber(stats.totalChatMessages)}
                      noctalia={noctalia}
                      valueTestID={TID.Stats.TotalChatsValue}
                    />
                    <StatCard
                      title={t('stats.engagement.dreams_with_chat')}
                      value={formatNumber(stats.dreamsWithChat)}
                      noctalia={noctalia}
                      valueTestID={TID.Stats.DreamsWithChatValue}
                    />
                  </View>
                  <View style={styles.singleStatCard}>
                    <StatCard
                      title={t('stats.engagement.analyzed_dreams')}
                      value={formatNumber(stats.analyzedDreams)}
                      noctalia={noctalia}
                      valueTestID={TID.Stats.AnalyzedDreamsValue}
                    />
                  </View>
                  {stats.mostDiscussedDream && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${stats.mostDiscussedDream.title}, ${t('stats.engagement.most_discussed.open')}`}
                      testID={TID.Button.StatsMostDiscussedDream}
                      onPress={handleMostDiscussedDreamPress}
                      style={({ pressed }) => [
                        styles.mostDiscussedCard,
                        pressed && styles.pressedButton,
                      ]}
                    >
                      <View style={[styles.mostDiscussedDecoLine, { backgroundColor: noctalia.accent.base }]} />
                      <View style={styles.mostDiscussedInner}>
                        <IconSymbol name="quote.opening" size={18} color={noctalia.accent.base} />
                        <Text style={[styles.mostDiscussedTitle, { color: noctalia.text.secondary }]}>
                          {t('stats.engagement.most_discussed')}
                        </Text>
                        <Text style={[styles.mostDiscussedDreamTitle, { color: noctalia.text.primary }]} numberOfLines={1}>
                          {stats.mostDiscussedDream.title}
                        </Text>
                        <View style={styles.mostDiscussedFooter}>
                          <Text style={[styles.mostDiscussedCount, { color: noctalia.accent.base }]}>
                            {t(
                              stats.mostDiscussedDreamUserMessages === 1
                                ? 'stats.engagement.messages_one'
                                : 'stats.engagement.messages',
                              { count: formatNumber(stats.mostDiscussedDreamUserMessages) },
                            )}
                          </Text>
                          <IconSymbol name="chevron.right" size={14} color={noctalia.accent.base} />
                        </View>
                      </View>
                    </Pressable>
                  )}
                </SectionGlass>
              </View>
            )}
          </View>
          </ScreenContainer>
        </ScrollView>
      </View>
    </ScrollPerfProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: ThemeLayout.spacing.md,
  },
  scrollContentDesktop: {
    paddingHorizontal: ThemeLayout.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ThemeLayout.spacing.md,
  },

  // Desktop header actions (PageHeader takes no actions prop)
  desktopHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: ThemeLayout.spacing.sm,
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingBottom: ThemeLayout.spacing.sm,
  },
  desktopHeaderActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sections
  section: {
    marginBottom: 36,
  },
  sectionOverviewDesktop: {
    width: '100%',
  },
  sectionStreaksDesktop: {
    width: '100%',
  },
  sectionInsightDesktop: {
    width: '100%',
  },
  sectionChartDesktop: {
    width: '60%',
    minWidth: 420,
  },
  sectionTopThemesDesktop: {
    width: '40%',
    minWidth: 320,
  },
  // Full width: Rythme sits between two full-width cards, and a 60% card there would leave a
  // 40% hole in the grid.
  sectionRhythmDesktop: {
    width: '100%',
  },
  sectionThemeTrendDesktop: {
    width: '60%',
    minWidth: 420,
  },
  // Declared for S2, which is a ranked list like Top themes.
  sectionEmotionsDesktop: {
    width: '40%',
    minWidth: 320,
  },
  sectionEngagementDesktop: {
    width: '100%',
  },

  // Glass section wrapper
  sectionGlassCard: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 0,
  },
  sectionAccentStripe: {
    ...DecoLines.stripe,
    height: 3,
    opacity: 0.85,
  },
  sectionInner: {
    padding: SECTION_INNER_PADDING,
  },

  // Stat cards
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ThemeLayout.spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: ThemeLayout.spacing.sm,
  },
  singleStatCard: {
    marginTop: ThemeLayout.spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: ThemeLayout.borderRadius.md,
    padding: ThemeLayout.spacing.md,
    minWidth: '48%',
  },
  statTitle: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.medium,
    textTransform: 'uppercase',
    marginBottom: ThemeLayout.spacing.xs,
  },
  statValue: {
    fontSize: 36,
    fontFamily: Fonts.fraunces.bold,
  },
  statValueUnderline: {
    width: 24,
    height: 2,
    borderRadius: 1,
    marginTop: 6,
  },
  statSubtitle: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.regular,
    marginTop: ThemeLayout.spacing.xs,
  },

  // Insight card
  insightCard: {
    borderRadius: 26,
    overflow: 'hidden',
    padding: 0,
  },
  insightAccent: {
    height: 3,
    opacity: 0.9,
  },
  insightInner: {
    padding: 22,
    gap: 18,
  },
  insightHeaderRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  insightIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightCopy: {
    flex: 1,
    gap: 5,
  },
  insightEyebrow: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.medium,
    textTransform: 'uppercase',
  },
  insightTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: Fonts.fraunces.semiBold,
  },
  insightBody: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  insightProgressGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  insightProgressItem: {
    flex: 1,
    minWidth: 138,
    borderWidth: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: 12,
    gap: 9,
  },
  insightMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  insightMetricLabel: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
    textTransform: 'uppercase',
  },
  insightMetricValue: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.bold,
    fontVariant: ['tabular-nums'],
  },
  insightTrack: {
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  insightFill: {
    height: '100%',
    borderRadius: 999,
  },
  insightButton: {
    minHeight: 48,
    borderRadius: 18,
    borderCurve: 'continuous',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  insightButtonText: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  pressedButton: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },

  // Dream profile
  profileCard: {
    borderRadius: 26,
    overflow: 'hidden',
    padding: 0,
  },
  profileAccent: {
    height: 3,
    opacity: 0.9,
  },
  profileInner: {
    padding: 22,
    gap: 16,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  profileIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCopy: {
    flex: 1,
    gap: 5,
  },
  profileEyebrow: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.medium,
    textTransform: 'uppercase',
  },
  profileTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: Fonts.fraunces.semiBold,
  },
  profileBody: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  profileReadinessPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 34,
    paddingHorizontal: 12,
  },
  profileReadinessText: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  profileMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  profileMetric: {
    flex: 1,
    minWidth: 132,
    borderWidth: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: 12,
    gap: 4,
  },
  profileMetricValue: {
    fontSize: 24,
    fontFamily: Fonts.fraunces.bold,
    fontVariant: ['tabular-nums'],
  },
  profileMetricLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
    textTransform: 'uppercase',
  },
  profileSignalGrid: {
    gap: 9,
  },
  profileSignal: {
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  profileSignalLabel: {
    fontSize: 11,
    fontFamily: Fonts.spaceGrotesk.medium,
    textTransform: 'uppercase',
  },
  profileSignalValue: {
    fontSize: 15,
    lineHeight: 19,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  profilePlusPreview: {
    borderWidth: 1,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: 14,
    gap: 12,
  },
  profilePlusPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profilePlusPreviewTitle: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  profilePlusPreviewBody: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  profileSignalLockedValue: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  profileUpgradeButton: {
    minHeight: 42,
    borderRadius: 15,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  profileUpgradeButtonText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.bold,
    textAlign: 'center',
  },
  profileButton: {
    minHeight: 48,
    borderRadius: 18,
    borderCurve: 'continuous',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  profileButtonText: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
    textAlign: 'center',
  },

  // Chart / Pie
  chartContainer: {
    borderRadius: ThemeLayout.borderRadius.md,
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingVertical: ThemeLayout.spacing.xs,
    alignItems: 'center',
  },
  pieChartWrapper: {
    alignItems: 'center',
    marginBottom: ThemeLayout.spacing.sm,
  },
  // The gifted-charts wrapper does its own vertical maths (container height = plot + 50, with
  // marginBottom = xAxisLabelsHeight - 55), so this frame only centres — it must not impose a
  // height or clip overflow.
  chartFrame: {
    alignSelf: 'center',
    marginBottom: ThemeLayout.spacing.sm,
  },
  chartAxisLabel: {
    fontSize: 11,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  chartXAxisLabel: {
    fontSize: 11,
    fontFamily: Fonts.spaceGrotesk.medium,
    textAlign: 'center',
  },
  pieChartCenterText: {
    fontSize: 24,
    fontFamily: Fonts.fraunces.bold,
    textAlign: 'center',
  },
  pieChartCenterSubtext: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.regular,
    textAlign: 'center',
  },
  legendContainer: {
    width: '100%',
    gap: ThemeLayout.spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ThemeLayout.spacing.sm,
    borderRadius: 12,
    padding: 10,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
  },

  // Most Discussed
  mostDiscussedCard: {
    marginTop: ThemeLayout.spacing.md,
    borderRadius: ThemeLayout.borderRadius.lg,
    overflow: 'hidden',
  },
  mostDiscussedDecoLine: {
    height: 2,
    width: '100%',
  },
  mostDiscussedInner: {
    padding: ThemeLayout.spacing.md,
    gap: 6,
  },
  mostDiscussedTitle: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  mostDiscussedDreamTitle: {
    fontSize: 17,
    fontFamily: Fonts.fraunces.regular,
    fontStyle: 'italic',
  },
  mostDiscussedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mostDiscussedCount: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
  },

  // Period Sheet
  periodSheet: {
    gap: ThemeLayout.spacing.md,
    paddingBottom: ThemeLayout.spacing.xl,
  },
  periodSheetTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: Fonts.fraunces.semiBold,
  },
  periodOptions: {
    gap: ThemeLayout.spacing.sm,
  },
  periodOption: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 18,
    borderCurve: 'continuous',
    paddingHorizontal: ThemeLayout.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ThemeLayout.spacing.md,
  },
  periodOptionText: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  periodChipRow: {
    width: '100%',
    flexDirection: 'row',
    marginBottom: ThemeLayout.spacing.md,
  },
  periodChip: {
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 30,
    paddingHorizontal: 10,
  },
  periodChipText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  periodEmptyCard: {
    borderWidth: 1,
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: ThemeLayout.spacing.lg,
    gap: ThemeLayout.spacing.sm,
    alignItems: 'center',
  },
  periodEmptyTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: Fonts.fraunces.semiBold,
    textAlign: 'center',
  },
  periodEmptyBody: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.spaceGrotesk.regular,
    textAlign: 'center',
    marginBottom: ThemeLayout.spacing.xs,
  },

  // Empty / Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  emptyState: {
    gap: ThemeLayout.spacing.lg,
    padding: ThemeLayout.spacing.lg,
  },
  emptyCopy: {
    alignItems: 'center',
    gap: ThemeLayout.spacing.sm,
  },
  emptyHeading: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: Fonts.fraunces.semiBold,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.spaceGrotesk.regular,
    textAlign: 'center',
    maxWidth: 320,
    alignSelf: 'center',
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: ThemeLayout.spacing.xl,
  },
  emptyPrimaryButton: {
    minHeight: 50,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
  },
  emptyPrimaryButtonText: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
});
