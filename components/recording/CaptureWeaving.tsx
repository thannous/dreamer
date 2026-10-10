import React, { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { twinkle } from '@/components/journal/story/dreamStoryMotion';

const STARS = 5;

/**
 * While the answers are woven into one account: the waiting stars of the dream story,
 * taking turns along a thread. A state indication that runs only while the formatter
 * does; the line above carries the state for screen readers and under reduce motion,
 * where the stars hold still.
 */
export function CaptureWeaving() {
  const reduced = useReducedMotion();
  const stars = useMemo(() => Array.from({ length: STARS }, (_, index) => twinkle(index, STARS, reduced)), [reduced]);

  return (
    <View testID="capture-weaving" accessible={false} importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden className="h-6 flex-row items-center gap-5 self-start px-1">
      <View className="absolute left-0 right-0 top-[11.5px] h-px bg-champagne opacity-20" />
      {stars.map((style, index) => (
        <Animated.View key={index} className="h-2 w-2 rounded-full bg-champagne" style={style as StyleProp<ViewStyle>} />
      ))}
    </View>
  );
}
