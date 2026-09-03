import React, { memo } from 'react';
import { Text, View } from 'react-native';

import { ProgressFill } from '@/components/motion';

export type StatsEvolutionBarDay = {
  dateKey: string;
  dateLabel: string;
  themeLabel: string;
  count: number;
  countLabel: string;
  accessibilityLabel: string;
};

export type StatsEvolutionBarsProps = {
  days: StatsEvolutionBarDay[];
  compact?: boolean;
  testID: string;
};

/**
 * Chronological history as labelled bars. Length encodes volume; date, theme and
 * count stay readable without colour, including at 320 dp.
 */
export const StatsEvolutionBars = memo(function StatsEvolutionBars({
  days,
  compact = false,
  testID,
}: StatsEvolutionBarsProps) {
  const maxCount = Math.max(0, ...days.map((day) => day.count));

  return (
    <View
      accessible={false}
      accessibilityRole="none"
      testID={testID}
      className="gap-3"
    >
      {days.map((day) => {
        const percent = maxCount === 0 ? 0 : Math.round((day.count / maxCount) * 100);
        return (
          <View
            key={day.dateKey}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={day.accessibilityLabel}
            accessibilityValue={{
              min: 0,
              max: Math.max(maxCount, 1),
              now: day.count,
              text: day.countLabel,
            }}
            className="gap-1.5"
            testID={`${testID}.day.${day.dateKey}`}
          >
            {compact ? (
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                className="gap-0.5"
              >
                <Text className="text-[13px] font-sans-medium text-ivory" numberOfLines={1}>
                  {day.dateLabel}
                </Text>
                <Text className="text-[13px] font-sans text-ivory" numberOfLines={1}>
                  {day.themeLabel}
                </Text>
                <Text className="text-[12px] font-sans text-ivory-muted" numberOfLines={1}>
                  {day.countLabel}
                </Text>
              </View>
            ) : (
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                className="flex-row items-baseline justify-between gap-3"
              >
                <Text className="min-w-0 flex-1 text-[14px] font-sans-medium text-ivory" numberOfLines={1}>
                  {day.dateLabel}
                  {' · '}
                  {day.themeLabel}
                </Text>
                <Text className="text-[12px] font-sans text-ivory-muted" numberOfLines={1}>
                  {day.countLabel}
                </Text>
              </View>
            )}
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              className="h-1.5 overflow-hidden rounded-[3px] bg-line"
            >
              <ProgressFill percent={percent} className="h-1.5 rounded-[3px] bg-champagne" />
            </View>
          </View>
        );
      })}
    </View>
  );
});
