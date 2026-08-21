import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Curve, Duration } from '@/constants/motion';
import { useTranslation } from '@/context/LanguageContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * The dot geometry lives here rather than in `w-3` / `w-7` / `gap-2` classes:
 * the active pill's width is animated, so the track has to be measured from the
 * same numbers or the two silently drift apart.
 */
const DOT_W = 12;
const ACTIVE_W = 28;
const GAP = 8;

type Props = { current: number; total: number };

/**
 * Position in the flow. Announced once, so screen readers do not read N dots.
 *
 * The champagne pill extends into its slot on mount instead of arriving at full
 * length: every step is its own route, so during the stack's cross-fade the
 * outgoing pill dissolves in one slot while the incoming one grows into the
 * next, and the eye reads a hand-off rather than a jump. It is deliberately a
 * mount animation — `current` never changes on a live instance, since advancing
 * unmounts this component and mounts another one.
 */
export function StepDots({ current, total }: Props) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const width = useSharedValue(DOT_W);

  // A deliberate exception to the transform-and-opacity rule: `width` keeps the
  // 1.5 px caps that a horizontal scale would smear flat, and the layout pass it
  // costs covers four leaf views inside a track of fixed width.
  const activeStyle = useAnimatedStyle(() => ({ width: width.get() }));

  useEffect(() => {
    width.set(
      reducedMotion
        ? ACTIVE_W
        : withTiming(ACTIVE_W, { duration: Duration.slow, easing: Curve.enter })
    );
  }, [reducedMotion, width]);

  // Fixed track, left-packed: the growth pushes the dots still to come and never
  // the ones already passed, and the header around it never reflows.
  const trackWidth = total * DOT_W + (total - 1) * GAP + (ACTIVE_W - DOT_W);

  return (
    <View
      className="flex-row items-center"
      style={{ width: trackWidth, gap: GAP }}
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.step', { current, total })}>
      {Array.from({ length: total }, (_, index) =>
        index === current - 1 ? (
          <Animated.View
            key={index}
            accessibilityElementsHidden
            importantForAccessibility="no"
            className="h-[3px] rounded-full bg-champagne"
            style={activeStyle}
          />
        ) : (
          <View
            key={index}
            accessibilityElementsHidden
            importantForAccessibility="no"
            className="h-[3px] rounded-full bg-hairline"
            style={{ width: DOT_W }}
          />
        )
      )}
    </View>
  );
}
