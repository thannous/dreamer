import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { blurActiveElement } from '@/lib/accessibility';

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /**
   * Optional style override for the animated sheet container.
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Backdrop color (default: semi-transparent black).
   */
  backdropColor?: string;
  /**
   * Test ID for E2E testing.
   */
  testID?: string;
  /**
   * How users can dismiss the sheet by gesture (default: 'pan').
   */
  dismissBehavior?: 'pan' | 'none';
};

/**
 * On iOS, uses native `pageSheet` presentation.
 * On Android/Web, keeps the custom fade + slide fallback.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  style,
  backdropColor,
  testID,
  dismissBehavior = 'pan',
}: BottomSheetProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const prefersReducedMotion = usePrefersReducedMotion();
  const useNativeIOSSheet = process.env.EXPO_OS === 'ios' && dismissBehavior === 'pan';
  const [isMounted, setIsMounted] = useState(visible);
  const { height: windowHeight } = useWindowDimensions();
  const hiddenTranslateY = Math.max(400, windowHeight);
  const hiddenTranslateYRef = useRef(hiddenTranslateY);
  const prevVisibleRef = useRef(false);
  const previouslyFocusedElementRef = useRef<{ focus?: () => void } | null>(null);
  const translateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const handleUnmount = useCallback(() => setIsMounted(false), []);
  const normalizedChildren = useMemo(
    () =>
      React.Children.toArray(children).map((child, index) => {
        if (typeof child === 'string' || typeof child === 'number') {
          // Wrap stray text nodes so React Native Web doesn't warn about raw text inside a View
          return (
            <Text key={`bs-text-${index}`} accessibilityRole="text">
              {child}
            </Text>
          );
        }
        return child;
      }),
    [children]
  );

  useEffect(() => {
    hiddenTranslateYRef.current = hiddenTranslateY;
  }, [hiddenTranslateY]);

  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;

    if (visible && !wasVisible && typeof document !== 'undefined') {
      previouslyFocusedElementRef.current = document.activeElement as { focus?: () => void } | null;
    }
    if (!visible && wasVisible) {
      const previous = previouslyFocusedElementRef.current;
      previouslyFocusedElementRef.current = null;
      setTimeout(() => previous?.focus?.(), 0);
    }

    if (useNativeIOSSheet) {
      if (visible && !wasVisible) {
        blurActiveElement();
      }
      return;
    }

    if (visible && !wasVisible) {
      blurActiveElement();
      setIsMounted(true);
      if (prefersReducedMotion) {
        backdropOpacity.value = 1;
        translateY.value = 0;
        return;
      }
      backdropOpacity.value = 0;
      translateY.value = hiddenTranslateYRef.current;
      translateY.value = withTiming(0, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
      backdropOpacity.value = withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
    } else if (!visible && wasVisible && isMounted) {
      if (prefersReducedMotion) {
        backdropOpacity.value = 0;
        translateY.value = hiddenTranslateYRef.current;
        setTimeout(handleUnmount, 0);
        return;
      }
      backdropOpacity.value = withTiming(0, {
        duration: 200,
        easing: Easing.in(Easing.cubic),
      });
      translateY.value = withTiming(
        hiddenTranslateYRef.current,
        {
          duration: 220,
          easing: Easing.in(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            runOnJS(handleUnmount)();
          }
        }
      );
    }
  }, [
    backdropOpacity,
    handleUnmount,
    isMounted,
    prefersReducedMotion,
    translateY,
    useNativeIOSSheet,
    visible,
  ]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));
  const resolvedBackdropColor = backdropColor ?? noctalia.surface.overlay;
  const defaultSheetStyle = {
    backgroundColor: noctalia.surface.raised,
    borderColor: noctalia.surface.border,
  };

  const panGesture = useMemo(() => {
    const closeThreshold = Math.min(180, hiddenTranslateY * 0.25);
    const closeVelocity = 1200;

    return Gesture.Pan()
      .enabled(dismissBehavior === 'pan' && !prefersReducedMotion)
      .activeOffsetY([-10, 10])
      .failOffsetY([0, 999999])
      .failOffsetX([-15, 15])
      .onBegin(() => {
        cancelAnimation(translateY);
        cancelAnimation(backdropOpacity);
      })
      .onUpdate((event) => {
        const nextTranslateY = Math.max(0, event.translationY);
        translateY.value = nextTranslateY;
        backdropOpacity.value = Math.max(0, Math.min(1, 1 - nextTranslateY / hiddenTranslateY));
      })
      .onEnd((event) => {
        const shouldClose = translateY.value > closeThreshold || event.velocityY > closeVelocity;
        if (shouldClose) {
          runOnJS(onClose)();
          return;
        }

        translateY.value = withTiming(0, {
          duration: 200,
          easing: Easing.out(Easing.cubic),
        });
        backdropOpacity.value = withTiming(1, {
          duration: 200,
          easing: Easing.out(Easing.cubic),
        });
      });
  }, [backdropOpacity, dismissBehavior, hiddenTranslateY, onClose, prefersReducedMotion, translateY]);

  if (useNativeIOSSheet) {
    if (!visible) {
      return null;
    }

    return (
      <Modal
        animationType={prefersReducedMotion ? 'none' : 'slide'}
        visible={visible}
        onRequestClose={onClose}
        presentationStyle="pageSheet"
      >
        <View style={[styles.nativeSheetWrapper, { backgroundColor: noctalia.screen.background }]}>
          <View
            accessibilityViewIsModal
            aria-modal
            role="dialog"
            style={[styles.nativeSheet, defaultSheetStyle, style]}
            testID={testID}
          >
            {normalizedChildren}
          </View>
        </View>
      </Modal>
    );
  }

  if (!isMounted) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      transparent
      visible={visible || isMounted}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.wrapper}>
        <Animated.View style={[styles.backdrop, { backgroundColor: resolvedBackdropColor }, backdropAnimatedStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <GestureDetector gesture={panGesture}>
          <Animated.View
            accessibilityViewIsModal
            aria-modal
            role="dialog"
            style={[styles.sheet, defaultSheetStyle, style, sheetAnimatedStyle]}
            testID={testID}
          >
            {normalizedChildren}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  nativeSheetWrapper: {
    flex: 1,
  },
  nativeSheet: {
    flex: 1,
    borderTopWidth: 1,
  },
});
