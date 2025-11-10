import { ThemeLayout } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';
import { useDreams } from '@/context/DreamsContext';
import { useDreamStatistics } from '@/hooks/useDreamStatistics';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useTranslation } from '@/hooks/useTranslation';
import type { ThemeColors } from '@/constants/journalTheme';
import React from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Rect, Text as SvgText } from 'react-native-svg';
import { PieChart } from 'react-native-gifted-charts';
import type { LabelLineConfig, pieDataItem } from 'react-native-gifted-charts';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - ThemeLayout.spacing.md * 4;
const PIE_LABEL_MARGIN = ThemeLayout.spacing.sm;
const LABEL_TEXT_MARGIN = ThemeLayout.spacing.xs;
const LABEL_VERTICAL_PADDING = ThemeLayout.spacing.xs;
const LABEL_TEXT_LINE_HEIGHT = 14;
const LABEL_DETAIL_LINE_HEIGHT = 13;
const MAX_LABEL_LINES = 3;
const MAX_LABEL_CHARS_PER_LINE = 18;
const PIE_LABEL_HEIGHT = getLabelHeight(1);
const MIN_PIE_RADIUS = 62;
const MAX_PIE_RADIUS = 90;
const MIN_LABEL_WIDTH = 84;
const MAX_LABEL_WIDTH = 196;
const MIN_LABEL_LINE = 14;
const MAX_LABEL_LINE = 28;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const truncateLabelLine = (text: string, allowedLength = MAX_LABEL_CHARS_PER_LINE) => {
  if (text.length <= allowedLength) return text;
  return `${text.slice(0, Math.max(allowedLength - 1, 1))}…`;
};

const splitLabelText = (label: string): string[] => {
  const sanitized = label.trim();
  if (!sanitized) return [''];

  const words = sanitized.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  const pushLine = () => {
    if (!currentLine) return;
    lines.push(currentLine);
    currentLine = '';
  };

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length <= MAX_LABEL_CHARS_PER_LINE) {
      currentLine = candidate;
      return;
    }

    pushLine();
    currentLine = word.length > MAX_LABEL_CHARS_PER_LINE ? truncateLabelLine(word) : word;
    if (lines.length >= MAX_LABEL_LINES) {
      currentLine = truncateLabelLine(currentLine);
    }
  });

  pushLine();

  if (!lines.length) {
    lines.push(truncateLabelLine(sanitized));
  }

  if (lines.length > MAX_LABEL_LINES) {
    const limited = lines.slice(0, MAX_LABEL_LINES);
    limited[MAX_LABEL_LINES - 1] = truncateLabelLine(
      `${limited[MAX_LABEL_LINES - 1]} ${lines.slice(MAX_LABEL_LINES).join(' ')}`.trim(),
    );
    return limited;
  }

  return lines;
};

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
const PIE_PADDING_HORIZONTAL = piePaddingPerSide * 2;

const PIE_RADIUS = clamp((CHART_WIDTH - PIE_PADDING_HORIZONTAL) / 2, MIN_PIE_RADIUS, MAX_PIE_RADIUS);
const PIE_INNER_RADIUS = PIE_RADIUS * 0.62;
const PIE_LABEL_TAIL_LENGTH = Math.max(10, Math.min(PIE_LABEL_LINE_LENGTH * 0.45, PIE_LABEL_LINE_LENGTH - 4));

type DreamPieDataItem = pieDataItem & {
  typeLabel: string;
  count: number;
  percentage: number;
  typeLines: string[];
  labelHeight: number;
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  colors: ThemeColors;
}

function StatCard({ title, value, subtitle, colors }: StatCardProps) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.backgroundCard }]}>
      <Text style={[styles.statTitle, { color: colors.textSecondary }]}>{title}</Text>
      <Text style={[styles.statValue, { color: colors.accent }]}>{value}</Text>
      {subtitle && <Text style={[styles.statSubtitle, { color: colors.textTertiary }]}>{subtitle}</Text>}
    </View>
  );
}

interface ChartSectionProps {
  title: string;
  children: React.ReactNode;
  colors: ThemeColors;
}

