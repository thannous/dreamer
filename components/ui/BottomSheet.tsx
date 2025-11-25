import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';

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
}: BottomSheetProps) {
  const nativeDriver = Platform.OS !== 'web';
  const translateY = useRef(new Animated.Value(0)).current;
  const [isMounted, setIsMounted] = useState(visible);
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
      translateY.setValue(400);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: nativeDriver,
      }).start();
    } else if (isMounted) {
      Animated.timing(translateY, {
        toValue: 400,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: nativeDriver,
      }).start(({ finished }) => {
        if (finished) {
          setIsMounted(false);
        }
      });
    }
  }, [isMounted, nativeDriver, translateY, visible]);

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
        <Animated.View style={[styles.sheet, style, { transform: [{ translateY }] }]}>
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
