import { router, useFocusEffect, type Href } from 'expo-router';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
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
import { NoctaliaScreenHeader } from '@/components/NoctaliaScreenHeader';
import { ScreenContainer } from '@/components/ScreenContainer';
import { MockNavigationRail } from '@/components/dev/MockNavigationRail';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DESKTOP_BREAKPOINT } from '@/constants/layout';
import type { LabelLineConfig, pieDataItem } from 'react-native-gifted-charts';
import { PieChart } from 'react-native-gifted-charts';
import { Line, Rect, Svg, Text as SvgText } from 'react-native-svg';

import { DecoLines, ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens, type NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useDreams } from '@/context/DreamsContext';
import { ScrollPerfProvider } from '@/context/ScrollPerfContext';
import { useTheme } from '@/context/ThemeContext';
import { useDreamStatistics } from '@/hooks/useDreamStatistics';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useScrollIdle } from '@/hooks/useScrollIdle';
import { useSubscription } from '@/hooks/useSubscription';
import { useTranslation } from '@/hooks/useTranslation';
import { buildDreamProfile, type DreamProfile } from '@/lib/dreamProfile';
import { getDreamTypeLabel } from '@/lib/dreamLabels';
import { getDreamStatsInsight, type DreamStatsInsightKind } from '@/lib/dreamStatsInsight';
import { isDreamAnalyzed } from '@/lib/dreamUsage';
import { buildPaywallHref } from '@/lib/paywallRoute';
import { splitLabelText } from '@/lib/pieLabelUtils';
import type { DreamAnalysis, DreamType } from '@/lib/types';
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

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function getLabelHeight(lineCount: number) {
  const safeCount = Math.max(1, lineCount);
  return LABEL_VERTICAL_PADDING * 2 + safeCount * LABEL_TEXT_LINE_HEIGHT + LABEL_DETAIL_LINE_HEIGHT;
}

