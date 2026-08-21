import React, { useCallback, useEffect, useMemo } from 'react';
import { Text, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { DURATION, EASING } from '@/components/motion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

type ToastProps = {
  message: string;
  mode?: 'success' | 'error' | 'info';
  compact?: boolean;
  durationMs?: number;
  onHide?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** How far the toast travels on the way in. */
const TRAVEL = 16;
/** Leaving is quicker than arriving — the user has already read it. */
const EXIT_DURATION = 180;

/**
 * A toast appears occasionally and is not something the user summoned deliberately, so
 * it earns a real animation: without one it would pop into place, which reads as a
 * glitch rather than as a message.
 *
 * Both directions ease **out**. An ease-in exit would linger at the exact moment the
 * user has stopped caring, and Reanimated's built-in curves are too weak to read at
 * this size.
 */
export const Toast: React.FC<ToastProps> = ({
  message,
  mode: toastMode = 'info',
  compact = false,
  durationMs = 2200,
  onHide,
  style,
  testID,
}) => {
  const { colors, mode: themeMode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, themeMode), [colors, themeMode]);
  const reduced = useReducedMotion();

  const opacity = useSharedValue(0);
  // Reduced motion keeps the fade — the message still announces itself — but nothing
  // travels across the screen.
  const translateY = useSharedValue(reduced ? 0 : TRAVEL);
  const handleHide = useCallback(() => onHide?.(), [onHide]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: translateY.get() }],
  }));

  useEffect(() => {
    opacity.set(withTiming(1, { duration: DURATION.fast, easing: EASING.out }));
    if (!reduced) {
      translateY.set(withTiming(0, { duration: DURATION.fast, easing: EASING.out }));
    }

    const timeout = setTimeout(() => {
      if (!reduced) {
        translateY.set(withTiming(TRAVEL, { duration: EXIT_DURATION, easing: EASING.out }));
      }
      // The fade owns the completion callback, so `onHide` fires exactly once whether or
      // not motion is reduced.
      opacity.set(
        withTiming(0, { duration: EXIT_DURATION, easing: EASING.out }, (finished) => {
          'worklet';
          if (finished) {
            scheduleOnRN(handleHide);
          }
        })
      );
    }, durationMs);

    return () => clearTimeout(timeout);
  }, [durationMs, handleHide, opacity, reduced, translateY]);

  const backgroundColor =
    toastMode === 'success'
      ? noctalia.status.success.background
      : toastMode === 'error'
        ? noctalia.status.danger.background
        : noctalia.surface.raised;
  const borderColor =
    toastMode === 'success'
      ? noctalia.status.success.border
      : toastMode === 'error'
        ? noctalia.status.danger.border
        : noctalia.surface.border;
  const textColor =
    toastMode === 'success'
      ? noctalia.status.success.text
      : toastMode === 'error'
        ? noctalia.status.danger.text
        : noctalia.text.primary;

  return (
    <Animated.View
      className={
        compact
          ? 'absolute self-start max-w-[248px] rounded-md border px-3 py-[9px] pointer-events-none'
          : 'absolute bottom-6 left-6 right-6 rounded-md border px-4 py-2 pointer-events-none'
      }
      style={[animatedStyle, { backgroundColor, borderColor }, style]}
      pointerEvents="none"
      testID={testID}
    >
      <Text
        className={
          compact
            ? 'text-left text-[12px] leading-4 font-sans-medium'
            : 'text-center text-body-sm font-sans-medium'
        }
        style={{ color: textColor }}
      >
        {message}
      </Text>
    </Animated.View>
  );
};

export default Toast;
