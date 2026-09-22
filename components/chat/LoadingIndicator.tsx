import React, { useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TID } from '@/lib/testIDs';

/**
 * AnimatedDot - Single pulsing dot with staggered timing
 */
function AnimatedDot({ delay, color, active }: { delay: number; color: string; active: boolean }) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    if (!active) {
      cancelAnimation(opacity);
      opacity.set(0.4);
      return;
    }
    opacity.set(withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 450 }),
          withTiming(0.4, { duration: 450 })
        ),
        -1,
        false
      )
    ));
    return () => cancelAnimation(opacity);
  }, [active, delay, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    return { opacity: opacity.get() };
  });

  return <Animated.View style={[loadingStyles.dot, { backgroundColor: color }, animatedStyle]} />;
}

/**
 * LoadingIndicator - Shows thinking state
 * Exported for use in Composer.Header
 *
 * IMPORTANT: Uses visibility control instead of conditional rendering to prevent
 * Android NullPointerException in ViewGroup.dispatchDraw when animated views
 * are removed mid-animation.
 */
export function LoadingIndicator({ text, visible = true, focused = true }: { text?: string; visible?: boolean; focused?: boolean }) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const reducedMotion = useReducedMotion();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  const animateDots = visible && focused && appActive && !reducedMotion;

  // Keep visibility work on transform/opacity and skip layout animation altogether.
  const animatedVisibilityStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(visible ? 1 : 0, { duration: 150 }),
      transform: [{ translateY: reducedMotion ? 0 : withTiming(visible ? 0 : 8, { duration: 150 }) }],
    };
  }, [visible, reducedMotion]);

  return (
    <Animated.View
      testID={TID.Chat.Loading}
      style={[loadingStyles.wrapper, !visible && loadingStyles.wrapperHidden, animatedVisibilityStyle]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={loadingStyles.container}>
        <View style={[loadingStyles.avatar, { backgroundColor: noctalia.accent.base }]}>
          <IconSymbol name="brain" size={20} color={noctalia.action.primaryText} />
        </View>
        <View style={[loadingStyles.bubble, { backgroundColor: noctalia.surface.active }]}>
          <View style={loadingStyles.dots}>
            <AnimatedDot delay={0} color={noctalia.accent.text} active={animateDots} />
            <AnimatedDot delay={150} color={noctalia.accent.text} active={animateDots} />
            <AnimatedDot delay={300} color={noctalia.accent.text} active={animateDots} />
          </View>
          {text && (
            <Text style={[loadingStyles.text, { color: noctalia.text.secondary }]}>
              {text}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const loadingStyles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  wrapperHidden: {
    display: 'none',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 12,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 13,
    fontFamily: Fonts.lora.regularItalic,
  },
});
