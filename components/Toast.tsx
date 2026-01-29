import React, { useCallback, useEffect } from 'react';
import { Platform, StyleSheet, Text, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

type ToastProps = {
  message: string;
  mode?: 'success' | 'error' | 'info';
  durationMs?: number;
  onHide?: () => void;
  testID?: string;
};

export const Toast: React.FC<ToastProps> = ({
  message,
  mode = 'info',
  durationMs = 2200,
  onHide,
  testID,
}) => {
  const { colors, shadows } = useTheme();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);
  const handleHide = useCallback(() => onHide?.(), [onHide]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.quad),
    });
    translateY.value = withSpring(0, {
      damping: 12,
      mass: 0.6,
      stiffness: 120,
    });

    const timeout = setTimeout(() => {
      opacity.value = withTiming(0, {
        duration: 180,
        easing: Easing.in(Easing.quad),
      });
      translateY.value = withTiming(
        16,
        {
          duration: 180,
          easing: Easing.in(Easing.quad),
        },
        (finished) => {
          if (finished) {
            runOnJS(handleHide)();
          }
        }
      );
    }, durationMs);

    return () => clearTimeout(timeout);
  }, [durationMs, handleHide, opacity, translateY]);

  const backgroundColor =
    mode === 'success'
      ? '#16A34A'
      : mode === 'error'
        ? '#DC2626'
        : colors.backgroundSecondary;
  const textColor = mode === 'success' || mode === 'error' ? '#FFFFFF' : colors.textPrimary;
  const pointerEventsStyle = Platform.OS === 'web' ? styles.pointerNone : styles.nativePointerNone;

  return (
    <Animated.View
      style={[
        styles.container,
        animatedStyle,
        { backgroundColor },
        shadows.md,
        pointerEventsStyle,
      ]}
      testID={testID}
    >
      <Text style={[styles.text, { color: textColor }]}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: ThemeLayout.spacing.lg,
    left: ThemeLayout.spacing.lg,
    right: ThemeLayout.spacing.lg,
    borderRadius: ThemeLayout.borderRadius.md,
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingVertical: ThemeLayout.spacing.sm,
  },
  text: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
    textAlign: 'center',
  },
  pointerNone: {
    pointerEvents: 'none',
  } as ViewStyle,
  nativePointerNone: {
    pointerEvents: 'none',
  } as ViewStyle,
});

export default Toast;
