import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

import { PressableScale } from '@/components/motion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

import { entrance, paintSettle, paintSweep, twinkle } from './story/dreamStoryMotion';

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

/** The inner orbit's stars, which take turns while the dream is read and stay lit after. */
const READING_STARS = [-60, 0, 60, 120, 180, 240].map((degrees) => {
  const radians = (degrees * Math.PI) / 180;
  return { x: CENTER + 94 * Math.cos(radians), y: CENTER + 94 * Math.sin(radians) };
});
const READING_STAR = 5;

/** Where the dream is in its story: just saved, being read, or read. */
export type SavedDreamPhase = 'saved' | 'reading' | 'read';

const sparklePath = (cx: number, cy: number, size: number) =>
  `M${cx} ${cy - size} Q${cx} ${cy} ${cx + size} ${cy} Q${cx} ${cy} ${cx} ${cy + size} ` +
  `Q${cx} ${cy} ${cx - size} ${cy} Q${cx} ${cy} ${cx} ${cy - size} Z`;

/**
 * The moment a captured dream lands in the journal: a window onto the night sky held
 * in an astrolabe, which settles into alignment once. It appears only on the arrival
 * from capture, so the motion budget of a success state is spent at most once per dream.
 * While the dream is read (Act II) the inner orbit's stars take turns, and they stay lit
 * once the reading has landed. While its illustration is made (Act III) a band of light
 * crosses the window; once painted, the dream's own image settles into it and the
 * medallion opens the full view. Under reduced motion the layers only fade in and the
 * looping stars and light hold still.
 */
export function SavedDreamMoment({ phase = 'saved', painting = false, artwork = null, onOpenArtwork }: {
  phase?: SavedDreamPhase;
  /** The illustration job is running: the window is being painted. */
  painting?: boolean;
  /** The dream's own illustration, once it has landed. */
  artwork?: ImageSource | null;
  onOpenArtwork?: () => void;
}) {
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
  const readingStars = useMemo(
    () => READING_STARS.map((_, index) => twinkle(index, READING_STARS.length, reduced)),
    [reduced]
  );
  const sweep = useMemo(() => paintSweep(MEDALLION, reduced), [reduced]);
  const settle = useMemo(() => paintSettle(reduced), [reduced]);

  const medallion = (
    <Animated.View
      className="overflow-hidden rounded-full bg-ink"
      style={[{ width: MEDALLION, height: MEDALLION }, motion.medallion] as StyleProp<ViewStyle>}
    >
      <Image source={ASTRAL_ART} contentFit="cover" contentPosition="center" style={{ width: '100%', height: '100%' }} />
      {painting && !artwork ? (
        <Animated.View className="absolute" style={[{
          top: -MEDALLION * 0.25, left: MEDALLION * 0.25, width: MEDALLION * 0.5, height: MEDALLION * 1.5,
        }, sweep] as StyleProp<ViewStyle>}>
          <LinearGradient start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            colors={[`${accent}00`, `${accent}59`, `${accent}00`]} style={{ width: '100%', height: '100%' }} />
        </Animated.View>
      ) : null}
      {artwork ? (
        <Animated.View testID={TID.Component.SavedDreamArtwork} className="absolute inset-0"
          style={settle as StyleProp<ViewStyle>}>
          <Image source={artwork} contentFit="cover" style={{ width: '100%', height: '100%' }} />
        </Animated.View>
      ) : null}
      <Svg width={MEDALLION} height={MEDALLION} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Circle cx={MEDALLION / 2} cy={MEDALLION / 2} r={MEDALLION / 2 - 0.75} fill="none"
          stroke={accent} strokeOpacity={0.7} strokeWidth={1.5} />
      </Svg>
    </Animated.View>
  );

  return (
    <View testID={TID.Component.SavedDreamMoment} className="mb-6 items-center">
      <View className="items-center justify-center" style={{ width: ORBIT, height: ORBIT }}>
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          pointerEvents="none"
          className="absolute inset-0 items-center justify-center"
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
            {phase === 'saved' ? null : READING_STARS.map((star, index) => (
              <Animated.View
                key={index}
                className="absolute rounded-full bg-champagne"
                style={[{
                  left: star.x - READING_STAR / 2,
                  top: star.y - READING_STAR / 2,
                  width: READING_STAR,
                  height: READING_STAR,
                }, phase === 'reading' ? readingStars[index] : null] as StyleProp<ViewStyle>}
              />
            ))}
          </Animated.View>
        </View>

        {artwork && onOpenArtwork ? (
          // Once painted, the window opens: pressing it shows the illustration full size.
          <PressableScale
            testID={TID.Button.SavedDreamArtworkOpen}
            onPress={onOpenArtwork}
            accessibilityRole="button"
            accessibilityLabel={t('journal.detail.image.expand_accessibility')}
            className="rounded-full"
          >
            {medallion}
          </PressableScale>
        ) : (
          <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
            pointerEvents="none">
            {medallion}
          </View>
        )}
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
