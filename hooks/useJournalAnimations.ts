/**
 * Custom hooks for journal animations using react-native-reanimated
 */

import { OPACITY, SCALE, SLIDE_DISTANCE, SPRING_CONFIGS, TIMING_CONFIGS } from '@/constants/animations';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import {
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/**
 * Hook for scale press animation on touchable elements
 */
export function useScalePress() {
  const scale = useSharedValue(1);
  const isPressed = useSharedValue(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(
      scale.value,
      [SCALE.press, SCALE.default],
      [0.92, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const onPressIn = () => {
    isPressed.value = true;
    scale.value = withSpring(SCALE.press, SPRING_CONFIGS.snappy);
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const onPressOut = () => {
    isPressed.value = false;
    scale.value = withSpring(SCALE.default, SPRING_CONFIGS.bouncy);
  };

  return { animatedStyle, onPressIn, onPressOut };
}

/**
 * Hook for fade in up animation on mount
 */
export function useFadeInUp(delay = 0) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue<number>(SLIDE_DISTANCE.medium);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withTiming(OPACITY.full, TIMING_CONFIGS.smooth)
    );
    translateY.value = withDelay(
      delay,
      withSpring(0, SPRING_CONFIGS.gentle)
    );
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return animatedStyle;
}

/**
 * Hook for modal slide in/out animation
 */
export function useModalSlide(visible: boolean) {
  const translateY = useSharedValue(300);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, SPRING_CONFIGS.smooth);
      opacity.value = withTiming(OPACITY.full, TIMING_CONFIGS.easeOut);
    } else {
      translateY.value = withSpring(300, SPRING_CONFIGS.smooth);
      opacity.value = withTiming(OPACITY.transparent, TIMING_CONFIGS.easeIn);
    }
  }, [visible]);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      opacity.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  return { contentStyle, backdropStyle };
}

/**
 * Hook for staggered list item animation
 */
export function useStaggeredAnimation(index: number, staggerDelay = 50) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue<number>(SLIDE_DISTANCE.large);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    const delay = index * staggerDelay;

    opacity.value = withDelay(
      delay,
      withTiming(OPACITY.full, TIMING_CONFIGS.easeOut)
    );
    translateY.value = withDelay(
      delay,
      withSpring(0, SPRING_CONFIGS.gentle)
    );
    scale.value = withDelay(
      delay,
      withSpring(SCALE.default, SPRING_CONFIGS.smooth)
    );
  }, [index, staggerDelay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return animatedStyle;
}

/**
 * Hook for pulse animation (for "Add Dream" button)
 */
export function usePulseAnimation(idleTimeoutMs = 15000) {
  const scale = useSharedValue(1);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    scale.value = withRepeat(
      withSequence(
        withSpring(1.05, SPRING_CONFIGS.gentle),
        withSpring(1, SPRING_CONFIGS.gentle)
      ),
      -1,
      false
    );

    if (idleTimeoutMs > 0) {
      timeout = setTimeout(() => {
        cancelAnimation(scale);
        scale.value = withTiming(1, TIMING_CONFIGS.easeOut);
      }, idleTimeoutMs);
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      cancelAnimation(scale);
      scale.value = 1;
    };
  }, [idleTimeoutMs, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return animatedStyle;
}

/**
 * Hook for cross-fade transition between content
 */
export function useCrossFade(trigger: any) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Fade out then fade in
    opacity.value = withTiming(OPACITY.transparent, { duration: 150 }, () => {
      opacity.value = withTiming(OPACITY.full, TIMING_CONFIGS.easeIn);
    });
  }, [trigger]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return animatedStyle;
}
