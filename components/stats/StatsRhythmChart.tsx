import React, { memo, useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { DURATION, EASING } from '@/components/motion';

export type StatsRhythmChartDay = {
  weekday: number;
  count: number;
  /** Already translated weekday name. */
  label: string;
  /** Already translated count, e.g. "2 dreams". */
  countLabel: string;
};

export type StatsRhythmChartProps = {
  days: StatsRhythmChartDay[];
  accessibilityLabel: string;
  testID: string;
  compact?: boolean;
};

const TRACK_HEIGHT = {
  regular: 72,
  compact: 56,
} as const;

const VerticalFill = memo(function VerticalFill({ percent }: { percent: number }) {
  const reduced = useReducedMotion();
  const height = useSharedValue(reduced ? percent : 0);
  const hasGrown = useRef(false);

  useEffect(() => {
    if (hasGrown.current || reduced) {
      height.set(percent);
      return;
    }
    hasGrown.current = true;
    height.set(withTiming(percent, { duration: DURATION.normal, easing: EASING.out }));
  }, [height, percent, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({ height: `${height.get()}%` }));

  return <Animated.View className="w-full rounded-[3px] bg-champagne" style={animatedStyle} />;
});

/**
 * Weekly rhythm as labelled columns. Height encodes the count; the number under
 * each bar is the text alternative, so colour is never the only signal.
 */
export const StatsRhythmChart = memo(function StatsRhythmChart({
  days,
  accessibilityLabel,
  testID,
  compact = false,
}: StatsRhythmChartProps) {
  const maxCount = Math.max(0, ...days.map((day) => day.count));
  const trackHeight = compact ? TRACK_HEIGHT.compact : TRACK_HEIGHT.regular;

  return (
    <View
      accessible={false}
      accessibilityRole="none"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      className="flex-row items-end gap-1"
    >
      {days.map((day) => {
        const percent = maxCount === 0 ? 0 : Math.round((day.count / maxCount) * 100);
        return (
          <View
            key={day.weekday}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={day.label}
            accessibilityValue={{
              min: 0,
              max: Math.max(maxCount, 1),
              now: day.count,
              text: day.countLabel,
            }}
            className="min-w-0 flex-1 items-center gap-1"
            testID={`${testID}.day.${day.weekday}`}
          >
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              className="w-full justify-end overflow-hidden rounded-[6px] bg-line"
              style={{ height: trackHeight }}
            >
              <VerticalFill percent={percent} />
            </View>
            <Text
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              className={`w-full text-center font-sans-medium text-ivory-muted ${
                compact ? 'text-[10px]' : 'text-[11px]'
              }`}
              numberOfLines={1}
            >
              {day.label}
            </Text>
            <Text
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              className={`w-full text-center font-display-semibold text-ivory ${
                compact ? 'text-[12px]' : 'text-[14px]'
              }`}
              numberOfLines={1}
            >
              {String(day.count)}
            </Text>
          </View>
        );
      })}
    </View>
  );
});
