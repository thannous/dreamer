import React, { useMemo } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

import { twinkle } from './dreamStoryMotion';

const STARS = 5;

/**
 * Act II while the analysis runs: stars take turns lighting up, which says "working"
 * without inventing a percentage the service does not report. The copy carries the
 * state for screen readers and under reduce motion, where the stars hold still.
 */
export function DreamReadingWait() {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const stars = useMemo(() => Array.from({ length: STARS }, (_, index) => twinkle(index, STARS, reduced)), [reduced]);

  return (
    <View testID={TID.Component.DreamReadingWait} className="items-center gap-3 rounded-lg bg-ink-soft px-5 py-6">
      <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
        className="h-6 flex-row items-center gap-5">
        <View className="absolute left-0 right-0 top-[11.5px] h-px bg-champagne opacity-20" />
        {stars.map((style, index) => (
          <Animated.View key={index} className="h-2 w-2 rounded-full bg-champagne"
            style={style as StyleProp<ViewStyle>} />
        ))}
      </View>
      <Text accessibilityLiveRegion="polite" className="text-center font-display-medium text-[18px] leading-6 text-ivory">
        {t('journal.detail.reading.wait.title')}
      </Text>
      <Text className="text-center font-sans text-[14px] leading-5 text-ivory-muted">
        {t('journal.detail.reading.wait.body')}
      </Text>
    </View>
  );
}
