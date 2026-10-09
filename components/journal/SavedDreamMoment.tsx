import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

import { EASE } from '@/components/motion/motion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

const ASTRAL_ART = require('@/assets/images/onboarding-astral-background.webp');

const MEDALLION = 148;
const ORBIT = 240;
const CENTER = ORBIT / 2;
const HALO_WIDTH = 340;
const HALO_HEIGHT = 280;

// Fixed points so the sky is identical on every arrival and in screenshots.
const HALO_STARS = [
  { x: 52, y: 64, r: 1.3 },
  { x: 288, y: 48, r: 1.1 },
  { x: 304, y: 176, r: 1.5 },
  { x: 34, y: 196, r: 1 },
  { x: 250, y: 236, r: 0.9 },
  { x: 92, y: 250, r: 1.2 },
] as const;

const sparklePath = (cx: number, cy: number, size: number) =>
  `M${cx} ${cy - size} Q${cx} ${cy} ${cx + size} ${cy} Q${cx} ${cy} ${cx} ${cy + size} ` +
  `Q${cx} ${cy} ${cx - size} ${cy} Q${cx} ${cy} ${cx} ${cy - size} Z`;

type Transform = NonNullable<ViewStyle['transform']>;

/** A one-time entrance. Reduced motion keeps the fade and drops the travel. */
const entrance = (
  travel: { from: Transform; to: Transform } | null,
  durationMs: number,
  delayMs: number,
  reduced: boolean
): CSSStyle => {
  const moves = travel && !reduced;
  return {
    animationName: {
      from: { opacity: 0, ...(moves ? { transform: travel.from } : null) },
      to: { opacity: 1, ...(moves ? { transform: travel.to } : null) },
    },
    animationDuration: durationMs,
    animationDelay: delayMs,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  };
};

/**
 * The moment a captured dream lands in the journal: a window onto the night sky held
 * in an astrolabe, which settles into alignment once. It appears only on the arrival
 * from capture, so the motion budget of a success state is spent at most once per dream.
 * Under reduced motion the layers only fade in.
 */
export function SavedDreamMoment() {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const reduced = useReducedMotion();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const dark = mode === 'dark';
  const accent = noctalia.accent.text;

  const motion = useMemo(() => ({
    halo: entrance(null, 1200, 0, reduced),
    orbit: entrance({ from: [{ rotate: '-24deg' }], to: [{ rotate: '0deg' }] }, 1400, 80, reduced),
    medallion: entrance({ from: [{ scale: 0.94 }], to: [{ scale: 1 }] }, 700, 0, reduced),
    label: entrance({ from: [{ translateY: 8 }], to: [{ translateY: 0 }] }, 400, 320, reduced),
  }), [reduced]);

  return (
    <View testID={TID.Component.SavedDreamMoment} className="mb-6 items-center">
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        pointerEvents="none"
        className="items-center justify-center"
        style={{ width: ORBIT, height: ORBIT }}
      >
        <Animated.View
          className="absolute"
          style={[{ width: HALO_WIDTH, height: HALO_HEIGHT }, motion.halo] as StyleProp<ViewStyle>}
        >
          <Svg width={HALO_WIDTH} height={HALO_HEIGHT}>
            <Defs>
              <RadialGradient id="savedDreamHalo" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0%" stopColor={noctalia.atmosphere.glow} stopOpacity={dark ? 0.24 : 0.16} />
                <Stop offset="55%" stopColor={noctalia.atmosphere.glow} stopOpacity={dark ? 0.07 : 0.05} />
                <Stop offset="100%" stopColor={noctalia.atmosphere.glow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={HALO_WIDTH / 2} cy={HALO_HEIGHT / 2} rx={HALO_WIDTH / 2} ry={HALO_HEIGHT / 2} fill="url(#savedDreamHalo)" />
            {HALO_STARS.map((star) => (
              <Circle key={`${star.x}:${star.y}`} cx={star.x} cy={star.y} r={star.r} fill={noctalia.atmosphere.star} />
            ))}
          </Svg>
        </Animated.View>

        <Animated.View
          className="absolute"
          style={[{ width: ORBIT, height: ORBIT }, motion.orbit] as StyleProp<ViewStyle>}
        >
          <Svg width={ORBIT} height={ORBIT}>
            <Circle cx={CENTER} cy={CENTER} r={94} fill="none" stroke={accent} strokeOpacity={0.34} strokeWidth={0.75} />
            <Circle cx={CENTER} cy={CENTER} r={110} fill="none" stroke={accent} strokeOpacity={0.26}
              strokeWidth={0.75} strokeDasharray="1.5 5" />
            <Circle cx={210} cy={57} r={2.2} fill={accent} />
            <Circle cx={31.6} cy={87.8} r={1.6} fill={accent} fillOpacity={0.8} />
            <Circle cx={29.9} cy={183.1} r={1.4} fill={accent} fillOpacity={0.7} />
            <Circle cx={CENTER} cy={CENTER + 110} r={7} fill="none" stroke={accent} strokeOpacity={0.4} strokeWidth={0.75} />
            <Path d={sparklePath(CENTER, CENTER + 110, 10)} fill={accent} />
          </Svg>
        </Animated.View>

        <Animated.View
          className="overflow-hidden rounded-full bg-ink"
          style={[{ width: MEDALLION, height: MEDALLION }, motion.medallion] as StyleProp<ViewStyle>}
        >
          <Image source={ASTRAL_ART} contentFit="cover" contentPosition="center" style={{ width: '100%', height: '100%' }} />
          <Svg width={MEDALLION} height={MEDALLION} style={{ position: 'absolute', top: 0, left: 0 }}>
            <Circle cx={MEDALLION / 2} cy={MEDALLION / 2} r={MEDALLION / 2 - 0.75} fill="none"
              stroke={accent} strokeOpacity={0.7} strokeWidth={1.5} />
          </Svg>
        </Animated.View>
      </View>

      <Animated.View style={motion.label as StyleProp<ViewStyle>}>
        <Text
          testID={TID.Text.RecordingSaveConfirmation}
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          className="mt-3 text-center font-sans-medium text-[12px] leading-[18px] uppercase tracking-[2px] text-champagne-on"
        >
          {t('recording.save.confirmation')}
        </Text>
      </Animated.View>
    </View>
  );
}
