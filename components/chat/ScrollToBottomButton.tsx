/**
 * ScrollToBottomButton - Floating button to scroll to the bottom of the chat
 * Appears when user has scrolled up (not near the bottom)
 */

import { Fonts } from '@/constants/theme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useScrollToBottomButton } from '@/hooks/useChatList';
import { isChatDebugEnabled } from '@/lib/env';
import React, { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { IconSymbol } from '@/components/ui/icon-symbol';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ScrollToBottomButton() {
  const { shouldShowButton, scrollToBottom } = useScrollToBottomButton();
  const { colors, mode, shadows } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const debugChat = __DEV__ && isChatDebugEnabled();

  // Keep this view mounted to avoid Android crashes when Reanimated removes views mid-draw.
  const visibility = useSharedValue(shouldShowButton ? 1 : 0);

  useEffect(() => {
    visibility.value = withTiming(shouldShowButton ? 1 : 0, { duration: 180 });
    if (debugChat) {
      console.debug('[ScrollToBottomButton] visibility updated', { shouldShowButton, ts: Date.now() });
    }
  }, [debugChat, shouldShowButton, visibility]);

  const buttonStyle = useAnimatedStyle(() => {
    const scale = interpolate(visibility.value, [0, 1], [0.96, 1]);
    const translateY = interpolate(visibility.value, [0, 1], [8, 0]);

    return {
      opacity: visibility.value,
      transform: [{ translateY }, { scale }],
    };
  });

  const handlePress = useCallback(() => {
    if (debugChat) {
      console.debug('[ScrollToBottomButton] pressed', { ts: Date.now() });
    }
    scrollToBottom();
  }, [debugChat, scrollToBottom]);

  return (
    <AnimatedPressable
      style={[
        styles.button,
        shadows.lg,
        buttonStyle,
        {
          backgroundColor: noctalia.action.primary,
          borderColor: noctalia.action.primaryBorder,
        },
      ]}
      onPress={handlePress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      pointerEvents={shouldShowButton ? 'auto' : 'none'}
      accessibilityElementsHidden={!shouldShowButton}
      importantForAccessibility={shouldShowButton ? 'auto' : 'no-hide-descendants'}
    >
      <View style={styles.content}>
        <IconSymbol name="arrow.down" size={16} color={noctalia.action.primaryText} />
        <Text style={[styles.text, { color: noctalia.action.primaryText }]}>Jump to latest</Text>
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
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
  },
});
