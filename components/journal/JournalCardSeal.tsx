import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

import { SEAL_EMBLEMS, SEAL_GOLD } from '@/components/journal/story/sealEmblems';
import { sparklePath } from '@/components/journal/story/sparkle';
import { getNoctaliaPalette } from '@/constants/noctaliaPalette';
import { useTheme } from '@/context/ThemeContext';
import type { DreamTheme, ThemeMode } from '@/lib/types';

const NIGHT_ART = require('@/assets/images/onboarding-astral-background.webp');

/**
 * The sky around the seal: the night by dark, the journal's paper by day, as the dream page
 * lays its seal on its paper. Either falls to the reading veil's own ground, so no seam shows
 * where the dream's text begins. The seal's window stays a night in both.
 */
function skyOf(mode: ThemeMode) {
  const palette = getNoctaliaPalette(mode);
  const dark = mode === 'dark';
  const ground = dark ? palette.background : palette.raised;
  return {
    fall: [dark ? palette.journalLeaves.inner : palette.journalLeaves.light, ground] as const,
    ground,
    ink: dark ? SEAL_GOLD : palette.accent,
    star: dark ? palette.title : palette.accent,
    starOpacity: dark ? 0.8 : 0.4,
    glowOpacity: dark ? 0.2 : 0.12,
  };
}
const SKIES = { dark: skyOf('dark'), light: skyOf('light') } as const;
const FILL = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;
// The seal in the dream page's proportions: its emblem is 92 in a 148 seal, its two orbits
// 94 and 110 from its centre.
const MEDALLION = 120;
const EMBLEM = 74;
const RIM = { inner: 76, outer: 90 } as const;
/** The sky drawn around the seal, centred on it. */
const SKY = { width: 300, height: 260 } as const;
// Fixed points, so the sky is the same on every card and in screenshots.
const STARS = [
  { x: 34, y: 52, r: 1.3 }, { x: 262, y: 38, r: 1.1 }, { x: 280, y: 168, r: 1.5 },
  { x: 22, y: 186, r: 1 }, { x: 236, y: 230, r: 0.9 }, { x: 72, y: 236, r: 1.2 },
] as const;
/** The band of the heart and share icons at the top of the card: the seal stands below it. */
const ACTIONS_BAND = 56;
/** The seal's drawn height, from its outer orbit to the star beneath. */
const SEAL_REACH = 2 * (RIM.outer + 8);
/** Until the dream's text is measured, the share of the card it takes on a phone. */
const READING_SHARE = 0.3;
/** A narrow card, such as a desktop grid's, draws the seal smaller rather than under the text. */
const MIN_SCALE = 0.42;
/** The seal's window, a night in both themes, even before its art decodes. */
const WINDOW_GROUND = getNoctaliaPalette('dark').background;
/**
 * The veil's fade above the dream's text on a seal's card. The sky already falls to the veil's
 * ground, so a short fade softens its edge and leaves the room to the seal.
 */
export const SEAL_FADE_HEIGHT = 48;

/**
 * Where a dream has no painting, its card keeps the painting's frame and shows the dream's
 * seal in it, so every card of the Journal has one size: the theme's emblem in the lamp's
 * gold on the night, as the dream page strikes it, or a star for a dream without a theme
 * yet. Decorative: the card's labels name the theme.
 */
export function JournalCardSeal({ theme, frameHeight, readingHeight, testID }: {
  theme?: DreamTheme;
  frameHeight: number;
  /** The folded text's height at the foot of the card, once measured. */
  readingHeight: number | null;
  testID?: string;
}) {
  const sky = SKIES[useTheme().mode];
  const emblem = theme && Object.hasOwn(SEAL_EMBLEMS, theme) ? SEAL_EMBLEMS[theme] : null;
  const center = { x: SKY.width / 2, y: SKY.height / 2 };
  const medallionCenter = MEDALLION / 2;
  // The room between the icons and the veil's fade: the seal stands in its middle, and never
  // reaches into the icons' band, where a short card would rather let the fade touch it.
  const room = Math.max(0, frameHeight - (readingHeight ?? frameHeight * READING_SHARE) - ACTIONS_BAND - SEAL_FADE_HEIGHT);
  const scale = Math.min(1, Math.max(MIN_SCALE, room / SEAL_REACH));
  const middle = ACTIONS_BAND + Math.max(room / 2, (MEDALLION * scale) / 2 + 4);
  const top = Math.round(middle - SKY.height / 2);
  return (
    <View style={FILL} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <LinearGradient colors={sky.fall} style={FILL} />
      <View className="absolute left-0 right-0 items-center" style={{ top }}>
        <View style={{ width: SKY.width, height: SKY.height, transform: [{ scale }] }} className="items-center justify-center">
          <Svg width={SKY.width} height={SKY.height} style={FILL}>
            <Defs>
              <RadialGradient id="journalCardSealGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0%" stopColor={sky.ink} stopOpacity={sky.glowOpacity} />
                <Stop offset="55%" stopColor={sky.ink} stopOpacity={sky.glowOpacity * 0.3} />
                <Stop offset="100%" stopColor={sky.ink} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={center.x} cy={center.y} rx={SKY.width / 2} ry={SKY.height / 2} fill="url(#journalCardSealGlow)" />
            {STARS.map((star) => <Circle key={`${star.x}:${star.y}`} cx={star.x} cy={star.y} r={star.r} fill={sky.star} fillOpacity={sky.starOpacity} />)}
            <Circle cx={center.x} cy={center.y} r={RIM.inner} fill="none" stroke={sky.ink} strokeOpacity={0.34} strokeWidth={0.75} />
            <Circle cx={center.x} cy={center.y} r={RIM.outer} fill="none" stroke={sky.ink} strokeOpacity={0.26} strokeWidth={0.75} strokeDasharray="1.5 5" />
            <Circle cx={center.x} cy={center.y + RIM.outer} r={6} fill={sky.ground} stroke={sky.ink} strokeOpacity={0.4} strokeWidth={0.75} />
            <Path d={sparklePath(center.x, center.y + RIM.outer, 8)} fill={sky.ink} />
          </Svg>
          <View testID={testID} className="overflow-hidden rounded-full"
            style={{ width: MEDALLION, height: MEDALLION, backgroundColor: WINDOW_GROUND }}>
            <Image source={NIGHT_ART} resizeMode="cover" style={{ width: MEDALLION, height: MEDALLION }} />
            <View className="absolute inset-0 bg-black" style={{ opacity: 0.32 }} />
            {emblem ? (
              <Image source={emblem} tintColor={SEAL_GOLD} resizeMode="contain" style={{
                position: 'absolute', left: (MEDALLION - EMBLEM) / 2, top: (MEDALLION - EMBLEM) / 2, width: EMBLEM, height: EMBLEM,
              }} />
            ) : null}
            <Svg width={MEDALLION} height={MEDALLION} style={FILL}>
              {emblem ? null : <Path d={sparklePath(medallionCenter, medallionCenter, 20)} fill={SEAL_GOLD} />}
              <Circle cx={medallionCenter} cy={medallionCenter} r={medallionCenter - 0.75} fill="none"
                stroke={SEAL_GOLD} strokeOpacity={0.7} strokeWidth={1.5} />
            </Svg>
          </View>
        </View>
      </View>
    </View>
  );
}
