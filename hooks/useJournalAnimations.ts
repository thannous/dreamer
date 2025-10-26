/**
 * Custom hooks for journal animations using react-native-reanimated
 */

import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { SPRING_CONFIGS, TIMING_CONFIGS, SCALE, OPACITY, SLIDE_DISTANCE } from '@/constants/animations';

/**
 * Hook for scale press animation on touchable elements
 */
export function useScalePress() {
  const scale = useSharedValue(1);
  const isPressed = useSharedValue(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    'worklet';
    isPressed.value = true;
    scale.value = withSpring(SCALE.press, SPRING_CONFIGS.snappy);
  };

  const onPressOut = () => {
    'worklet';
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
  const translateY = useSharedValue(SLIDE_DISTANCE.medium);

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
      [0, 0.7],
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
  const translateY = useSharedValue(SLIDE_DISTANCE.large);
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
export function usePulseAnimation() {
  const scale = useSharedValue(1);

  useEffect(() => {
    // Create a repeating pulse effect
    const pulse = () => {
      scale.value = withSpring(1.05, SPRING_CONFIGS.gentle, () => {
        scale.value = withSpring(1, SPRING_CONFIGS.gentle);
      });
    };

    // Pulse every 3 seconds
    const interval = setInterval(pulse, 3000);
    return () => clearInterval(interval);
  }, []);

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
