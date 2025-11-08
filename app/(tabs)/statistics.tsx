import { JournalTheme } from '@/constants/journalTheme';
import { useDreams } from '@/context/DreamsContext';
import { useDreamStatistics } from '@/hooks/useDreamStatistics';
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
const CHART_WIDTH = SCREEN_WIDTH - JournalTheme.spacing.md * 4;

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
}

function StatCard({ title, value, subtitle }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );
}

interface ChartSectionProps {
  title: string;
  children: React.ReactNode;
}

function ChartSection({ title, children }: ChartSectionProps) {
  return (
    <View style={styles.chartSection}>
      <Text style={styles.chartTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function StatisticsScreen() {
  const { dreams, loaded } = useDreams();
  const stats = useDreamStatistics(dreams);

  if (!loaded) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Statistics</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading statistics...</Text>
        </View>
      </View>
    );
  }

  if (dreams.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Statistics</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No dreams yet.{'\n'}Start recording to see your statistics!
          </Text>
        </View>
      </View>
    );
  }

  const barChartData = stats.dreamsByDay.map((item) => ({
    value: item.count,
    label: item.day,
    frontColor: JournalTheme.accent,
  }));

  const lineChartData = stats.dreamsOverTime.map((item) => ({
    value: item.count,
    label: item.date,
  }));

  const pieChartData = stats.dreamTypeDistribution.slice(0, 5).map((item, index) => {
    const colors = [
      JournalTheme.accent,
      '#9D84B7',
      '#6B5A8E',
      '#4f3d6b',
      '#a097b8',
    ];
    return {
      value: item.count,
      color: colors[index % colors.length],
      text: `${item.percentage}%`,
      label: item.type,
    };
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Statistics</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Overview Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Total Dreams"
              value={stats.totalDreams}
            />
            <StatCard
              title="Favorites"
              value={stats.favoriteDreams}
            />
            <StatCard
              title="This Week"
              value={stats.dreamsThisWeek}
            />
            <StatCard
              title="This Month"
              value={stats.dreamsThisMonth}
            />
          </View>
        </View>

        {/* Streaks */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Streaks</Text>
          <View style={styles.statsRow}>
            <StatCard
              title="Current Streak"
              value={stats.currentStreak}
              subtitle={stats.currentStreak === 1 ? 'day' : 'days'}
            />
            <StatCard
              title="Longest Streak"
              value={stats.longestStreak}
              subtitle={stats.longestStreak === 1 ? 'day' : 'days'}
            />
          </View>
          <View style={styles.singleStatCard}>
            <StatCard
              title="Average Dreams Per Week"
              value={stats.averageDreamsPerWeek.toFixed(1)}
            />
          </View>
        </View>

        {/* Dreams by Day of Week */}
        {stats.dreamsByDay.some(d => d.count > 0) && (
          <ChartSection title="Dreams by Day of Week">
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
                yAxisTextStyle={styles.chartAxisText}
                xAxisLabelTextStyle={styles.chartLabelText}
                noOfSections={4}
                maxValue={Math.max(...stats.dreamsByDay.map(d => d.count)) + 1}
                backgroundColor={JournalTheme.backgroundCard}
                showGradient
                gradientColor={JournalTheme.accentDark}
              />
            </View>
          </ChartSection>
        )}

        {/* Dreams Over Time (Last 30 Days) */}
        {stats.dreamsOverTime.some(d => d.count > 0) && (
          <ChartSection title="Dreams Over Time (Last 30 Days)">
            <View style={styles.chartContainer}>
              <LineChart
                data={lineChartData}
                width={CHART_WIDTH}
                height={200}
                spacing={CHART_WIDTH / lineChartData.length}
                color={JournalTheme.accent}
                thickness={3}
                startFillColor={JournalTheme.accent}
                endFillColor={JournalTheme.backgroundCard}
                startOpacity={0.4}
                endOpacity={0.1}
                areaChart
                hideDataPoints
                hideRules
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisTextStyle={styles.chartAxisText}
                noOfSections={4}
                maxValue={Math.max(...stats.dreamsOverTime.map(d => d.count)) + 1}
                backgroundColor={JournalTheme.backgroundCard}
                curved
              />
            </View>
          </ChartSection>
        )}

        {/* Dream Type Distribution */}
        {stats.dreamTypeDistribution.length > 0 && (
          <ChartSection title="Dream Types">
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
                      <Text style={styles.pieChartCenterSubtext}>Total</Text>
                    </View>
                  )}
                />
              </View>
              <View style={styles.legendContainer}>
                {stats.dreamTypeDistribution.slice(0, 5).map((item, index) => {
                  const colors = [
                    JournalTheme.accent,
                    '#9D84B7',
                    '#6B5A8E',
                    '#4f3d6b',
                    '#a097b8',
                  ];
                  return (
                    <View key={item.type} style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendColor,
                          { backgroundColor: colors[index % colors.length] },
                        ]}
                      />
                      <Text style={styles.legendText}>
                        {item.type} ({item.count})
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
            <Text style={styles.sectionTitle}>Top Themes</Text>
            <View style={styles.themesContainer}>
              {stats.topThemes.map((theme, index) => (
                <View key={theme.theme} style={styles.themeItem}>
                  <View style={styles.themeRank}>
                    <Text style={styles.themeRankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.themeContent}>
                    <Text style={styles.themeText}>{theme.theme}</Text>
                    <Text style={styles.themeCount}>{theme.count} dreams</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Engagement */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Engagement</Text>
          <View style={styles.statsRow}>
            <StatCard
              title="Total Chats"
              value={stats.totalChatMessages}
            />
            <StatCard
              title="Dreams with Chat"
              value={stats.dreamsWithChat}
            />
          </View>
          {stats.mostDiscussedDream && (
            <View style={styles.mostDiscussedCard}>
              <Text style={styles.mostDiscussedTitle}>Most Discussed Dream</Text>
              <Text style={styles.mostDiscussedDreamTitle} numberOfLines={1}>
                {stats.mostDiscussedDream.title}
              </Text>
              <Text style={styles.mostDiscussedCount}>
                {stats.mostDiscussedDream.chatHistory.length} messages
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
    backgroundColor: JournalTheme.backgroundDark,
  },
  header: {
    paddingHorizontal: JournalTheme.spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: JournalTheme.spacing.sm,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: JournalTheme.textPrimary,
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: JournalTheme.spacing.md,
  },
  section: {
    marginBottom: JournalTheme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: JournalTheme.textPrimary,
    marginBottom: JournalTheme.spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: JournalTheme.spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: JournalTheme.spacing.sm,
  },
  singleStatCard: {
    marginTop: JournalTheme.spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: JournalTheme.backgroundCard,
    borderRadius: JournalTheme.borderRadius.md,
    padding: JournalTheme.spacing.md,
    minWidth: '48%',
  },
  statTitle: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textSecondary,
    marginBottom: JournalTheme.spacing.xs,
  },
  statValue: {
    fontSize: 28,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: JournalTheme.accent,
  },
  statSubtitle: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textTertiary,
    marginTop: JournalTheme.spacing.xs,
  },
  chartSection: {
    marginBottom: JournalTheme.spacing.lg,
  },
  chartTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: JournalTheme.textPrimary,
    marginBottom: JournalTheme.spacing.md,
  },
  chartContainer: {
    backgroundColor: JournalTheme.backgroundCard,
    borderRadius: JournalTheme.borderRadius.md,
    padding: JournalTheme.spacing.md,
    alignItems: 'center',
  },
  chartAxisText: {
    color: JournalTheme.textSecondary,
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  chartLabelText: {
    color: JournalTheme.textSecondary,
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  pieChartWrapper: {
    alignItems: 'center',
    marginBottom: JournalTheme.spacing.md,
  },
  pieChartCenterText: {
    fontSize: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: JournalTheme.textPrimary,
    textAlign: 'center',
  },
  pieChartCenterSubtext: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textSecondary,
    textAlign: 'center',
  },
  legendContainer: {
    width: '100%',
    gap: JournalTheme.spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: JournalTheme.spacing.sm,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textPrimary,
    textTransform: 'capitalize',
  },
  themesContainer: {
    gap: JournalTheme.spacing.sm,
  },
  themeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: JournalTheme.backgroundCard,
    borderRadius: JournalTheme.borderRadius.md,
    padding: JournalTheme.spacing.md,
    gap: JournalTheme.spacing.md,
  },
  themeRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: JournalTheme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeRankText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: JournalTheme.backgroundCard,
  },
  themeContent: {
    flex: 1,
  },
  themeText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: JournalTheme.textPrimary,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  themeCount: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textSecondary,
  },
  mostDiscussedCard: {
    marginTop: JournalTheme.spacing.sm,
    backgroundColor: JournalTheme.backgroundCard,
    borderRadius: JournalTheme.borderRadius.md,
    padding: JournalTheme.spacing.md,
  },
  mostDiscussedTitle: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textSecondary,
    marginBottom: JournalTheme.spacing.xs,
  },
  mostDiscussedDreamTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: JournalTheme.textPrimary,
    marginBottom: JournalTheme.spacing.xs,
  },
  mostDiscussedCount: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: JournalTheme.accent,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: JournalTheme.spacing.lg,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomPadding: {
    height: JournalTheme.spacing.xl,
  },
});
