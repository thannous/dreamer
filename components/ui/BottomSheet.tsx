import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';
import Animated, {
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
}: BottomSheetProps) {
  const [isMounted, setIsMounted] = useState(visible);
  const translateY = useSharedValue(0);
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
    if (visible) {
      blurActiveElement();
      setIsMounted(true);
      translateY.value = 400;
      translateY.value = withTiming(0, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
    } else if (isMounted) {
      translateY.value = withTiming(
        400,
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
  }, [handleUnmount, isMounted, translateY, visible]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

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
      <View style={styles.wrapper}>
        <Pressable style={[styles.backdrop, { backgroundColor: backdropColor }]} onPress={onClose} />
        <Animated.View style={[styles.sheet, style, sheetAnimatedStyle]} testID={testID}>
          {normalizedChildren}
        </Animated.View>
      </View>
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
