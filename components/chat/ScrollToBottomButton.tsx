/**
 * ScrollToBottomButton - Floating button to scroll to the bottom of the chat
 * Appears when user has scrolled up (not near the bottom)
 */

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useScrollToBottomButton } from '@/hooks/useChatList';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ScrollToBottomButton() {
  const { shouldShowButton, scrollToBottom } = useScrollToBottomButton();
  const { colors, mode, shadows } = useTheme();

  const buttonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: withSpring(1) }],
    };
  }, []);

  if (!shouldShowButton) {
    return null;
  }

  const backgroundColor = mode === 'dark'
    ? 'rgba(99, 102, 241, 0.95)'
    : colors.accent;

  return (
    <AnimatedPressable
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={[
        styles.button,
        shadows.lg,
        buttonStyle,
        { backgroundColor },
      ]}
      onPress={scrollToBottom}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={styles.content}>
        <Ionicons name="arrow-down" size={16} color="#FFFFFF" />
        <Text style={styles.text}>Jump to latest</Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 160,
    alignSelf: 'center',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 100,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: {
    color: '#FFFFFF',
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
  },
});
