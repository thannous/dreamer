import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
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
  const pointerEventsStyle = Platform.OS === 'web' ? styles.pointerNone : styles.nativePointerNone;

  return (
    <Animated.View
      style={[
        styles.container,
        !compact && styles.defaultPosition,
        animatedStyle,
        { backgroundColor, borderColor },
        compact && styles.compactContainer,
        pointerEventsStyle,
        style,
      ]}
      testID={testID}
    >
      <Text style={[styles.text, compact && styles.compactText, { color: textColor }]}>
        {message}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    borderRadius: ThemeLayout.borderRadius.md,
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingVertical: ThemeLayout.spacing.sm,
    borderWidth: 1,
  },
  defaultPosition: {
    bottom: ThemeLayout.spacing.lg,
    left: ThemeLayout.spacing.lg,
    right: ThemeLayout.spacing.lg,
  },
  text: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
    textAlign: 'center',
  },
  compactContainer: {
    alignSelf: 'flex-start',
    maxWidth: 248,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  compactText: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'left',
  },
  pointerNone: {
    pointerEvents: 'none',
  } as ViewStyle,
  nativePointerNone: {
    pointerEvents: 'none',
  } as ViewStyle,
});

export default Toast;
