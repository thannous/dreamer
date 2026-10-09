import { useQuickSettings } from '@/context/QuickSettingsContext';
import { JournalCompletenessNotice } from '@/components/journal/JournalCompletenessNotice';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useCallback, useMemo } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { MockNavigationRail } from '@/components/dev/MockNavigationRail';
import { NoctaliaScreenHeader } from '@/components/NoctaliaScreenHeader';
import { ScreenContainer } from '@/components/ScreenContainer';
import { StatsEvolutionBars } from '@/components/stats/StatsEvolutionBars';
import { StatsRankedList, type StatsRankedRow } from '@/components/stats/StatsRankedList';
import { DESKTOP_BREAKPOINT, getBottomNavigationLayout } from '@/constants/layout';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useDreams } from '@/context/DreamsContext';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useTranslation } from '@/hooks/useTranslation';
import {
  buildDreamTrends,
  type DreamTrendsFacet,
  type DreamTrendsNextAction,
} from '@/lib/dreamTrends';
import { getDreamThemeLabel, getDreamTypeLabel, getEmotionFamilyLabel } from '@/lib/dreamLabels';
import { TID } from '@/lib/testIDs';

const COMPACT_BREAKPOINT = 360;

const NEXT_ACTION_KEYS: Record<
  DreamTrendsNextAction,
  { label: string; href: '/recording' | '/(tabs)/journal' }
> = {
  capture_first: { label: 'trends.cta.capture_first', href: '/recording' },
  capture_this_week: { label: 'trends.cta.capture_this_week', href: '/recording' },
  keep_rhythm: { label: 'trends.cta.keep_rhythm', href: '/recording' },
  wait_for_patterns: { label: 'trends.cta.wait_for_patterns', href: '/(tabs)/journal' },
  review_patterns: { label: 'trends.cta.review_patterns', href: '/(tabs)/journal' },
};

function dateFromLocalKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part));
  return new Date(year || 0, (month || 1) - 1, day || 1);
}

function dreamCountLabel(
  count: number,
  t: (key: string, params?: Record<string, string | number>) => string,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
): string {
  return t(count === 1 ? 'stats.legend.count_one' : 'stats.legend.count', {
    count: formatNumber(count),
  });
}

// Hermes can expose date/number formatters without Intl.PluralRules. Keep the
// cardinal rules for the six shipped locales when that constructor is absent.
function averageDreamCountKey(count: number, locale: string): string {
  const singular = typeof Intl.PluralRules === 'function'
    ? new Intl.PluralRules(locale).select(count) === 'one'
    : locale.startsWith('fr') || locale.startsWith('pt-BR')
      ? count >= 0 && count < 2
      : count === 1;
  return singular ? 'stats.legend.count_one' : 'stats.legend.count';
}

function toRankedRows<T extends string>(
  facets: DreamTrendsFacet<T>[],
  labelOf: (value: T) => string,
  t: (key: string, params?: Record<string, string | number>) => string,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
): StatsRankedRow[] {
  return facets.map((facet) => ({
    id: facet.value,
    label: labelOf(facet.value),
    count: facet.count,
    countLabel: dreamCountLabel(facet.count, t, formatNumber),
  }));
}

/** Section opening shared with the symbol sheets and noctalia.app: champagne mark, serif title. */
function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="gap-1">
      <View className="mb-2 h-[2px] w-7 rounded-full bg-champagne" />
      <Text accessibilityRole="header" className="text-[25px] leading-[31px] font-display-semibold text-ivory">
        {title}
      </Text>
      {subtitle ? <Text className="text-[13px] leading-[19px] font-sans text-ivory-muted">{subtitle}</Text> : null}
    </View>
  );
}

