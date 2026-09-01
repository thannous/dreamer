import { router } from 'expo-router';
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
import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { NoctaliaScreenHeader } from '@/components/NoctaliaScreenHeader';
import { ScreenContainer } from '@/components/ScreenContainer';
import { DESKTOP_BREAKPOINT, getBottomNavigationLayout } from '@/constants/layout';
import { ThemeLayout } from '@/constants/journalTheme';
import { useDreams } from '@/context/DreamsContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useTranslation } from '@/hooks/useTranslation';
import { buildDreamTrends, type DreamTrendsNextAction } from '@/lib/dreamTrends';
import { getDreamThemeLabel, getDreamTypeLabel, getEmotionFamilyLabel } from '@/lib/dreamLabels';
import { TID } from '@/lib/testIDs';

const WEEKDAY_KEYS = [
  'trends.week.weekday.mon',
  'trends.week.weekday.tue',
  'trends.week.weekday.wed',
  'trends.week.weekday.thu',
  'trends.week.weekday.fri',
  'trends.week.weekday.sat',
  'trends.week.weekday.sun',
] as const;

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

function weekdayLabelKey(weekday: number): (typeof WEEKDAY_KEYS)[number] {
  if (weekday === 0) return WEEKDAY_KEYS[6];
  if (weekday >= 1 && weekday <= 6) return WEEKDAY_KEYS[weekday - 1];
  return WEEKDAY_KEYS[0];
}

