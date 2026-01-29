import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  StyleSheet,
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
   * Whether users can swipe down to dismiss the sheet (default: true).
   */
  enablePanDownToClose?: boolean;
};

/**
 * Light-weight bottom sheet with fade + slide animation.
 * Designed for simple confirmations without pulling in a heavy dependency.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  style,
  backdropColor = 'rgba(0,0,0,0.45)',
  testID,
  enablePanDownToClose = true,
}: BottomSheetProps) {
  const [isMounted, setIsMounted] = useState(visible);
  const { height: windowHeight } = useWindowDimensions();
  const hiddenTranslateY = Math.max(400, windowHeight);
  const hiddenTranslateYRef = useRef(hiddenTranslateY);
  hiddenTranslateYRef.current = hiddenTranslateY;
  const prevVisibleRef = useRef(false);
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
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;

    if (visible && !wasVisible) {
      blurActiveElement();
      setIsMounted(true);
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
  }, [backdropOpacity, handleUnmount, isMounted, translateY, visible]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const panGesture = useMemo(() => {
    const closeThreshold = Math.min(180, hiddenTranslateY * 0.25);
    const closeVelocity = 1200;

    return Gesture.Pan()
      .enabled(enablePanDownToClose)
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
  }, [backdropOpacity, enablePanDownToClose, hiddenTranslateY, onClose, translateY]);

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
        <Animated.View style={[styles.backdrop, { backgroundColor: backdropColor }, backdropAnimatedStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.sheet, style, sheetAnimatedStyle]} testID={testID}>
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
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    backgroundColor: '#fff',
  },
});
