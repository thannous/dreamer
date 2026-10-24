import React, { memo, useMemo, useState } from 'react';
import { Image, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type CSSStyle } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { SEAL_EMBLEMS } from '@/components/journal/story/sealMarks';
import { sparklePath } from '@/components/journal/story/sparkle';
import { PressableScale } from '@/components/motion';
import { EASE } from '@/components/motion/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getDreamThemeLabel } from '@/lib/dreamLabels';
import type { DreamTrends, DreamTrendsNight } from '@/lib/dreamTrends';
import { isDreamAnalyzed } from '@/lib/dreamUsage';
import type { DreamAnalysis } from '@/lib/types';

import { TrendsSectionHead } from './TrendsSectionHead';

type Translate = (key: string, params?: Record<string, string | number>) => string;
type FormatDate = (value: Date | number, options?: Intl.DateTimeFormatOptions) => string;

const CELL_HEIGHT = 48;
const STAR_ROW = 26;
const BAR_HEIGHT = 96;

const capitalize = (value: string) => (value ? value.charAt(0).toLocaleUpperCase() + value.slice(1) : value);

/**
 * A night of the calendar: its star when a dream was noted, the thread of the current run
 * through it. Drawn again only when one of its own props changes, so a star lighting or a
 * night picked leaves the rest of the month alone.
 */
const NightCell = memo(function NightCell({ night, index, selected, lit, reduced, ink, label, onPick }: {
  night: ThreadedNight;
  index: number;
  selected: boolean;
  lit: boolean;
  reduced: boolean;
  ink: string;
  label: string;
  onPick?: (dateKey: string) => void;
}) {
  const count = night.dreams.length;
  const star = count > 1 ? 10 : 7;
  const waiting = night.dreams.some((dream) => !isDreamAnalyzed(dream));
  const ignite = (lit && !reduced ? {
    animationName: {
      from: { opacity: 0, transform: [{ scale: 0.3 }] },
      to: { opacity: 1, transform: [{ scale: 1 }] },
    },
    animationDuration: 420,
    animationDelay: Math.min(index, 40) * 24,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  } : lit || reduced ? null : { opacity: 0 }) as CSSStyle<ViewStyle> | null;
  // The star and the date are their own elements, so a star lighting redraws neither.
  const art = count > 0 ? (
    <Svg width={24} height={24}>
      <Path d={sparklePath(12, 12, star)} fill={ink} />
      {waiting ? <Circle cx={19.5} cy={4.5} r={2.6} fill="none" stroke={ink} strokeWidth={1} /> : null}
    </Svg>
  ) : null;
  const day = (
    <Text allowFontScaling={false}
      className={`text-[11px] leading-[14px] ${count > 0 ? 'font-sans-medium text-ivory' : 'font-sans text-ivory-muted'}`}
      style={night.inRange ? undefined : { opacity: 0.4 }}>
      {night.dateKey.slice(8).replace(/^0/, '')}
    </Text>
  );
  // The run's thread joins neighbouring nights of the same row, behind their stars.
  const column = index % 7;
  const threadLeft = night.inStreak && column !== 0 && night.threadFromPrevious;
  const threadRight = night.inStreak && column !== 6 && night.threadToNext;
  const content = (
    <>
      <View className="w-full items-center justify-center" style={{ height: STAR_ROW }}>
        {threadLeft ? <View className="absolute left-0 h-px bg-champagne" style={{ right: '50%', top: STAR_ROW / 2 }} /> : null}
        {threadRight ? <View className="absolute right-0 h-px bg-champagne" style={{ left: '50%', top: STAR_ROW / 2 }} /> : null}
        {night.isToday || selected ? (
          <View className="absolute rounded-full" style={{
            width: 30, height: 30, top: (STAR_ROW - 30) / 2,
            borderWidth: 1, borderColor: ink, borderStyle: selected ? 'solid' : 'dashed', opacity: selected ? 0.9 : 0.6,
          }} />
        ) : null}
        {count > 0 ? (
          <Animated.View style={ignite as StyleProp<ViewStyle>}>{art}</Animated.View>
        ) : night.inRange ? (
          <View className="rounded-full bg-ivory-muted" style={{ width: 2.5, height: 2.5, opacity: 0.5 }} />
        ) : null}
      </View>
      {day}
    </>
  );
  return onPick ? (
    <Pressable testID={`trends.nights.night.${night.dateKey}`} onPress={() => onPick(night.dateKey)} accessibilityRole="button"
      accessibilityLabel={label} accessibilityState={{ selected }}
      className="items-center" style={{ width: `${100 / 7}%`, height: CELL_HEIGHT }}>
      {content}
    </Pressable>
  ) : (
    <View testID={`trends.nights.night.${night.dateKey}`} accessible={night.inRange} accessibilityLabel={night.inRange ? label : undefined}
      className="items-center" style={{ width: `${100 / 7}%`, height: CELL_HEIGHT }}>
      {content}
    </View>
  );
});

