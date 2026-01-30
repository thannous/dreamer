import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { FlatGlassCard } from '@/components/inspiration/GlassCard';
import { PageHeader } from '@/components/inspiration/PageHeader';
import { SectionHeading } from '@/components/inspiration/SectionHeading';
import { ScreenContainer } from '@/components/ScreenContainer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DESKTOP_BREAKPOINT } from '@/constants/layout';
import type { LabelLineConfig, pieDataItem } from 'react-native-gifted-charts';
import { PieChart } from 'react-native-gifted-charts';
import { Line, Rect, Svg, Text as SvgText } from 'react-native-svg';

import type { ThemeColors } from '@/constants/journalTheme';
import { DecoLines, ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useDreams } from '@/context/DreamsContext';
import { useTheme } from '@/context/ThemeContext';
import { useDreamStatistics } from '@/hooks/useDreamStatistics';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamTypeLabel } from '@/lib/dreamLabels';
import { splitLabelText } from '@/lib/pieLabelUtils';
import type { DreamType } from '@/lib/types';
import { TID } from '@/lib/testIDs';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_HORIZONTAL_INSET = ThemeLayout.spacing.lg * 3;
const CHART_WIDTH = SCREEN_WIDTH - CHART_HORIZONTAL_INSET;
const PIE_LABEL_MARGIN = ThemeLayout.spacing.sm;
const PIE_LABEL_VERTICAL_MARGIN = ThemeLayout.spacing.md;
const LABEL_TEXT_MARGIN = ThemeLayout.spacing.sm;
const LABEL_VERTICAL_PADDING = ThemeLayout.spacing.xs;
const LABEL_TEXT_LINE_HEIGHT = 14;
const LABEL_DETAIL_LINE_HEIGHT = 13;
const MAX_LABEL_LINES = 3;
const MAX_LABEL_CHARS_PER_LINE = 10;
const PIE_LABEL_HEIGHT = getLabelHeight(MAX_LABEL_LINES);
const MIN_PIE_RADIUS = 62;
const MAX_PIE_RADIUS = 90;
const MIN_LABEL_WIDTH = 84;
const MAX_LABEL_WIDTH = 196;
const MIN_LABEL_LINE = 14;
const MAX_LABEL_LINE = 28;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function getLabelHeight(lineCount: number) {
  const safeCount = Math.max(1, lineCount);
  return LABEL_VERTICAL_PADDING * 2 + safeCount * LABEL_TEXT_LINE_HEIGHT + LABEL_DETAIL_LINE_HEIGHT;
}

