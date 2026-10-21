import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import type { WeekNights } from '@/lib/weekConstellations';

import { TrendsSectionHead } from './TrendsSectionHead';
import { WeekConstellationFigure } from './WeekConstellationFigure';

type Translate = (key: string, params?: Record<string, string | number>) => string;

const TILE_WIDTH = 148;
const FIGURE_HEIGHT = 92;

/**
 * Every week that formed its constellation, the newest first, whatever the period: each one
 * its figure, its name and its dates, opening that week's dreams. Before the first, what
 * makes a week form one.
 */
export function TrendsConstellations({ weeks, goal, ink, dust, t, formatNumber, nameOf, datesOf, onOpenWeek }: {
  weeks: readonly WeekNights[];
  goal: number;
  ink: string;
  dust: string;
  t: Translate;
  formatNumber: (value: number) => string;
  /** The week's symbol or theme, or its first day when it has neither. */
  nameOf: (week: WeekNights) => string;
  datesOf: (week: WeekNights) => string;
  onOpenWeek: (week: WeekNights) => void;
}) {
  const count = weeks.length;
  return (
    <View className="gap-5" testID="trends.section.constellations" accessible={false} accessibilityRole="none">
      <TrendsSectionHead title={t('trends.section.constellations')}
        subtitle={count === 0 ? t('trends.constellations.empty', { goal: formatNumber(goal) })
          : t(count === 1 ? 'trends.constellations.count_one' : 'trends.constellations.count', { count: formatNumber(count) })} />
      {count > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}
          testID="trends.constellations.list">
          {weeks.map((week) => {
            const name = nameOf(week);
            const dates = datesOf(week);
            const nights = t('trends.constellations.nights', { count: formatNumber(week.count) });
            return (
              <PressableScale key={week.start} onPress={() => onOpenWeek(week)} haptic="light" accessibilityRole="button"
                accessibilityLabel={t('trends.constellations.open', { name, dates, nights })}
                testID={`trends.constellations.week.${week.start}`} style={{ width: TILE_WIDTH }} className="gap-2">
                <View className="items-center justify-center overflow-hidden rounded-[18px] border border-line bg-ink-card"
                  style={{ height: FIGURE_HEIGHT }}>
                  <WeekConstellationFigure week={week} width={TILE_WIDTH - 16} height={FIGURE_HEIGHT - 16} ink={ink} dust={dust} />
                </View>
                <Text numberOfLines={2} className="text-body leading-[21px] font-display-semibold text-ivory">{name}</Text>
                <Text numberOfLines={1} className="text-caption font-sans text-ivory-muted">{`${dates} · ${nights}`}</Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}
