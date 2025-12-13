import { useMessageContext } from '@/context/ChatContext';
import React, { useEffect } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

type FadeInStaggeredProps = {
  children: React.ReactNode;
  delayPerItem?: number;
  initialOffset?: number;
};

/**
 * Fades list items in with a slight upward translate, staggered by index.
 * Used for message bubbles when they first appear.
 */
export function FadeInStaggered({
  children,
  delayPerItem = 35,
  initialOffset = 6,
}: FadeInStaggeredProps) {
  const { index, isNew } = useMessageContext();
  // Using the absolute list index can create multi-second delays in long chats.
  // Cap the delay so new messages animate quickly and scrolling doesn't schedule huge animation queues.
  const delay = isNew ? Math.min(180, index * delayPerItem) : 0;

  const animatedStyle = useAnimatedStyle(() => {
    if (!isNew) {
      return {
        opacity: 1,
        transform: [{ translateY: 0 }],
      };
    }

    return {
      opacity: withDelay(
        delay,
        withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) })
      ),
      transform: [
        {
          translateY: withDelay(
            delay,
            withTiming(0, { duration: 240, easing: Easing.out(Easing.quad) })
          ),
        },
      ],
    };
  }, [delay, isNew]);

  return (
    <Animated.View
      style={[
        isNew ? { opacity: 0, transform: [{ translateY: initialOffset }] } : undefined,
        animatedStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
}

type TextFadeInStaggeredIfStreamingProps = {
  children: React.ReactNode;
  isStreaming: boolean;
  style?: StyleProp<TextStyle>;
};

/**
 * Adds a gentle pulsing fade for streaming text.
 * Falls back to a quick fade-in when not streaming.
 */
export function TextFadeInStaggeredIfStreaming({
  children,
  isStreaming,
  style,
}: TextFadeInStaggeredIfStreamingProps) {
  const { index } = useMessageContext();
  const opacity = useSharedValue(isStreaming ? 0.5 : 1);

  useEffect(() => {
    if (isStreaming) {
      // Simple fade-in instead of pulsing to avoid visual distraction
      opacity.value = withDelay(
        Math.min(200, index * 20),
        withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) })
      );
    } else {
      opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) });
    }
  }, [index, isStreaming, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[style, animatedStyle]}>
      {children}
    </Animated.Text>
  );
}
