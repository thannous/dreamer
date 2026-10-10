import React, { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { twinkle } from './dreamStoryMotion';

/**
 * The dream story's "working" signal: stars along a thread take turns lighting up, without
 * a percentage the service does not report. Decorative: the copy next to it carries the
 * state for screen readers and under reduce motion, where the stars hold still.
 */
export function WaitingStars({ count = 5, compact = false, testID }: { count?: number; compact?: boolean; testID?: string }) {
  const reduced = useReducedMotion();
  const stars = useMemo(() => Array.from({ length: count }, (_, index) => twinkle(index, count, reduced)), [count, reduced]);
  const star = compact ? 'h-1.5 w-1.5' : 'h-2 w-2';

  return (
    <View testID={testID} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      className={`flex-row items-center ${compact ? 'h-4 gap-2.5' : 'h-6 gap-5'}`}>
      <View className={`absolute left-0 right-0 h-px bg-champagne opacity-20 ${compact ? 'top-[7.5px]' : 'top-[11.5px]'}`} />
      {stars.map((style, index) => (
        <Animated.View key={index} className={`${star} rounded-full bg-champagne`} style={style as StyleProp<ViewStyle>} />
      ))}
    </View>
  );
}
