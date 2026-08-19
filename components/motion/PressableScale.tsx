import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';

import {
  DURATION,
  EASE,
  HIT_SLOP,
  PRESS_RETENTION_OFFSET,
  PRESS_SCALE,
} from './motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleHaptic = 'none' | 'selection' | 'light' | 'medium';

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  /** How far the surface sinks on press. Default 0.97. */
  scale?: number;
  /**
   * Haptic fired on press-**in**, at the causal moment. `none` by default: a haptic on
   * every tap in the app is how users end up turning haptics off system-wide.
   */
  haptic?: PressableScaleHaptic;
  style?: StyleProp<ViewStyle>;
  className?: string;
  children?: React.ReactNode;
};

const HAPTIC: Record<Exclude<PressableScaleHaptic, 'none'>, () => Promise<void>> = {
  selection: () => Haptics.selectionAsync(),
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
};

/**
 * The standard Noctalia pressable.
 *
 * Mobile has no hover, so press is the only moment the interface can answer a touch.
 * This answers on press-**in** — waiting for the tap to complete is the latency users
 * actually perceive — and commits on press-out, which `Pressable` already does.
 *
 * The scale runs as a Reanimated CSS transition on the UI thread: `pressed` costs one
 * React render per press, and none per frame. Under "reduce motion" the scale is
 * dropped and the surface answers with opacity only, which still reads as feedback.
 */
export const PressableScale = React.forwardRef<React.ComponentRef<typeof Pressable>, PressableScaleProps>(
  function PressableScale(
    {
      scale = PRESS_SCALE,
      haptic = 'none',
      style,
      onPressIn,
      hitSlop = HIT_SLOP,
      pressRetentionOffset = PRESS_RETENTION_OFFSET,
      disabled,
      children,
      ...rest
    },
    ref
  ) {
    const reduced = useReducedMotion();

    const handlePressIn = useCallback<NonNullable<PressableProps['onPressIn']>>(
      (event) => {
        if (haptic !== 'none' && !disabled) {
          // Fire and forget: a rejected haptic (simulator, unsupported hardware) must
          // never surface as an unhandled rejection, and never blocks the visual.
          HAPTIC[haptic]().catch(() => {});
        }
        onPressIn?.(event);
      },
      [disabled, haptic, onPressIn]
    );

    const animatedStyle = useMemo(
      () =>
        ({ pressed }: { pressed: boolean }): (CSSStyle | StyleProp<ViewStyle>)[] => [
          reduced
            ? { opacity: pressed ? 0.7 : 1 }
            : {
                transform: [{ scale: pressed ? scale : 1 }],
                opacity: pressed ? 0.92 : 1,
                transitionProperty: ['transform', 'opacity'],
                transitionDuration: DURATION.press,
                transitionTimingFunction: EASE.out,
              },
          style,
        ],
      [reduced, scale, style]
    );

    return (
      <AnimatedPressable
        ref={ref}
        disabled={disabled}
        hitSlop={hitSlop}
        pressRetentionOffset={pressRetentionOffset}
        onPressIn={handlePressIn}
        style={animatedStyle as PressableProps['style']}
        {...rest}
      >
        {children}
      </AnimatedPressable>
    );
  }
);
