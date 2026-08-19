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
 * The ranked list shipped for "Top themes": rank chip, label, count, proportional bar.
 *
 * Extracted from app/(tabs)/statistics.tsx so "Émotions dominantes" (S2) REUSES the visual
 * instead of forking it, as the phase 1 contract binds. The per-row progressbar role and its
 * accessibilityValue are the part a copy would have silently dropped; sharing the component
 * makes that structurally impossible.
 *
 * The bar is relative to `maxCount` — the top row is always 100% — NOT a share of the
 * journal. That is what Top themes does today and both callers must read the same way.
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
            <View
              className={`flex-row items-center py-[14px] px-1 gap-4${
                isLast ? '' : ' border-b border-line'
              }`}
            >
              <View className="w-9 h-9 rounded-full items-center justify-center bg-ink-soft">
                <Text className="text-[16px] font-display-bold text-champagne-on">
                  {index + 1}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-sans-medium text-ivory mb-0.5">{row.label}</Text>
                <Text className="text-[12px] font-sans text-ivory-muted mb-1.5">
                  {row.countLabel}
                </Text>
                {/*
                  The track carries a background so the bar reads as a PROPORTION rather than
                  a bare length: without it only the filled part is drawn, and "3 dreams" and
                  "1 dream" look like two unrelated dashes instead of a full bar next to a
                  third of one.
                */}
                <View
                  className="h-1 rounded-[2px] overflow-hidden bg-line"
                  accessibilityRole="progressbar"
                  accessibilityLabel={row.label}
                  accessibilityValue={{
                    min: 0,
                    max: maxCount,
                    now: row.count,
                    text: row.countLabel,
                  }}
                >
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
