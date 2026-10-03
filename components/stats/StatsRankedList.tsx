import React, { memo, useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { DURATION, EASING } from '@/components/motion';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';

/**
 * Shared ranked rows for themes, emotions and dream types.
 * Bars compare counts with `maxCount`; they are not percentages of the journal.
 * Counts remain available through each progressbar's accessibilityValue.
 */

export type StatsRankedRow = {
  /** React key; also the identity a test asserts on. Never rendered. */
  id: string;
  /** Already translated. */
  label: string;
  /** Already translated, e.g. "3 dreams". Also used as accessibilityValue.text. */
  countLabel: string;
  /** Raw count. Drives the bar width and accessibilityValue.now. */
  count: number;
};

export type StatsRankedListProps = {
  /**
   * Colours come from `global.css` since the Uniwind port, but the prop stays: it is the
   * call signature both callers share, and dropping it would be an API change, not a port.
   */
  noctalia: NoctaliaDesignTokens;
  /** Already ranked by the caller. Rendered in order, unsliced. */
  rows: StatsRankedRow[];
  /** Bar denominator and accessibilityValue.max. Callers pass Math.max(...counts, 1). */
  maxCount: number;
  testID: string;
};

/**
 * The bar grows from zero ONCE, on the row's first mount — the single moment where the
 * length of the bar is information the reader has not seen yet.
 *
 * `width`, not `scaleX`: the fill is childless and sits inside a fixed-height, clipped
 * track, so nothing else re-lays-out, and the 2px radius survives (a scaled bar smears its
 * own corners). Every later change — the user picked another period — is written straight
 * to the shared value, so a number that merely moved never replays an entrance.
 */
const RankedBarFill = memo(function RankedBarFill({ percent }: { percent: number }) {
  const reduced = useReducedMotion();
  const width = useSharedValue(reduced ? percent : 0);
  const hasGrown = useRef(false);

  useEffect(() => {
    if (hasGrown.current || reduced) {
      width.set(percent);
      return;
    }
    hasGrown.current = true;
    width.set(withTiming(percent, { duration: DURATION.normal, easing: EASING.out }));
  }, [percent, reduced, width]);

  const animatedStyle = useAnimatedStyle(() => ({ width: `${width.get()}%` }));

  // Full opacity. At 0.6 over the dark card the accent washed out to the edge of
  // legibility — verified on device — and these bars carry real data, so they have to
  // survive a bright screen.
  return <Animated.View className="h-1 rounded-[2px] bg-champagne" style={animatedStyle} />;
});

export const StatsRankedList = memo(function StatsRankedList({
  rows,
  maxCount,
  testID,
}: StatsRankedListProps) {
  return (
    <View className="gap-0" testID={testID}>
      {rows.map((row, index) => {
        const isLast = index === rows.length - 1;
        const barWidth = Math.round((row.count / maxCount) * 100);
        return (
          <View key={row.id}>
            <View className={`flex-row items-start py-2 gap-3${isLast ? '' : ' border-b border-line'}`}>
              <Text className="w-7 pt-0.5 text-[17px] leading-[22px] font-display-semibold text-champagne-on">{index + 1}</Text>
              <View className="min-w-0 flex-1 gap-2">
                <View className="flex-row items-start justify-between gap-3">
                  <Text className="min-w-0 flex-1 text-[15px] leading-[22px] font-sans-medium text-ivory">{row.label}</Text>
                  <Text className="max-w-[45%] shrink text-right text-[14px] leading-[22px] font-sans text-ivory-muted">{row.countLabel}</Text>
                </View>
                <View className="h-1 rounded-[2px] overflow-hidden bg-line"
                  accessibilityRole="progressbar" accessibilityLabel={row.label}
                  accessibilityValue={{ min: 0, max: maxCount, now: row.count, text: row.countLabel }}>
                  <RankedBarFill percent={barWidth} />
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
});