function ChartSection({ title, children, colors }: ChartSectionProps) {
  return (
    <View style={styles.chartSection}>
      <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>{title}</Text>
      {children}
    </View>
  );
}

export default function StatisticsScreen() {
  const { dreams, loaded } = useDreams();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { formatNumber, formatDate, formatPercent } = useLocaleFormatting();
  const stats = useDreamStatistics(dreams);

  if (!loaded) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundDark }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('stats.title')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('stats.loading')}</Text>
        </View>
      </View>
    );
  }

  if (dreams.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundDark }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('stats.title')}</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>{t('stats.empty')}</Text>
        </View>
      </View>
    );
  }

  const dreamTypeColors = [
    colors.accent,
    colors.accentDark,
    colors.timeline,
    colors.backgroundSecondary,
    colors.textSecondary,
  ];

  const pieLabelLineConfig: LabelLineConfig = {
    length: PIE_LABEL_LINE_LENGTH,
    tailLength: PIE_LABEL_TAIL_LENGTH,
    color: colors.textSecondary,
    thickness: 1,
    labelComponentWidth: PIE_LABEL_WIDTH,
    labelComponentHeight: PIE_LABEL_HEIGHT,
    labelComponentMargin: PIE_LABEL_MARGIN,
    avoidOverlappingOfLabels: true,
  };

  const topDreamTypes = stats.dreamTypeDistribution.slice(0, 5);

  const pieChartData: DreamPieDataItem[] = topDreamTypes.map((item, index) => {
    const typeLines = splitLabelText(item.type);
    const labelHeight = getLabelHeight(typeLines.length);

    return {
      value: item.count,
      color: dreamTypeColors[index % dreamTypeColors.length],
      count: item.count,
      percentage: item.percentage,
      typeLabel: item.type,
      typeLines,
      labelHeight,
      labelLineConfig: {
        ...pieLabelLineConfig,
        labelComponentHeight: labelHeight,
      },
    };
  });

  const renderPieExternalLabel = (pieItem?: pieDataItem) => {
    if (!pieItem) return null;
    const typedItem = pieItem as DreamPieDataItem;
    const labelHeight = typedItem.labelHeight || PIE_LABEL_HEIGHT;
    const labelTop = -labelHeight;
    const textX = LABEL_TEXT_MARGIN;
    const typeLines = typedItem.typeLines?.length ? typedItem.typeLines : [typedItem.typeLabel];
    const typeStartY = labelTop + LABEL_VERTICAL_PADDING + 12;
    const detailY =
      labelTop + LABEL_VERTICAL_PADDING + typeLines.length * LABEL_TEXT_LINE_HEIGHT + LABEL_DETAIL_LINE_HEIGHT - 2;
    const detailText = `${formatNumber(typedItem.count)} · ${formatPercent(typedItem.percentage / 100)}`;

    return (
      <>
        <Rect
          x={0}
          y={labelTop}
          width={PIE_LABEL_WIDTH}
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
            key={`${typedItem.typeLabel}-${line}-${lineIndex}`}
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
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDark }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('stats.title')}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Overview Cards */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('stats.section.overview')}</Text>
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
        </View>

        {/* Streaks */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('stats.section.streaks')}</Text>
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
        </View>

        {/* Dream Type Distribution */}
        {stats.dreamTypeDistribution.length > 0 && (
          <ChartSection title={t('stats.section.dream_types')} colors={colors}>
            <View style={styles.chartContainer}>
              <View style={styles.pieChartWrapper}>
                <PieChart
                  data={pieChartData}
                  donut
                  radius={PIE_RADIUS}
                  innerRadius={PIE_INNER_RADIUS}
                  paddingHorizontal={PIE_PADDING_HORIZONTAL}
                  showExternalLabels
                  labelLineConfig={pieLabelLineConfig}
                  externalLabelComponent={renderPieExternalLabel}
                  centerLabelComponent={() => (
                    <View>
                      <Text style={styles.pieChartCenterText}>{formatNumber(stats.totalDreams)}</Text>
                      <Text style={styles.pieChartCenterSubtext}>{t('stats.chart.pie_center')}</Text>
                    </View>
                  )}
                />
              </View>
              <View style={styles.legendContainer}>
                {topDreamTypes.map((item, index) => (
                  <View key={item.type} style={styles.legendItem}>
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
          </ChartSection>
        )}

        {/* Top Themes */}
        {stats.topThemes.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('stats.section.top_themes')}</Text>
            <View style={styles.themesContainer}>
              {stats.topThemes.map((theme, index) => (
                <View key={theme.theme} style={[styles.themeItem, { backgroundColor: colors.backgroundCard }]}>
                  <View style={[styles.themeRank, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.themeRankText, { color: colors.backgroundCard }]}>{index + 1}</Text>
                  </View>
                  <View style={styles.themeContent}>
                    <Text style={[styles.themeText, { color: colors.textPrimary }]}>{theme.theme}</Text>
                    <Text style={[styles.themeCount, { color: colors.textSecondary }]}>
                      {t('stats.legend.count', { count: formatNumber(theme.count) })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Engagement */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('stats.section.engagement')}</Text>
          <View style={styles.statsRow}>
            <StatCard
              title={t('stats.engagement.total_chats')}
              value={formatNumber(stats.totalChatMessages)}
              colors={colors}
            />
            <StatCard
              title={t('stats.engagement.dreams_with_chat')}
              value={formatNumber(stats.dreamsWithChat)}
              colors={colors}
            />
          </View>
          {stats.mostDiscussedDream && (
            <View style={[styles.mostDiscussedCard, { backgroundColor: colors.backgroundCard }]}>
              <Text style={[styles.mostDiscussedTitle, { color: colors.textSecondary }]}>{t('stats.engagement.most_discussed')}</Text>
              <Text style={[styles.mostDiscussedDreamTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {stats.mostDiscussedDream.title}
              </Text>
              <Text style={[styles.mostDiscussedCount, { color: colors.accent }]}>
                {t('stats.engagement.messages', {
                  count: formatNumber(stats.mostDiscussedDream.chatHistory.length),
                })}
              </Text>
            </View>
          )}
        </View>

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: ThemeLayout.spacing.sm,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: ThemeLayout.spacing.md,
  },
  section: {
    marginBottom: ThemeLayout.spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: ThemeLayout.spacing.md,
  },
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
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    marginBottom: ThemeLayout.spacing.xs,
  },
  statValue: {
    fontSize: 28,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  statSubtitle: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    marginTop: ThemeLayout.spacing.xs,
  },
  chartSection: {
    marginBottom: ThemeLayout.spacing.lg,
  },
  chartTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: ThemeLayout.spacing.md,
  },
  chartContainer: {
    borderRadius: ThemeLayout.borderRadius.md,
    padding: ThemeLayout.spacing.md,
    alignItems: 'center',
  },
  chartAxisText: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  chartLabelText: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  pieChartWrapper: {
    alignItems: 'center',
    marginBottom: ThemeLayout.spacing.md,
  },
  pieChartCenterText: {
    fontSize: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    textAlign: 'center',
  },
  pieChartCenterSubtext: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
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
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    textTransform: 'capitalize',
  },
  themesContainer: {
    gap: ThemeLayout.spacing.sm,
  },
  themeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: ThemeLayout.borderRadius.md,
    padding: ThemeLayout.spacing.md,
    gap: ThemeLayout.spacing.md,
  },
  themeRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeRankText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  themeContent: {
    flex: 1,
  },
  themeText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  themeCount: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  mostDiscussedCard: {
    marginTop: ThemeLayout.spacing.sm,
    borderRadius: ThemeLayout.borderRadius.md,
    padding: ThemeLayout.spacing.md,
  },
  mostDiscussedTitle: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    marginBottom: ThemeLayout.spacing.xs,
  },
  mostDiscussedDreamTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: ThemeLayout.spacing.xs,
  },
  mostDiscussedCount: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ThemeLayout.spacing.lg,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_400Regular',
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomPadding: {
    height: ThemeLayout.spacing.xl,
  },
});
