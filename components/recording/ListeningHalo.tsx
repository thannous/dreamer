import React, { useEffect, useId, useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type CSSStyle,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { EASE } from '@/components/motion/motion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { subscribeVoiceLevel } from '@/lib/voiceLevel';

/** The halo's box where it shows: above the reply in Tell, in the text area's foot in Write. */
const SIZES = {
  regular: { width: 240, height: 88 },
  inline: { width: 176, height: 48 },
} as const;

/** expo-speech-recognition loudness (about -2 silent to 10) to 0..1; speech sits near 2-8. */
const toLevel = (value: number) => Math.min(1, Math.max(0, value / 7));

type Props = {
  label: string;
  size?: keyof typeof SIZES;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Noctalia listening: a soft halo of light behind "I'm listening…" while the microphone is
 * open. It swells and brightens with the dreamer's voice and breathes in the silence, so
 * speaking always gets an answer on screen. Mount it only while listening. The halo never
 * takes a touch and is hidden from assistive technology; the label announces listening.
 */
export function ListeningHalo({ label, size = 'regular', testID, style }: Props) {
  const { colors, mode } = useTheme();
  const tokens = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const reduced = useReducedMotion();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const level = useSharedValue(0);
  const box = SIZES[size];

  useEffect(() => subscribeVoiceLevel((value) => {
    level.set(withSpring(toLevel(value), { duration: 220, dampingRatio: 0.85 }));
  }), [level]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + level.get() * 0.5,
    transform: [{ scaleX: 0.78 + level.get() * 0.36 }, { scaleY: 0.64 + level.get() * 0.56 }],
  }));
  const breathe = useMemo<CSSStyle<ViewStyle>>(() => (reduced ? {} : {
    animationName: { from: { transform: [{ scale: 0.94 }] }, to: { transform: [{ scale: 1.04 }] } },
    animationDuration: 2400,
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
    animationTimingFunction: EASE.inOut,
  }), [reduced]);

  return (
    <Animated.View
      entering={FadeIn.duration(280)}
      exiting={FadeOut.duration(200)}
      style={[styles.field, { width: box.width, height: box.height }, style]}
    >
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[StyleSheet.absoluteFill, haloStyle]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, breathe] as StyleProp<ViewStyle>}>
          <Svg width={box.width} height={box.height}>
            <Defs>
              <RadialGradient id={`halo${id}`} cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0" stopColor={tokens.listeningHalo} stopOpacity={mode === 'dark' ? 0.45 : 0.55} />
                <Stop offset="0.55" stopColor={tokens.listeningHalo} stopOpacity={mode === 'dark' ? 0.18 : 0.22} />
                <Stop offset="1" stopColor={tokens.listeningHalo} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={box.width / 2} cy={box.height / 2} rx={box.width / 2} ry={box.height / 2} fill={`url(#halo${id})`} />
          </Svg>
        </Animated.View>
      </Animated.View>
      <View style={styles.labelRow}>
        <Text
          accessibilityLiveRegion="polite"
          numberOfLines={1}
          style={[styles.label, { color: tokens.text.primary }]}
          testID={testID}
        >
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  field: { alignItems: 'center', justifyContent: 'center' },
  labelRow: { paddingHorizontal: 12 },
  label: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