export default function StatisticsScreen() {
  const { dreams, loaded, completeness, reloadDreams } = useDreams();
  const { t } = useTranslation();
  const { formatDate, formatNumber, locale } = useLocaleFormatting();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();
  const openQuickSettings = useQuickSettings();
  useClearWebFocus();

  const compact = width < COMPACT_BREAKPOINT;
  const largeText = Number.isFinite(fontScale) && fontScale >= 1.3;
  const stackWeekMetrics = largeText;
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const isDesktopLayout = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
  const navigationLayout = getBottomNavigationLayout(width, height, fontScale);
  const scrollHeader = !isDesktopLayout && navigationLayout.compact && navigationLayout.largeText;
  const navigationClearance = navigationLayout.barHeight + Math.max(insets.bottom, navigationLayout.minimumBottomInset);
  const scrollBottomPadding = isDesktopLayout
    ? ThemeLayout.spacing.xl
    : scrollHeader ? ThemeLayout.spacing.lg : navigationLayout.barHeight
      + navigationLayout.minimumBottomInset
      + ThemeLayout.spacing.lg;

  const { trends, weekStart, weekEnd } = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return { trends: buildDreamTrends(dreams, { now: end.getTime() }), weekStart: start, weekEnd: end };
  }, [dreams]);
  const cta = NEXT_ACTION_KEYS[trends.evolution.nextAction];

  const handlePrimaryCta = useCallback(() => {
    router.push(cta.href);
  }, [cta.href]);

  const header = (
    <NoctaliaScreenHeader
      titleKey="trends.title"
      variant="tab"
      actions={[
        {
          icon: 'gear',
          onPress: openQuickSettings,
          accessibilityLabel: t('nav.settings'),
          testID: TID.Button.HeaderTrendsSettings,
        },
      ]}
    />
  );

  const primaryCta = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(cta.label)}
      testID="trends.cta.primary"
      onPress={handlePrimaryCta}
      className="min-h-[50px] rounded-[18px] border border-champagne-soft bg-champagne px-[18px] items-center justify-center"
    >
      <Text className="text-[15px] font-sans-bold text-on-champagne">
        {t(cta.label)}
      </Text>
    </Pressable>
  );

  if (!loaded) {
    const loadingMessage = (
      <View className={`${scrollHeader ? 'shrink-0' : 'flex-1'} items-center justify-center px-6`} accessibilityLiveRegion="polite">
        <Text className="text-[16px] font-sans text-ivory-muted text-center">
          {t('trends.loading')}
        </Text>
      </View>
    );
    return (
      <View className="flex-1 bg-ink" accessible accessibilityRole="progressbar" accessibilityLabel={t('trends.loading')}>
        {scrollHeader ? (
          <ScrollView
            className="flex-1"
            style={{ marginBottom: navigationClearance }}
            contentInsetAdjustmentBehavior="never"
            contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
          >
            {header}
            {loadingMessage}
          </ScrollView>
        ) : (
          <>
            {header}
            {loadingMessage}
          </>
        )}
      </View>
    );
  }

  const week = trends.week;
  const patterns = trends.patterns;
  const evolution = trends.evolution;
  const showAverage = week.averagePerWeek != null;
  const metricClassName = stackWeekMetrics
    ? 'w-full min-w-0 gap-1'
    : 'min-w-0 flex-1 gap-1';
  const rangeLabel = t('trends.week.range', {
    start: formatDate(weekStart, { day: 'numeric', month: 'short' }),
    end: formatDate(weekEnd, { day: 'numeric', month: 'short', year: 'numeric' }),
  });
  const daysLabel = (count: number) => t(
    count === 1 ? 'trends.week.active_days.value_one' : 'trends.week.active_days.value',
    { count: formatNumber(count) },
  );
  const secondaryMetrics = [
    { key: 'current', label: t('trends.week.streak.current'), value: daysLabel(week.streak.current) },
    { key: 'longest', label: t('trends.week.streak.longest'), value: daysLabel(week.streak.longest) },
    ...(showAverage ? [{
      key: 'average',
      label: t('trends.week.average'),
      value: t(averageDreamCountKey(week.averagePerWeek as number, locale), {
        count: formatNumber(week.averagePerWeek as number, { maximumFractionDigits: 1 }),
      }),
    }] : []),
    ...(week.lastActivityAt != null ? [{
      key: 'last',
      label: t('trends.week.last_activity'),
      value: formatDate(week.lastActivityAt, { dateStyle: 'medium' }),
    }] : []),
  ];
  const themeRows = toRankedRows(
    patterns.themes,
    (value) => getDreamThemeLabel(value, t) ?? value,
    t,
    formatNumber,
  );
  const emotionRows = toRankedRows(
    patterns.emotions,
    (value) => getEmotionFamilyLabel(value, t) ?? value,
    t,
    formatNumber,
  );
  const typeRows = toRankedRows(
    patterns.types,
    (value) => getDreamTypeLabel(value, t) ?? value,
    t,
    formatNumber,
  );

  return (
    <View className="flex-1 bg-ink">
      <ScrollView
        className="flex-1"
        style={scrollHeader ? { marginBottom: navigationClearance } : undefined}
        // The header scrolls away with the content, as on Today. It already owns
        // the top safe-area padding, so iOS must not add that inset again.
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {header}
        <ScreenContainer key="resources">
          <MockNavigationRail />
          <JournalCompletenessNotice status={completeness?.status} trends onRetry={() => { void reloadDreams(); }} />
          <View className="gap-6 px-5 pb-5 pt-2">
            <View className="gap-4" testID="trends.section.week" accessible={false} accessibilityRole="none">
              <View className="flex-row items-start gap-3 border-b border-line pb-4">
                <View className="mt-[9px] h-px w-[22px] bg-champagne" />
                <Text accessibilityRole="header" className="min-w-0 shrink text-[12px] leading-[18px] font-sans-medium uppercase tracking-[1.6px] text-champagne-on">
                  {rangeLabel} · {t('trends.section.week')}
                </Text>
              </View>
              <View
                className={stackWeekMetrics ? 'flex-col gap-5' : 'flex-row flex-wrap gap-6'}
                testID={stackWeekMetrics ? 'trends.week.metrics.stacked' : 'trends.week.metrics.inline'}
              >
                <View className={metricClassName}>
                  <Text testID="trends.week.count.value" className="text-[56px] leading-[64px] font-display-semibold text-ivory">
                    {formatNumber(week.count)}
                  </Text>
                  <Text className="shrink text-[14px] leading-[20px] font-sans text-ivory">{t('trends.week.count')}</Text>
                </View>
                <View className={`${metricClassName}${stackWeekMetrics ? '' : ' border-l border-line pl-5'}`}>
                  <Text testID="trends.week.activeDays.value" className="text-[56px] leading-[64px] font-display-semibold text-ivory">
                    {formatNumber(week.activeDays)}
                  </Text>
                  <Text className="shrink text-[14px] leading-[20px] font-sans text-ivory">{t('trends.week.active_days')}</Text>
                </View>
              </View>
            </View>

            <View className="gap-4" testID="trends.section.patterns" accessible={false} accessibilityRole="none">
              <SectionHead
                title={t(themeRows.length > 0 || patterns.empty ? 'trends.patterns.themes' : 'trends.section.patterns')}
                subtitle={t('trends.patterns.scope')}
              />
              {patterns.empty ? (
                <Text accessibilityRole="text" className="text-[15px] leading-[23px] font-sans text-ivory-muted">
                  {t('trends.patterns.empty')}
                </Text>
              ) : themeRows.length > 0 ? (
                <View className="gap-3">
                  <StatsRankedList
                    noctalia={noctalia}
                    rows={themeRows}
                    maxCount={Math.max(...themeRows.map((row) => row.count), 1)}
                    testID="trends.patterns.themes.list"
                  />
                  <Text className="text-[13px] leading-[19px] font-sans text-ivory-muted">{t('trends.patterns.legend')}</Text>
                </View>
              ) : null}

              <View className="mt-2 border-t border-line" testID="trends.week.details">
                {secondaryMetrics.map((metric) => (
                  <View key={metric.key} className="flex-row items-baseline gap-4 border-b border-line py-3">
                    <Text className="min-w-0 flex-1 text-[14px] leading-[21px] font-sans text-ivory-muted">{metric.label}</Text>
                    <Text className="max-w-[45%] shrink text-right text-[15px] leading-[21px] font-display-semibold text-ivory">{metric.value}</Text>
                  </View>
                ))}
                {week.lastActivityAt == null ? (
                  <Text className="pt-3 text-[14px] leading-[21px] font-sans text-ivory-muted">{t('trends.week.last_activity.empty')}</Text>
                ) : null}
              </View>

              {!patterns.empty ? (
                <View className="gap-6 pt-3">
                  {emotionRows.length > 0 ? (
                    <View className="gap-2">
                      <Text accessibilityRole="header" className="text-[19px] leading-[25px] font-display-semibold text-ivory">{t('trends.patterns.emotions')}</Text>
                      <StatsRankedList noctalia={noctalia} rows={emotionRows}
                        maxCount={Math.max(...emotionRows.map((row) => row.count), 1)} testID="trends.patterns.emotions.list" />
                    </View>
                  ) : null}
                  {typeRows.length > 0 ? (
                    <View className="gap-2">
                      <Text accessibilityRole="header" className="text-[19px] leading-[25px] font-display-semibold text-ivory">{t('trends.patterns.types')}</Text>
                      <StatsRankedList noctalia={noctalia} rows={typeRows}
                        maxCount={Math.max(...typeRows.map((row) => row.count), 1)} testID="trends.patterns.types.list" />
                    </View>
                  ) : null}
                  {patterns.recurrence.hasRecurrence ? (
                    <Text className="text-[15px] leading-[22px] font-sans text-ivory">
                      {t(patterns.recurrence.count === 1 ? 'trends.patterns.recurrence_one' : 'trends.patterns.recurrence',
                        { count: formatNumber(patterns.recurrence.count) })}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View
              className="gap-4 border-t border-line pt-7"
              testID="trends.section.evolution"
              accessible={false}
              accessibilityRole="none"
            >
              <SectionHead title={t('trends.section.evolution')} />
              {evolution.days.length === 0 ? (
                <Text className="text-[15px] font-sans text-ivory-muted">
                  {t('trends.evolution.empty')}
                </Text>
              ) : (
                <StatsEvolutionBars
                  compact={compact}
                  testID="trends.evolution.chart"
                  days={evolution.days.map((day) => {
                    const themeLabel = getDreamThemeLabel(day.dominantTheme, t) ?? day.dominantTheme;
                    const dateLabel = formatDate(dateFromLocalKey(day.dateKey), {
                      day: 'numeric',
                      month: 'short',
                    });
                    return {
                      dateKey: day.dateKey,
                      dateLabel,
                      themeLabel,
                      count: day.total,
                      countLabel: dreamCountLabel(day.total, t, formatNumber),
                      accessibilityLabel: t('trends.evolution.point', {
                        date: dateLabel,
                        theme: themeLabel,
                        count: formatNumber(day.total),
                      }),
                    };
                  })}
                />
              )}
              <Text className="text-[14px] font-sans text-ivory-muted">
                {t(`trends.evolution.next.${evolution.nextAction}`)}
              </Text>
            </View>

            {primaryCta}
            {compact ? <View testID="trends.layout.compact" /> : null}
          </View>
        </ScreenContainer>
      </ScrollView>
    </View>
  );
}