type ThreadedNight = DreamTrendsNight & { threadFromPrevious: boolean; threadToNext: boolean };

export function TrendsNights({ trends, lit, reduced, ink, onAccent, t, formatDate, formatNumber, locale, onOpenDream, onCapture }: {
  trends: DreamTrends;
  lit: boolean;
  reduced: boolean;
  ink: string;
  /** Icons on a champagne ground. */
  onAccent: string;
  t: Translate;
  formatDate: FormatDate;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  locale: string;
  onOpenDream: (dream: DreamAnalysis) => void;
  onCapture: () => void;
}) {
  const nights = useMemo<ThreadedNight[]>(() => trends.nights.map((night, index, all) => ({
    ...night,
    threadFromPrevious: Boolean(all[index - 1]?.inStreak),
    threadToNext: Boolean(all[index + 1]?.inStreak),
  })), [trends.nights]);
  const latest = useMemo(
    () => [...trends.nights].reverse().find((night) => night.dreams.length > 0)?.dateKey ?? null,
    [trends.nights],
  );
  const [picked, setPicked] = useState<string | null>(null);
  // A night picked in a longer period may not be in this one: the latest night stands in.
  const withDreams = (key: string | null) => nights.find((night) => night.dateKey === key && night.dreams.length > 0);
  const selected = withDreams(picked) ?? withDreams(latest) ?? null;

  const nightDate = (night: DreamTrendsNight) => formatDate(night.dayStart, { weekday: 'short', day: 'numeric', month: 'short' });
  const nightLabel = (night: DreamTrendsNight) => {
    const count = night.dreams.length;
    return t(count === 0 ? 'trends.nights.night_zero' : count === 1 ? 'trends.nights.night_one' : 'trends.nights.night', {
      date: nightDate(night),
      count: formatNumber(count),
    });
  };

  const summary = trends.period === 'all'
    ? t(trends.activeNights === 1 ? 'trends.nights.summary_all_one' : 'trends.nights.summary_all', {
      count: formatNumber(trends.activeNights),
      date: formatDate(trends.range.start, { day: 'numeric', month: 'short', year: 'numeric' }),
    })
    : t(trends.activeNights === 0 ? 'trends.nights.summary_zero' : trends.activeNights === 1 ? 'trends.nights.summary_one' : 'trends.nights.summary', {
      count: formatNumber(trends.activeNights),
      total: formatNumber(trends.range.nights),
    });

  const todayStart = trends.range.end;
  const stats: { key: string; value: string; label: string }[] = [];
  if (trends.averagePerWeek != null) {
    // The plural follows the number on screen: 0.96 reads "1 dream", not "1 dreams".
    const shown = Math.round(trends.averagePerWeek * 10) / 10;
    const singular = typeof Intl.PluralRules === 'function'
      ? new Intl.PluralRules(locale).select(shown) === 'one'
      : locale.startsWith('fr') || locale.startsWith('pt-BR') ? shown < 2 : shown === 1;
    stats.push({
      key: 'perWeek',
      value: formatNumber(shown, { maximumFractionDigits: 1 }),
      label: t(singular ? 'trends.stats.per_week_one' : 'trends.stats.per_week'),
    });
  }
  if (trends.richestWeekday != null) {
    // Any date with that weekday names it in the reader's language.
    const day = new Date(2026, 0, 4 + trends.richestWeekday);
    stats.push({ key: 'richest', value: capitalize(formatDate(day, { weekday: 'long' })), label: t('trends.stats.richest') });
  }
  if (trends.lastActivityAt != null) {
    const lastDay = new Date(trends.lastActivityAt);
    lastDay.setHours(0, 0, 0, 0);
    const daysAgo = Math.round((todayStart - lastDay.getTime()) / 86_400_000);
    stats.push({
      key: 'last',
      value: daysAgo <= 0 ? t('trends.stats.today') : daysAgo === 1 ? t('trends.stats.yesterday')
        : t('trends.stats.days_ago', { count: formatNumber(daysAgo) }),
      label: t('trends.stats.last'),
    });
  }

  const nudge = trends.streak.current > 0 && !trends.streak.dreamedToday
    ? t(trends.streak.current === 1 ? 'trends.nudge.streak_one' : 'trends.nudge.streak', { count: formatNumber(trends.streak.current) })
    : null;

  const maxMonth = Math.max(1, ...trends.months.map((month) => month.count));
  const weekdayHeader = nights.slice(0, 7).map((night) => formatDate(night.dayStart, { weekday: 'narrow' }));

  return (
    <View className="gap-5" testID="trends.section.nights" accessible={false} accessibilityRole="none">
      <TrendsSectionHead title={t('trends.section.nights')} subtitle={summary} />

      {trends.period === 'all' ? (
        <View className="flex-row items-end gap-2" testID="trends.nights.months" style={{ height: BAR_HEIGHT + 40 }}>
          {trends.months.map((month, index) => {
            const [year, monthNumber] = month.key.split('-').map(Number);
            const monthDate = new Date(year, monthNumber - 1, 1);
            const label = formatDate(monthDate, { month: 'short' });
            const grow = (lit && !reduced ? {
              animationName: { from: { transform: [{ scaleY: 0 }] }, to: { transform: [{ scaleY: 1 }] } },
              animationDuration: 600,
              animationDelay: index * 50,
              animationTimingFunction: EASE.out,
              animationFillMode: 'both',
            } : lit || reduced ? null : { transform: [{ scaleY: 0 }] }) as CSSStyle<ViewStyle> | null;
            return (
              <View key={month.key} testID={`trends.nights.month.${month.key}`} accessible
                accessibilityLabel={t(month.count === 0 ? 'trends.nights.month_zero' : month.count === 1 ? 'trends.nights.month_one' : 'trends.nights.month', {
                  month: formatDate(monthDate, { month: 'long', year: 'numeric' }),
                  count: formatNumber(month.count),
                })}
                className="min-w-0 flex-1 items-center gap-1">
                <Text allowFontScaling={false} className="text-[11px] leading-[14px] font-sans-medium text-ivory">
                  {month.count > 0 ? formatNumber(month.count) : ''}
                </Text>
                <View className="w-full items-center justify-end" style={{ height: BAR_HEIGHT }}>
                  <Animated.View className={`w-full max-w-[28px] rounded-t-[6px] ${month.current ? 'bg-champagne' : 'bg-champagne-soft'}`}
                    style={[{ height: Math.max(2, (month.count / maxMonth) * BAR_HEIGHT), transformOrigin: 'bottom' }, grow] as StyleProp<ViewStyle>} />
                </View>
                <Text allowFontScaling={false} numberOfLines={1}
                  className={`text-[11px] leading-[14px] ${month.current ? 'font-sans-medium text-champagne-on' : 'font-sans text-ivory-muted'}`}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <View testID="trends.nights.calendar">
          <View className="flex-row" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {weekdayHeader.map((letter, index) => (
              <Text key={index} allowFontScaling={false} className="text-center text-overline leading-[16px] font-sans-medium uppercase text-ivory-muted"
                style={{ width: `${100 / 7}%` }}>
                {letter}
              </Text>
            ))}
          </View>
          <View className="flex-row flex-wrap">
            {nights.map((night, index) => (
              <NightCell key={night.dateKey} night={night} index={index} selected={night.dateKey === selected?.dateKey}
                // Only a star lights: a night without a dream keeps its props, and stays as drawn.
                lit={lit && night.dreams.length > 0} reduced={reduced} ink={ink} label={nightLabel(night)}
                onPick={night.dreams.length > 0 ? setPicked : undefined} />
            ))}
          </View>
        </View>
      )}

      {selected ? (
        <View className="border-y border-line" testID="trends.nights.selected">
          {selected.dreams.map((dream, index) => {
            const theme = dream.theme ? getDreamThemeLabel(dream.theme, t) : null;
            const waiting = !isDreamAnalyzed(dream);
            const title = dream.title?.trim() || t('trends.nights.untitled');
            return (
              <PressableScale key={dream.id} testID={`trends.nights.dream.${dream.id}`} onPress={() => onOpenDream(dream)}
                accessibilityRole="button" accessibilityLabel={t('trends.nights.open', { title })}
                className={`min-h-[56px] flex-row items-center gap-3 py-3 ${index > 0 ? 'border-t border-line' : ''}`}>
                <View className="h-9 w-9 items-center justify-center rounded-full border border-line">
                  {dream.theme ? (
                    <Image source={SEAL_EMBLEMS[dream.theme]} tintColor={ink} resizeMode="contain" style={{ width: 20, height: 20 }} />
                  ) : (
                    <Svg width={14} height={14}><Path d={sparklePath(7, 7, 6)} fill={ink} /></Svg>
                  )}
                </View>
                <View className="min-w-0 flex-1 gap-[2px]">
                  <Text className="text-caption font-sans text-ivory-muted" numberOfLines={1}>
                    {[capitalize(nightDate(selected)), theme].filter(Boolean).join(' · ')}
                  </Text>
                  <Text className="text-body leading-[22px] font-sans-medium text-ivory" numberOfLines={2}>{title}</Text>
                </View>
                {waiting ? (
                  <View className="rounded-full border border-champagne-soft px-2 py-[2px]">
                    <Text className="text-caption font-sans-medium text-champagne-on">{t('trends.nights.to_analyze')}</Text>
                  </View>
                ) : null}
                <IconSymbol name="chevron.right" size={16} color={ink} />
              </PressableScale>
            );
          })}
        </View>
      ) : null}

      {stats.length > 0 ? (
        <View className="flex-row flex-wrap gap-y-3" testID="trends.nights.stats">
          {stats.map((stat, index) => (
            <View key={stat.key} testID={`trends.nights.stat.${stat.key}`}
              className={`min-w-[96px] flex-1 gap-[2px] ${index > 0 ? 'border-l border-line pl-3' : ''}`}>
              <Text className="text-h3 font-display-semibold text-ivory">{stat.value}</Text>
              <Text className="text-caption font-sans text-ivory-muted">{stat.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {nudge ? (
        <View className="card flex-row items-center gap-3 px-4 py-3" testID="trends.nights.nudge">
          <Text className="min-w-0 flex-1 text-body-sm font-sans text-ivory">{nudge}</Text>
          <PressableScale testID="trends.nights.capture" onPress={onCapture} haptic="light" accessibilityRole="button"
            accessibilityLabel={t('trends.nudge.cta_label')}
            className="min-h-[44px] flex-row items-center gap-1 rounded-full bg-champagne px-4">
            <Text className="text-body-sm font-sans-bold text-on-champagne">{t('trends.nudge.cta')}</Text>
            <IconSymbol name="arrow.right" size={14} color={onAccent} />
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}