export default function StatisticsScreen() {
  const { dreams, loaded } = useDreams();
  const { t } = useTranslation();
  const { formatDate, formatNumber } = useLocaleFormatting();
  const { width, height } = useWindowDimensions();
  useClearWebFocus();

  const isDesktopLayout = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
  const navigationLayout = getBottomNavigationLayout(width, height);
  const scrollBottomPadding = isDesktopLayout
    ? ThemeLayout.spacing.xl
    : navigationLayout.barHeight
      + navigationLayout.minimumBottomInset
      + ThemeLayout.spacing.lg;

  const trends = useMemo(() => buildDreamTrends(dreams), [dreams]);
  const cta = NEXT_ACTION_KEYS[trends.evolution.nextAction];

  const handlePrimaryCta = useCallback(() => {
    router.push(cta.href);
  }, [cta.href]);

  const header = (
    <NoctaliaScreenHeader
      titleKey="trends.title"
      actions={[
        {
          icon: 'gear',
          onPress: () => router.push('/(tabs)/settings'),
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
    return (
      <View className="flex-1 bg-ink" accessible accessibilityRole="progressbar" accessibilityLabel={t('trends.loading')}>
        <AtmosphericBackground variant="subtle" />
        {header}
        <View className="flex-1 items-center justify-center px-6" accessibilityLiveRegion="polite">
          <Text className="text-[16px] font-sans text-ivory-muted text-center">
            {t('trends.loading')}
          </Text>
        </View>
      </View>
    );
  }

  const week = trends.week;
  const patterns = trends.patterns;
  const evolution = trends.evolution;
  const showAverage = week.averagePerWeek != null;
  const lastActivityLabel = week.lastActivityAt == null
    ? t('trends.week.last_activity.empty')
    : t('trends.week.last_activity.value', {
        date: formatDate(week.lastActivityAt, { dateStyle: 'medium' }),
      });

  return (
    <View className="flex-1 bg-ink">
      <AtmosphericBackground variant="subtle" />
      {header}
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenContainer>
          <MockNavigationRail />
          <View className="gap-6 p-4">
            <View
              className="gap-4 rounded-[20px] border border-line-strong bg-ink-soft p-5"
              testID="trends.section.week"
              accessibilityRole="summary"
              accessibilityLabel={t('trends.section.week')}
            >
              <Text className="text-[20px] leading-[26px] font-display-semibold text-ivory">
                {t('trends.section.week')}
              </Text>
              <View className="flex-row flex-wrap gap-3">
                <View className="min-w-[140px] flex-1 gap-1">
                  <Text className="text-[12px] font-sans-medium text-ivory-muted">
                    {t('trends.week.count')}
                  </Text>
                  <Text className="text-[22px] font-display-semibold text-ivory">
                    {formatNumber(week.count)}
                  </Text>
                </View>
                <View className="min-w-[140px] flex-1 gap-1">
                  <Text className="text-[12px] font-sans-medium text-ivory-muted">
                    {t('trends.week.active_days')}
                  </Text>
                  <Text className="text-[22px] font-display-semibold text-ivory">
                    {t('trends.week.active_days.value', {
                      count: formatNumber(week.activeDays),
                    })}
                  </Text>
                </View>
                <View className="min-w-[140px] flex-1 gap-1">
                  <Text className="text-[12px] font-sans-medium text-ivory-muted">
                    {t('trends.week.streak.current')}
                  </Text>
                  <Text className="text-[22px] font-display-semibold text-ivory">
                    {formatNumber(week.streak.current)}
                  </Text>
                </View>
                <View className="min-w-[140px] flex-1 gap-1">
                  <Text className="text-[12px] font-sans-medium text-ivory-muted">
                    {t('trends.week.streak.longest')}
                  </Text>
                  <Text className="text-[22px] font-display-semibold text-ivory">
                    {formatNumber(week.streak.longest)}
                  </Text>
                </View>
                {showAverage ? (
                  <View className="min-w-[140px] flex-1 gap-1">
                    <Text className="text-[12px] font-sans-medium text-ivory-muted">
                      {t('trends.week.average')}
                    </Text>
                    <Text className="text-[22px] font-display-semibold text-ivory">
                      {formatNumber(week.averagePerWeek as number, {
                        maximumFractionDigits: 1,
                      })}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-[14px] font-sans text-ivory-muted">
                {lastActivityLabel}
              </Text>
              <View className="flex-row flex-wrap gap-2" accessibilityLabel={t('trends.week.rhythm')}>
                {week.rhythm.map((day) => (
                  <View
                    key={day.weekday}
                    className="min-w-[72px] flex-1 items-center gap-1 rounded-[14px] border border-line bg-ink px-2 py-2"
                  >
                    <Text className="text-[11px] font-sans-medium text-ivory-muted">
                      {t(weekdayLabelKey(day.weekday))}
                    </Text>
                    <Text className="text-[16px] font-display-semibold text-ivory">
                      {formatNumber(day.count)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View
              className="gap-4 rounded-[20px] border border-line-strong bg-ink-soft p-5"
              testID="trends.section.patterns"
              accessibilityRole="summary"
              accessibilityLabel={t('trends.section.patterns')}
            >
              <Text className="text-[20px] leading-[26px] font-display-semibold text-ivory">
                {t('trends.section.patterns')}
              </Text>
              {patterns.empty ? (
                <View
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={t('trends.patterns.empty')}
                >
                  <Text className="text-[15px] font-sans text-ivory-muted">
                    {t('trends.patterns.empty')}
                  </Text>
                </View>
              ) : (
                <View className="gap-4">
                  {patterns.themes.length > 0 ? (
                    <View className="gap-2">
                      <Text className="text-[13px] font-sans-medium text-ivory-muted">
                        {t('trends.patterns.themes')}
                      </Text>
                      {patterns.themes.map((facet) => (
                        <Text key={facet.value} className="text-[15px] font-sans text-ivory">
                          {t('trends.patterns.item', {
                            label: getDreamThemeLabel(facet.value, t) ?? facet.value,
                            count: formatNumber(facet.count),
                          })}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {patterns.emotions.length > 0 ? (
                    <View className="gap-2">
                      <Text className="text-[13px] font-sans-medium text-ivory-muted">
                        {t('trends.patterns.emotions')}
                      </Text>
                      {patterns.emotions.map((facet) => (
                        <Text key={facet.value} className="text-[15px] font-sans text-ivory">
                          {t('trends.patterns.item', {
                            label: getEmotionFamilyLabel(facet.value, t) ?? facet.value,
                            count: formatNumber(facet.count),
                          })}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {patterns.types.length > 0 ? (
                    <View className="gap-2">
                      <Text className="text-[13px] font-sans-medium text-ivory-muted">
                        {t('trends.patterns.types')}
                      </Text>
                      {patterns.types.map((facet) => (
                        <Text key={facet.value} className="text-[15px] font-sans text-ivory">
                          {t('trends.patterns.item', {
                            label: getDreamTypeLabel(facet.value, t) ?? facet.value,
                            count: formatNumber(facet.count),
                          })}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {patterns.recurrence.hasRecurrence ? (
                    <Text className="text-[15px] font-sans text-ivory">
                      {t('trends.patterns.recurrence', {
                        count: formatNumber(patterns.recurrence.count),
                      })}
                    </Text>
                  ) : null}
                </View>
              )}
            </View>

            <View
              className="gap-4 rounded-[20px] border border-line-strong bg-ink-soft p-5"
              testID="trends.section.evolution"
              accessibilityRole="summary"
              accessibilityLabel={t('trends.section.evolution')}
            >
              <Text className="text-[20px] leading-[26px] font-display-semibold text-ivory">
                {t('trends.section.evolution')}
              </Text>
              {evolution.themePoints.length === 0 ? (
                <Text className="text-[15px] font-sans text-ivory-muted">
                  {t('trends.evolution.empty')}
                </Text>
              ) : (
                <View className="gap-2">
                  {evolution.themePoints.map((point) => (
                    <Text
                      key={`${point.dateKey}-${point.theme}`}
                      className="text-[15px] font-sans text-ivory"
                    >
                      {t('trends.evolution.point', {
                        date: point.dateKey,
                        theme: getDreamThemeLabel(point.theme, t) ?? point.theme,
                        count: formatNumber(point.count),
                      })}
                    </Text>
                  ))}
                </View>
              )}
              <Text className="text-[14px] font-sans text-ivory-muted">
                {t(`trends.evolution.next.${evolution.nextAction}`)}
              </Text>
            </View>

            {primaryCta}
          </View>
        </ScreenContainer>
      </ScrollView>
    </View>
  );
}