const PIE_LABEL_HEIGHT = getLabelHeight(MAX_LABEL_LINES);

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
      animationDelay={220}
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
      animationDelay={260}
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StatisticsScreen() {
  const { dreams, loaded } = useDreams();
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { width } = useWindowDimensions();
  const scrollPerf = useScrollIdle();
  const { isActive: isPlusActive } = useSubscription();
  useClearWebFocus();
  const { formatNumber, formatPercent } = useLocaleFormatting();
  const [selectedStatsPeriod, setSelectedStatsPeriod] = useState<StatsPeriod>('all');
  const [showStatsPeriodSheet, setShowStatsPeriodSheet] = useState(false);
  const periodDreams = useMemo(
    () => filterDreamsByStatsPeriod(dreams, selectedStatsPeriod),
    [dreams, selectedStatsPeriod],
  );
  const stats = useDreamStatistics(periodDreams);
  const isDesktopLayout = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
  const pieMetrics = useMemo(() => getPieMetrics(width), [width]);
  const dreamProfile = useMemo(() => buildDreamProfile(dreams), [dreams]);
  const statsInsight = useMemo(() => getDreamStatsInsight(stats), [stats]);
  const hasAtLeastOneAnalysis = useMemo(() => dreams.some(isDreamAnalyzed), [dreams]);
  const canShowDreamProfileSignals = isPlusActive;
  const handleAddDreamPress = useCallback(() => {
    router.push(DREAM_PROFILE_NEXT_ROUTE.add_anchor);
  }, []);
  const handleDreamProfilePress = useCallback(() => {
    router.push(DREAM_PROFILE_NEXT_ROUTE[dreamProfile.nextAction]);
  }, [dreamProfile.nextAction]);
  const handleDreamProfileUpgradePress = useCallback(() => {
    router.push(buildPaywallHref('settings'));
  }, []);
  const handleStatsInsightPress = useCallback(() => {
    router.push(statsInsight.route);
  }, [statsInsight.route]);
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
      await Share.share({
        title: t('stats.share.title'),
        message,
      });
    } catch (error) {
      if (__DEV__) {
        console.error('[StatisticsScreen] Failed to share stats', error);
      }
    }
  }, [formatNumber, selectedPeriodLabel, stats, t]);

  const [showAnimations, setShowAnimations] = useState(false);
  const [showDeferredSections, setShowDeferredSections] = useState(false);
  const hasStatisticsContent = loaded && periodDreams.length > 0;

  useFocusEffect(
    useCallback(() => {
      setShowAnimations(true);
      return () => setShowAnimations(false);
    }, []),
  );

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

  // Compute max theme count for proportional bars
  const maxThemeCount = useMemo(
    () => Math.max(...stats.topThemes.map((theme) => theme.count), 1),
    [stats.topThemes],
  );

  const statsHeaderActions = useMemo(
    () => [
      {
        icon: 'calendar' as IconName,
        onPress: () => setShowStatsPeriodSheet(true),
        accessibilityLabel: t('stats.header.period'),
        active: selectedStatsPeriod !== 'all',
        testID: TID.Button.HeaderStatsPeriod,
      },
      {
        icon: 'square.and.arrow.up' as IconName,
        onPress: () => {
          void handleShareStats();
        },
        accessibilityLabel: t('stats.header.share'),
        testID: TID.Button.HeaderStatsShare,
      },
    ],
    [handleShareStats, selectedStatsPeriod, t],
  );

  const header = isDesktopLayout ? (
    <PageHeader titleKey="stats.title" animationSeed={showAnimations ? 1 : 0} />
  ) : (
    <NoctaliaScreenHeader titleKey="stats.title" actions={statsHeaderActions} />
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
            contentContainerStyle={styles.emptyScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <ScreenContainer>
              <MockNavigationRail />
              <View style={styles.emptyState}>
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

  return (
    <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
      <View style={[styles.container, { backgroundColor: noctalia.screen.background }]}>
        <AtmosphericBackground variant="subtle" />
        {header}
        {periodSheet}

        <ScrollView
          style={styles.scrollView}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            paddingBottom: ThemeLayout.spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={scrollPerf.onScrollBeginDrag}
          onScrollEndDrag={scrollPerf.onScrollEndDrag}
          onMomentumScrollBegin={scrollPerf.onMomentumScrollBegin}
          onMomentumScrollEnd={scrollPerf.onMomentumScrollEnd}
        >
          <ScreenContainer>
            <MockNavigationRail />
            <View style={[styles.scrollContent, isDesktopLayout && styles.scrollContentDesktop]}>
            {/* Overview Cards */}
            <View style={[styles.section, isDesktopLayout && styles.sectionOverviewDesktop]}>
              <SectionGlass noctalia={noctalia} animationDelay={150}>
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
                </View>
              </SectionGlass>
            </View>

            {hasAtLeastOneAnalysis ? (
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

                <View style={[styles.section, isDesktopLayout && styles.sectionInsightDesktop]}>
                  <StatsInsightCard
                    noctalia={noctalia}
                    insight={statsInsight}
                    t={t}
                    formatPercent={formatPercent}
                    onPress={handleStatsInsightPress}
                  />
                </View>
              </>
            ) : null}

            {/* Streaks */}
            <View style={[styles.section, isDesktopLayout && styles.sectionStreaksDesktop]}>
              <SectionGlass noctalia={noctalia} animationDelay={300}>
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
                <SectionGlass noctalia={noctalia} animationDelay={450}>
                    <SectionHeading
                      title={t('stats.section.dream_types')}
                      icon="chart.pie.fill"
                      colors={colors}
                    />
                  <View style={styles.chartContainer}>
                    <View style={styles.pieChartWrapper}>
                      <View style={{ width: pieMetrics.pieChartDimension, height: pieMetrics.pieChartDimension }}>
                        <PieChart
                          data={pieChartData}
                          donut
                          radius={pieMetrics.pieRadius}
                          innerRadius={pieMetrics.pieInnerRadius}
                          extraRadius={pieMetrics.pieExtraRadius}
                          strokeWidth={1.5}
                          strokeColor={noctalia.screen.background}
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
                    <View style={styles.legendContainer}>
                      {topDreamTypes.map((item, index) => (
                        <View
                          key={item.type}
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
                            {item.type} ({t('stats.legend.count', { count: formatNumber(item.count) })})
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
                <SectionGlass noctalia={noctalia} animationDelay={600}>
                  <SectionHeading
                    title={t('stats.section.top_themes')}
                    icon="star.fill"
                    colors={colors}
                  />
                  <View style={styles.themesContainer}>
                    {stats.topThemes.map((theme, index) => {
                      const isLast = index === stats.topThemes.length - 1;
                      const barWidth = Math.round((theme.count / maxThemeCount) * 100);
                      return (
                        <View key={theme.theme}>
                          <View
                            style={[
                              styles.themeItem,
                              !isLast && { borderBottomWidth: 1, borderBottomColor: noctalia.surface.border },
                            ]}
                          >
                            <View style={[styles.themeRank, { backgroundColor: noctalia.surface.soft }]}>
                              <Text style={[styles.themeRankText, { color: noctalia.accent.base }]}>{index + 1}</Text>
                            </View>
                            <View style={styles.themeContent}>
                              <Text style={[styles.themeText, { color: noctalia.text.primary }]}>
                                {(() => {
                                  const key = `stats.theme.${theme.theme}`;
                                  const label = t(key);
                                  return label === key ? theme.theme : label;
                                })()}
                              </Text>
                              <Text style={[styles.themeCount, { color: noctalia.text.secondary }]}>
                                {t('stats.legend.count', { count: formatNumber(theme.count) })}
                              </Text>
                              <View style={styles.themeBarTrack}>
                                <View
                                  style={[
                                    styles.themeBarFill,
                                    {
                                      backgroundColor: noctalia.accent.base,
                                      width: `${barWidth}%` as any,
                                    },
                                  ]}
                                />
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </SectionGlass>
              </View>
            )}

            {/* Engagement */}
            {showDeferredSections && (
              <View style={[styles.section, isDesktopLayout && styles.sectionEngagementDesktop]}>
                <SectionGlass noctalia={noctalia} animationDelay={750}>
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
                    <View style={styles.mostDiscussedCard}>
                      <View style={[styles.mostDiscussedDecoLine, { backgroundColor: noctalia.accent.base }]} />
                      <View style={styles.mostDiscussedInner}>
                        <IconSymbol name="quote.opening" size={18} color={noctalia.accent.base} />
                        <Text style={[styles.mostDiscussedTitle, { color: noctalia.text.secondary }]}>
                          {t('stats.engagement.most_discussed')}
                        </Text>
                        <Text style={[styles.mostDiscussedDreamTitle, { color: noctalia.text.primary }]} numberOfLines={1}>
                          {stats.mostDiscussedDream.title}
                        </Text>
                        <Text style={[styles.mostDiscussedCount, { color: noctalia.accent.base }]}>
                          {t('stats.engagement.messages', {
                            count: formatNumber(stats.mostDiscussedDreamUserMessages),
                          })}
                        </Text>
                      </View>
                    </View>
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
    padding: 22,
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
    textTransform: 'capitalize',
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
    textTransform: 'capitalize',
  },

  // Themes
  themesContainer: {
    gap: 0,
  },
  themeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: ThemeLayout.spacing.md,
  },
  themeRank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeRankText: {
    fontSize: 16,
    fontFamily: Fonts.fraunces.bold,
  },
  themeContent: {
    flex: 1,
  },
  themeText: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.medium,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  themeCount: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.regular,
    marginBottom: 6,
  },
  themeBarTrack: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  themeBarFill: {
    height: 3,
    borderRadius: 1.5,
    opacity: 0.6,
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
