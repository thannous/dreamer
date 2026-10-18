import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View, type TextProps, type TextStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useOnScreen } from '@/components/ui/headerStretch';

import { DREAM_STORY } from './dreamStoryMotion';

/** The reflection's width against the words', and its bright core's against the reflection. */
const REFLECTION = 0.42;
const CORE = 0.45;
/**
 * The lit copy's room on each side. The web reports a whole-pixel width, a fraction short of
 * the letters: in that box the copy would wrap and its centred first line would slide off.
 * Native widths already cover the letters, and the copy breaks its lines as they do.
 */
const SLACK = Platform.OS === 'web' ? 1 : 0;

/**
 * Words that catch the light: a reflection glides across the letters now and then, the
 * way gold lettering catches a lamp as the page moves. The words are drawn once more in
 * the light, seen only through a window crossing them (a soft, wide one around a bright,
 * narrow one); the window moves across while the words inside it move back, both from one
 * value, so the letters stay in place and only the light travels. Nothing runs between
 * passes, nor while another screen is in front. Decorative: screen readers read the words
 * once, and under reduce motion the words keep their still halo.
 */
export function GlintedWords({ children, className, light, glow, testID, accessibilityLiveRegion }: {
  children: string;
  className: string;
  /** The colour of the letters where the light falls. */
  light: string;
  /** The halo the letters keep. */
  glow: string;
  testID?: string;
  accessibilityLiveRegion?: TextProps['accessibilityLiveRegion'];
}) {
  const reduced = useReducedMotion();
  const onScreen = useOnScreen();
  const [width, setWidth] = useState(0);
  const pass = useSharedValue(0);
  const shines = width > 0 && !reduced && onScreen;
  useEffect(() => {
    if (!shines) return undefined;
    const glide = () => {
      pass.value = 0;
      pass.value = withTiming(1, { duration: DREAM_STORY.glintPass, easing: Easing.inOut(Easing.quad) });
    };
    let cycle: ReturnType<typeof setInterval> | undefined;
    const lead = setTimeout(() => {
      glide();
      cycle = setInterval(glide, DREAM_STORY.glintCycle);
    }, DREAM_STORY.glintLead);
    return () => {
      clearTimeout(lead);
      clearInterval(cycle);
      cancelAnimation(pass);
    };
  }, [pass, shines]);
  const halo: TextStyle = { textShadowColor: glow, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 };
  const reflection = Math.max(48, width * REFLECTION);
  // The words underneath keep the halo; the lit copy only recolours their letters.
  const words = <Text className={className} style={{ color: light }}>{children}</Text>;

  return (
    <View className="shrink">
      <Text testID={testID} accessibilityLiveRegion={accessibilityLiveRegion} className={className} style={halo}
        onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}>
        {children}
      </Text>
      {shines ? (
        <View pointerEvents="none" aria-hidden accessible={false} importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden style={StyleSheet.absoluteFill}>
          <Glint pass={pass} width={width} reflection={reflection} band={reflection} opacity={0.4}>{words}</Glint>
          <Glint pass={pass} width={width} reflection={reflection} band={reflection * CORE} opacity={1}>{words}</Glint>
        </View>
      ) : null}
    </View>
  );
}

/** One window `band` wide onto the lit words, centred on the reflection as it crosses them. */
function Glint({ pass, width, reflection, band, opacity, children }: {
  pass: SharedValue<number>;
  width: number;
  reflection: number;
  band: number;
  opacity: number;
  children: React.ReactNode;
}) {
  const from = -reflection / 2 - band / 2;
  const to = width + reflection / 2 - band / 2;
  const windowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: from + (to - from) * pass.value }] }));
  const wordsStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -(from + (to - from) * pass.value) }] }));
  return (
    <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: band, overflow: 'hidden', opacity }, windowStyle]}>
      <Animated.View style={[{ position: 'absolute', top: 0, left: -SLACK, width: width + SLACK * 2 }, wordsStyle]}>{children}</Animated.View>
    </Animated.View>
  );
}
