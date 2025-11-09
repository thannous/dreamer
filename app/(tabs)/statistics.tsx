import { ThemeLayout } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';
import { useDreams } from '@/context/DreamsContext';
import { useDreamStatistics } from '@/hooks/useDreamStatistics';
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
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - ThemeLayout.spacing.md * 4;

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
  const stats = useDreamStatistics(dreams);
  const { t } = useTranslation();
  const { colors } = useTheme();

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

  const barChartData = stats.dreamsByDay.map((item) => ({
    value: item.count,
    label: item.day,
    frontColor: colors.accent,
  }));

  const lineChartData = stats.dreamsOverTime.map((item) => ({
    value: item.count,
    label: item.date,
  }));

  const pieChartData = stats.dreamTypeDistribution.slice(0, 5).map((item, index) => {
    const chartColors = [
      colors.accent,
      colors.accentDark,
      colors.timeline,
      colors.backgroundSecondary,
      colors.textSecondary,
    ];
    return {
      value: item.count,
      color: chartColors[index % chartColors.length],
      text: `${item.percentage}%`,
      label: item.type,
    };
  });

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
              value={stats.totalDreams}
              colors={colors}
            />
            <StatCard
              title={t('stats.card.favorites')}
              value={stats.favoriteDreams}
              colors={colors}
            />
            <StatCard
              title={t('stats.card.this_week')}
              value={stats.dreamsThisWeek}
              colors={colors}
            />
            <StatCard
              title={t('stats.card.this_month')}
              value={stats.dreamsThisMonth}
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
              value={stats.currentStreak}
              subtitle={stats.currentStreak === 1 ? t('stats.card.day') : t('stats.card.days')}
              colors={colors}
            />
            <StatCard
              title={t('stats.card.longest_streak')}
              value={stats.longestStreak}
              subtitle={stats.longestStreak === 1 ? t('stats.card.day') : t('stats.card.days')}
              colors={colors}
            />
          </View>
          <View style={styles.singleStatCard}>
            <StatCard
              title={t('stats.card.average_per_week')}
              value={stats.averageDreamsPerWeek.toFixed(1)}
              colors={colors}
            />
          </View>
        </View>

        {/* Dreams by Day of Week */}
        {stats.dreamsByDay.some(d => d.count > 0) && (
          <ChartSection title={t('stats.section.dreams_by_day')} colors={colors}>
            <View style={styles.chartContainer}>
              <BarChart
                data={barChartData}
                width={CHART_WIDTH}
                height={200}
                barWidth={28}
                spacing={12}
                roundedTop
                roundedBottom
                hideRules
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisTextStyle={[styles.chartAxisText, { color: colors.textSecondary }]}
                xAxisLabelTextStyle={[styles.chartLabelText, { color: colors.textSecondary }]}
                noOfSections={4}
                maxValue={Math.max(...stats.dreamsByDay.map(d => d.count)) + 1}
                backgroundColor={colors.backgroundCard}
                showGradient
                gradientColor={colors.accentDark}
              />
            </View>
          </ChartSection>
        )}

        {/* Dreams Over Time (Last 30 Days) */}
        {stats.dreamsOverTime.some(d => d.count > 0) && (
          <ChartSection title={t('stats.section.dreams_over_time')} colors={colors}>
            <View style={styles.chartContainer}>
              <LineChart
                data={lineChartData}
                width={CHART_WIDTH}
                height={200}
                spacing={CHART_WIDTH / lineChartData.length}
                color={colors.accent}
                thickness={3}
                startFillColor={colors.accent}
                endFillColor={colors.backgroundCard}
                startOpacity={0.4}
                endOpacity={0.1}
                areaChart
                hideDataPoints
                hideRules
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisTextStyle={[styles.chartAxisText, { color: colors.textSecondary }]}
                noOfSections={4}
                maxValue={Math.max(...stats.dreamsOverTime.map(d => d.count)) + 1}
                backgroundColor={colors.backgroundCard}
                curved
              />
            </View>
          </ChartSection>
        )}

        {/* Dream Type Distribution */}
        {stats.dreamTypeDistribution.length > 0 && (
          <ChartSection title={t('stats.section.dream_types')} colors={colors}>
            <View style={styles.chartContainer}>
              <View style={styles.pieChartWrapper}>
                <PieChart
                  data={pieChartData}
                  donut
                  radius={90}
                  innerRadius={60}
                  centerLabelComponent={() => (
                    <View>
                      <Text style={styles.pieChartCenterText}>{stats.totalDreams}</Text>
                      <Text style={styles.pieChartCenterSubtext}>{t('stats.chart.pie_center')}</Text>
                    </View>
                  )}
                />
              </View>
              <View style={styles.legendContainer}>
                {stats.dreamTypeDistribution.slice(0, 5).map((item, index) => {
                  const chartColors = [
                    colors.accent,
                    colors.accentDark,
                    colors.timeline,
                    colors.backgroundSecondary,
                    colors.textSecondary,
                  ];
                  return (
                    <View key={item.type} style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendColor,
                          { backgroundColor: chartColors[index % chartColors.length] },
                        ]}
                      />
                      <Text style={[styles.legendText, { color: colors.textPrimary }]}>
                        {item.type} ({t('stats.legend.count', { count: item.count })})
                      </Text>
                    </View>
                  );
                })}
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
                    <Text style={[styles.themeCount, { color: colors.textSecondary }]}>{t('stats.legend.count', { count: theme.count })}</Text>
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
              value={stats.totalChatMessages}
              colors={colors}
            />
            <StatCard
              title={t('stats.engagement.dreams_with_chat')}
              value={stats.dreamsWithChat}
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
                  count: stats.mostDiscussedDream.chatHistory.length,
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
