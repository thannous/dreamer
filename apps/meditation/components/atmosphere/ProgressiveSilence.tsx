import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Curve, Duration, SilenceDelayMs } from '@/constants/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type Props = React.PropsWithChildren<{
  /** Chrome only fades while this is true — e.g. while a session is playing. */
  active?: boolean;
  delayMs?: number;
  className?: string;
}>;

/**
 * Progressive silence — the interaction signature of the app.
 *
 * Where most apps keep every control permanently on screen, here the chrome
 * withdraws: after a few seconds without a touch, labels and controls fade out
 * and only the artwork and the breath remain. A single touch anywhere brings
 * them back. The app grows quieter the deeper you go.
 *
 * Wrap the chrome, not the content. Anything wrapped must be non-essential
 * while hidden: hidden chrome stops receiving touches and leaves the
 * accessibility tree, so the touch that restores it cannot also trigger it.
 */
export function ProgressiveSilence({
  children,
  active = true,
  delayMs = SilenceDelayMs,
  className,
}: Props) {
  const reducedMotion = useReducedMotion();
  const [awake, setAwake] = useState(true);

  // Adjusting state during render when a prop changes — the sanctioned pattern.
  // Resuming a session must always bring the chrome back before it fades again.
  const [previousActive, setPreviousActive] = useState(active);
  if (previousActive !== active) {
    setPreviousActive(active);
    setAwake(true);
  }

  const visible = !active || awake;

  const wake = useCallback(() => setAwake(true), []);

  useEffect(() => {
    if (!active || !awake) return;

    const timer = setTimeout(() => setAwake(false), delayMs);
    return () => clearTimeout(timer);
  }, [active, awake, delayMs]);

  const style = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, {
      duration: reducedMotion ? Duration.fast : Duration.slow,
      easing: Curve.standard,
    }),
  }));

  return (
    <View className={className}>
      {/* Full-bleed catcher, only mounted while the chrome is hidden. */}
      {!visible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Afficher les commandes"
          onPress={wake}
          style={{ position: 'absolute', inset: 0, zIndex: 2 }}
        />
      ) : null}
      <Animated.View
        style={[style, { pointerEvents: visible ? 'auto' : 'none' }]}
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}>
        {children}
      </Animated.View>
    </View>
  );
}
