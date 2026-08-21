import { useCallback } from 'react';
import type { GestureResponderEvent, ViewStyle } from 'react-native';
import {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type AnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { Curve, Duration, PressOpacity, PressScale } from '@/constants/motion';

import { useReducedMotion } from './useReducedMotion';

type Surface = keyof typeof PressScale;

type Options = {
  /** Picks the amplitude pair. A link has no scale twin — scaling a glyph smears it. */
  surface: Surface | 'link';
  /** Multiplied into the animated opacity, e.g. 0.4 for a disabled control. */
  restOpacity?: number;
  /** Null is accepted because RN's own Pressable props are nullable. */
  onPressIn?: ((event: GestureResponderEvent) => void) | null;
  onPressOut?: ((event: GestureResponderEvent) => void) | null;
};

type PressMotion = {
  /**
   * 0 at rest, 1 at full press. Read this instead of `style` when the component
   * must merge press with other animated properties: a second
   * `useAnimatedStyle` would silently REPLACE the first one's `transform`
   * rather than merge with it.
   */
  press: SharedValue<number>;
  /** Ready-made scale + opacity. Ignore it when consuming `press` directly. */
  style: AnimatedStyle<ViewStyle>;
  /** Amplitudes, for a component composing its own style from `press`. */
  scaleTo: number;
  opacityTo: number;
  handlePressIn: (event: GestureResponderEvent) => void;
  handlePressOut: (event: GestureResponderEvent) => void;
};

/**
 * The one press driver for the whole kit.
 *
 * Runs on the UI thread — no React render per touch — and is deliberately
 * asymmetric: the finger has to be answered inside ~150 ms or the surface reads
 * as laggy, but nothing in this app snaps back.
 *
 * `restOpacity` rides inside the same animated style on purpose. An inline
 * animated `opacity` silently beats an `opacity-40` class, so splitting the two
 * would render disabled controls at full strength.
 */
export function usePressMotion({
  surface,
  restOpacity = 1,
  onPressIn,
  onPressOut,
}: Options): PressMotion {
  const reducedMotion = useReducedMotion();
  const press = useSharedValue(0);

  const scaleTo = surface === 'link' ? 1 : PressScale[surface];
  const opacityTo = PressOpacity[surface];

  const style = useAnimatedStyle(() => ({
    transform: [
      { scale: reducedMotion ? 1 : interpolate(press.get(), [0, 1], [1, scaleTo]) },
    ],
    // Tops out at exactly `restOpacity`: an animated opacity above 1 is clamped
    // and the surface would sit pinned at full brightness instead of answering.
    opacity: restOpacity * interpolate(press.get(), [0, 1], [1, opacityTo]),
  }));

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      press.set(withTiming(1, { duration: Duration.instant, easing: Curve.standard }));
      onPressIn?.(event);
    },
    [press, onPressIn]
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      press.set(withTiming(0, { duration: Duration.fast, easing: Curve.standard }));
      onPressOut?.(event);
    },
    [press, onPressOut]
  );

  return { press, style, scaleTo, opacityTo, handlePressIn, handlePressOut };
}