// Balance the donut radius and external label width so callouts stay visible on all breakpoints.
const baseLabelWidth = clamp(CHART_WIDTH * 0.38, MIN_LABEL_WIDTH, MAX_LABEL_WIDTH);
const baseLabelLineLength = clamp(CHART_WIDTH * 0.05, MIN_LABEL_LINE, MAX_LABEL_LINE);
const maxPaddingPerSide = Math.max(
  (CHART_WIDTH - MIN_PIE_RADIUS * 2) / 2,
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

const PIE_LABEL_WIDTH = pieLabelWidth;
const PIE_LABEL_LINE_LENGTH = pieLabelLineLength;
const PIE_EXTRA_RADIUS = piePaddingPerSide;
const PIE_RADIUS = clamp(CHART_WIDTH / 2 - PIE_EXTRA_RADIUS, MIN_PIE_RADIUS, MAX_PIE_RADIUS);
const PIE_INNER_RADIUS = PIE_RADIUS * 0.62;
const PIE_LABEL_TAIL_LENGTH = Math.max(10, Math.min(PIE_LABEL_LINE_LENGTH * 0.45, PIE_LABEL_LINE_LENGTH - 4));
const PIE_CHART_DIMENSION = PIE_RADIUS * 2 + PIE_EXTRA_RADIUS * 2;
const PIE_CHART_CENTER = PIE_RADIUS + PIE_EXTRA_RADIUS;

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

const buildPieLabelLayouts = (data: DreamPieDataItem[]): PieLabelLayout[] => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (!total) return [];

  let accumulated = 0;
  const rawLayouts: PieLabelLayout[] = data.map((item) => {
    const sliceAngle = (item.value / total) * Math.PI * 2;
    const midAngle = accumulated + sliceAngle / 2;
    accumulated += sliceAngle;

    const anchorX = PIE_CHART_CENTER + PIE_RADIUS * Math.sin(midAngle);
    const anchorY = PIE_CHART_CENTER - PIE_RADIUS * Math.cos(midAngle);
    const isRightHalf = anchorX >= PIE_CHART_CENTER;

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
    PIE_CHART_DIMENSION,
  );
  const right = distributeLabelsOnSide(
    rawLayouts.filter((layout) => layout.isRightHalf),
    PIE_CHART_DIMENSION,
  );

  return [...left, ...right];
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  colors: ThemeColors;
  valueTestID?: string;
}

function StatCard({ title, value, subtitle, colors, valueTestID }: StatCardProps) {
  const valueText = typeof value === 'number' ? String(value) : value;
  const accessibilityLabel = `${title}: ${valueText}`;

  return (
    <View style={styles.statCard}>
      <Text style={[styles.statTitle, { color: colors.textSecondary }]}>{title}</Text>
      <Text
        style={[styles.statValue, { color: colors.accent }]}
        testID={valueTestID}
        accessibilityLabel={accessibilityLabel}
      >
        {value}
      </Text>
      <View style={[styles.statValueUnderline, { backgroundColor: `${colors.accent}40` }]} />
      {subtitle && <Text style={[styles.statSubtitle, { color: colors.textTertiary }]}>{subtitle}</Text>}
    </View>
  );
}

// ─── Section Glass Wrapper ────────────────────────────────────────────────────

function SectionGlass({
  children,
  colors,
  animationDelay = 0,
}: {
  children: React.ReactNode;
  colors: ThemeColors;
  animationDelay?: number;
}) {
  return (
    <FlatGlassCard
      intensity="subtle"
      animationDelay={animationDelay}
      style={styles.sectionGlassCard}
    >
      <View style={[styles.sectionAccentStripe, { backgroundColor: colors.accent }]} />
      <View style={styles.sectionInner}>
        {children}
      </View>
    </FlatGlassCard>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StatisticsScreen() {
  const { dreams, loaded } = useDreams();
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const { width } = useWindowDimensions();
  useClearWebFocus();
  const { formatNumber, formatPercent } = useLocaleFormatting();
  const tabBarHeight = useBottomTabBarHeight();
  const stats = useDreamStatistics(dreams);
  const isDesktopLayout = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  const [showAnimations, setShowAnimations] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setShowAnimations(true);
      return () => setShowAnimations(false);
    }, []),
  );

  // Memoize color arrays to avoid re-allocation churn
  const dreamTypeColors = useMemo(() =>
    mode === 'dark'
      ? ['#B8A4FF', '#D3B8FF', '#9683E2', '#C2A0FF', '#8770CF']
      : ['#AD96E0', '#D9B28A', '#9BC6B3', '#A1B8E0', '#DCC48C'],
    [mode]
  );

  // Memoize label config - only depends on colors.textSecondary
  const pieLabelLineConfig: LabelLineConfig = useMemo(() => ({
    length: PIE_LABEL_LINE_LENGTH,
    tailLength: PIE_LABEL_TAIL_LENGTH,
    color: colors.textSecondary,
    thickness: 1,
    labelComponentWidth: PIE_LABEL_WIDTH,
    labelComponentHeight: PIE_LABEL_HEIGHT,
    labelComponentMargin: PIE_LABEL_VERTICAL_MARGIN,
    avoidOverlappingOfLabels: true,
  }), [colors.textSecondary]);

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

  const pieLabelLayouts = useMemo(() => buildPieLabelLayouts(pieChartData), [pieChartData]);

  // Compute max theme count for proportional bars
  const maxThemeCount = useMemo(
    () => Math.max(...stats.topThemes.map((theme) => theme.count), 1),
    [stats.topThemes],
  );

  const header = (
    <PageHeader titleKey="stats.title" animationSeed={showAnimations ? 1 : 0} />
  );

  if (!loaded) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundDark }]}>
        <AtmosphericBackground />
        {header}
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('stats.loading')}</Text>
        </View>
      </View>
    );
  }

  if (dreams.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundDark }]}>
        <AtmosphericBackground />
        {header}
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>{t('stats.empty')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDark }]}>
      <AtmosphericBackground />
      {header}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingBottom: tabBarHeight + ThemeLayout.spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenContainer>
          <View style={[styles.scrollContent, isDesktopLayout && styles.scrollContentDesktop]}>
            {/* Overview Cards */}
            <View style={[styles.section, isDesktopLayout && styles.sectionOverviewDesktop]}>
              <SectionGlass colors={colors} animationDelay={150}>
                <SectionHeading
                  title={t('stats.section.overview')}
                  icon="chart.bar.fill"
                  colors={colors}
                />
                <View style={styles.statsGrid}>
                  <StatCard
                    title={t('stats.card.total_dreams')}
                    value={formatNumber(stats.totalDreams)}
                    colors={colors}
                  />
                  <StatCard
                    title={t('stats.card.favorites')}
                    value={formatNumber(stats.favoriteDreams)}
                    colors={colors}
                  />
                  <StatCard
                    title={t('stats.card.this_week')}
                    value={formatNumber(stats.dreamsThisWeek)}
                    colors={colors}
                  />
                  <StatCard
                    title={t('stats.card.this_month')}
                    value={formatNumber(stats.dreamsThisMonth)}
                    colors={colors}
                  />
                </View>
              </SectionGlass>
            </View>

            {/* Streaks */}
            <View style={[styles.section, isDesktopLayout && styles.sectionStreaksDesktop]}>
              <SectionGlass colors={colors} animationDelay={300}>
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
                    colors={colors}
                  />
                  <StatCard
                    title={t('stats.card.longest_streak')}
                    value={formatNumber(stats.longestStreak)}
                    subtitle={stats.longestStreak === 1 ? t('stats.card.day') : t('stats.card.days')}
                    colors={colors}
                  />
                </View>
                <View style={styles.singleStatCard}>
                  <StatCard
                    title={t('stats.card.average_per_week')}
                    value={formatNumber(stats.averageDreamsPerWeek, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                    colors={colors}
                  />
                </View>
              </SectionGlass>
            </View>

            {/* Dream Type Distribution */}
            {stats.dreamTypeDistribution.length > 0 && (
              <View style={[styles.section, isDesktopLayout && styles.sectionChartDesktop]}>
                <SectionGlass colors={colors} animationDelay={450}>
                  <SectionHeading
                    title={t('stats.section.dream_types')}
                    icon="chart.pie.fill"
                    colors={colors}
                  />
                  <View style={styles.chartContainer}>
                    <View style={styles.pieChartWrapper}>
                      <View style={{ width: PIE_CHART_DIMENSION, height: PIE_CHART_DIMENSION }}>
                        <PieChart
                          data={pieChartData}
                          donut
                          radius={PIE_RADIUS}
                          innerRadius={PIE_INNER_RADIUS}
                          extraRadius={PIE_EXTRA_RADIUS}
                          strokeWidth={1.5}
                          strokeColor={colors.backgroundDark}
                          showExternalLabels={false}
                          centerLabelComponent={() => (
                            <View>
                              <Text style={[styles.pieChartCenterText, { color: colors.textPrimary }]}>
                                {formatNumber(stats.totalDreams)}
                              </Text>
                              <Text style={[styles.pieChartCenterSubtext, { color: colors.textSecondary }]}>
                                {t('stats.chart.pie_center')}
                              </Text>
                            </View>
                          )}
                        />
                        <Svg
                          width={PIE_CHART_DIMENSION}
                          height={PIE_CHART_DIMENSION}
                          style={StyleSheet.absoluteFill}
                        >
                          {pieLabelLayouts.map((layout) => {
                            const labelWidth = PIE_LABEL_WIDTH;
                            const labelHeight = layout.item.labelHeight || PIE_LABEL_HEIGHT;
                            const labelX = layout.isRightHalf
                              ? PIE_CHART_CENTER + PIE_RADIUS + PIE_LABEL_MARGIN
                              : PIE_CHART_CENTER - PIE_RADIUS - PIE_LABEL_MARGIN - labelWidth;
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
                              PIE_CHART_CENTER +
                              (layout.isRightHalf ? 1 : -1) * (PIE_RADIUS + PIE_LABEL_TAIL_LENGTH);
                            const connectorEndX = layout.isRightHalf ? labelX : labelX + labelWidth;

                            return (
                              <React.Fragment key={`${layout.item.typeLabel}-${layout.item.count}`}>
                                <Line
                                  x1={layout.anchorX}
                                  y1={layout.anchorY}
                                  x2={connectorBendX}
                                  y2={layout.labelCenterY}
                                  stroke={colors.textSecondary}
                                  strokeWidth={1}
                                />
                                <Line
                                  x1={connectorBendX}
                                  y1={layout.labelCenterY}
                                  x2={connectorEndX}
                                  y2={layout.labelCenterY}
                                  stroke={colors.textSecondary}
                                  strokeWidth={1}
                                />
                                <Rect
                                  x={labelX}
                                  y={labelY}
                                  width={labelWidth}
                                  height={labelHeight}
                                  rx={ThemeLayout.borderRadius.sm}
                                  ry={ThemeLayout.borderRadius.sm}
                                  fill={colors.backgroundCard}
                                  stroke={colors.divider}
                                  strokeWidth={1}
                                  opacity={0.95}
                                />
                                {typeLines.map((line, lineIndex) => (
                                  <SvgText
                                    key={`${layout.item.typeLabel}-${line}-${lineIndex}`}
                                    fill={colors.textPrimary}
                                    fontSize={12}
                                    fontFamily="SpaceGrotesk_500Medium"
                                    x={textX}
                                    y={typeStartY + lineIndex * LABEL_TEXT_LINE_HEIGHT}
                                  >
                                    {line}
                                  </SvgText>
                                ))}
                                <SvgText
                                  fill={colors.textSecondary}
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
                            { backgroundColor: `${colors.backgroundCard}40` },
                          ]}
                        >
                          <View
                            style={[
                              styles.legendColor,
                              { backgroundColor: dreamTypeColors[index % dreamTypeColors.length] },
                            ]}
                          />
                          <Text style={[styles.legendText, { color: colors.textPrimary }]}>
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
            {stats.topThemes.length > 0 && (
              <View style={[styles.section, isDesktopLayout && styles.sectionTopThemesDesktop]}>
                <SectionGlass colors={colors} animationDelay={600}>
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
                              !isLast && { borderBottomWidth: 1, borderBottomColor: colors.divider },
                            ]}
                          >
                            <View style={[styles.themeRank, { backgroundColor: `${colors.accent}25` }]}>
                              <Text style={[styles.themeRankText, { color: colors.accent }]}>{index + 1}</Text>
                            </View>
                            <View style={styles.themeContent}>
                              <Text style={[styles.themeText, { color: colors.textPrimary }]}>
                                {(() => {
                                  const key = `stats.theme.${theme.theme}`;
                                  const label = t(key);
                                  return label === key ? theme.theme : label;
                                })()}
                              </Text>
                              <Text style={[styles.themeCount, { color: colors.textSecondary }]}>
                                {t('stats.legend.count', { count: formatNumber(theme.count) })}
                              </Text>
                              <View style={styles.themeBarTrack}>
                                <View
                                  style={[
                                    styles.themeBarFill,
                                    {
                                      backgroundColor: colors.accent,
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
            <View style={[styles.section, isDesktopLayout && styles.sectionEngagementDesktop]}>
              <SectionGlass colors={colors} animationDelay={750}>
                <SectionHeading
                  title={t('stats.section.engagement')}
                  icon="bubble.left.and.bubble.right.fill"
                  colors={colors}
                />
                <View style={styles.statsRow}>
                  <StatCard
                    title={t('stats.engagement.total_chats')}
                    value={formatNumber(stats.totalChatMessages)}
                    colors={colors}
                    valueTestID={TID.Stats.TotalChatsValue}
                  />
                  <StatCard
                    title={t('stats.engagement.dreams_with_chat')}
                    value={formatNumber(stats.dreamsWithChat)}
                    colors={colors}
                    valueTestID={TID.Stats.DreamsWithChatValue}
                  />
                </View>
                <View style={styles.singleStatCard}>
                  <StatCard
                    title={t('stats.engagement.analyzed_dreams')}
                    value={formatNumber(stats.analyzedDreams)}
                    colors={colors}
                    valueTestID={TID.Stats.AnalyzedDreamsValue}
                  />
                </View>
                {stats.mostDiscussedDream && (
                  <View style={styles.mostDiscussedCard}>
                    <View style={[styles.mostDiscussedDecoLine, { backgroundColor: `${colors.accent}60` }]} />
                    <View style={styles.mostDiscussedInner}>
                      <IconSymbol name="quote.opening" size={18} color={colors.accent} />
                      <Text style={[styles.mostDiscussedTitle, { color: colors.textSecondary }]}>
                        {t('stats.engagement.most_discussed')}
                      </Text>
                      <Text style={[styles.mostDiscussedDreamTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                        {stats.mostDiscussedDream.title}
                      </Text>
                      <Text style={[styles.mostDiscussedCount, { color: colors.accent }]}>
                        {t('stats.engagement.messages', {
                          count: formatNumber(stats.mostDiscussedDreamUserMessages),
                        })}
                      </Text>
                    </View>
                  </View>
                )}
              </SectionGlass>
            </View>
          </View>
        </ScreenContainer>
      </ScrollView>
    </View>
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
    letterSpacing: 0.5,
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
    letterSpacing: 0.2,
  },
  mostDiscussedCount: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ThemeLayout.spacing.lg,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.regular,
    textAlign: 'center',
    lineHeight: 24,
  },
});
