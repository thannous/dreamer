import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type CSSStyle } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion';
import { EASE } from '@/components/motion/motion';
import { DREAM_TRENDS_PERIODS, type DreamTrendsPeriod } from '@/lib/dreamTrends';

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** The one choice of period for the whole page; the thumb slides to it. */
export function TrendsPeriodSwitch({ period, onChange, reduced, t }: {
  period: DreamTrendsPeriod;
  onChange: (period: DreamTrendsPeriod) => void;
  reduced: boolean;
  t: Translate;
}) {
  const index = DREAM_TRENDS_PERIODS.indexOf(period);
  // A third of the row, moved by whole thirds: no measuring, so it is right from the first frame.
  const thumb = {
    width: `${100 / DREAM_TRENDS_PERIODS.length}%`,
    transform: [{ translateX: `${index * 100}%` }],
    transitionProperty: 'transform',
    transitionDuration: reduced ? 0 : 320,
    transitionTimingFunction: EASE.inOut,
  } as CSSStyle<ViewStyle>;

  return (
    <View className="rounded-full border border-line p-1" testID="trends.period">
      <View className="flex-row" accessibilityRole="tablist" accessibilityLabel={t('trends.period.label')}>
        <Animated.View pointerEvents="none" className="absolute bottom-0 left-0 top-0 rounded-full bg-champagne"
          style={thumb as StyleProp<ViewStyle>} />
        {DREAM_TRENDS_PERIODS.map((option) => {
          const selected = option === period;
          return (
            <PressableScale key={option} testID={`trends.period.${option}`} onPress={() => onChange(option)}
              haptic={selected ? 'none' : 'selection'} accessibilityRole="tab" aria-selected={selected}
              className="min-h-[38px] flex-1 items-center justify-center rounded-full px-2">
              <Text numberOfLines={1}
                className={`text-body-sm leading-[19px] ${selected ? 'font-sans-bold text-on-champagne' : 'font-sans-medium text-ivory-muted'}`}>
                {t(`trends.period.${option}`)}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}
