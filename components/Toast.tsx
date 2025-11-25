import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, type ViewStyle } from 'react-native';

import { ThemeLayout } from '@/constants/journalTheme';
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
  const nativeDriver = Platform.OS !== 'web';
  const { colors, shadows } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: nativeDriver,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        damping: 12,
        mass: 0.6,
        stiffness: 120,
        useNativeDriver: nativeDriver,
      }),
    ]).start();

    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: nativeDriver,
        }),
        Animated.timing(translateY, {
          toValue: 16,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: nativeDriver,
        }),
      ]).start(() => {
        if (onHide) {
          onHide();
        }
      });
    }, durationMs);

    return () => clearTimeout(timeout);
  }, [durationMs, nativeDriver, onHide, opacity, translateY]);

  const backgroundColor =
    mode === 'success'
      ? '#16A34A'
      : mode === 'error'
        ? '#DC2626'
        : colors.backgroundSecondary;
  const textColor = mode === 'success' || mode === 'error' ? '#FFFFFF' : colors.textPrimary;

  const pointerEventsProp = Platform.OS === 'web' ? undefined : 'none';

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity, transform: [{ translateY }] },
        { backgroundColor },
        shadows.md,
        Platform.OS === 'web' ? styles.pointerNone : null,
      ]}
      pointerEvents={pointerEventsProp}
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
    fontFamily: 'SpaceGrotesk_500Medium',
    textAlign: 'center',
  },
  pointerNone: {
    pointerEvents: 'none',
  } as ViewStyle,
});

export default Toast;
