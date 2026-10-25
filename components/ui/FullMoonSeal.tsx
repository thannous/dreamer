import React, { useId, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

// The seas as they face us on a full night, drawn on a 100-unit face: the great ocean on the
// left, the Rains above it, Serenity and Tranquillity to the right, Crises on the eastern limb,
// Fertility and the Clouds below.
const SEAS = [
  'M21 31C14 39 12 56 18 68C22 76 30 75 32 65C34 55 37 45 35 37C33 29 27 25 21 31Z',
  'M32 26C36 20 46 20 48 27C50 34 44 40 37 39C31 38 29 31 32 26Z',
  'M54 28C58 24 65 25 66 31C67 37 61 40 56 38C52 36 51 31 54 28Z',
  'M58 40C64 37 72 39 72 46C72 53 65 56 60 53C55 50 53 43 58 40Z',
  'M66 57C70 54 75 57 74 63C73 68 68 68 66 64C64 61 63 59 66 57Z',
  'M40 62C45 58 52 60 52 66C52 71 46 73 42 70C38 67 37 64 40 62Z',
];

/**
 * The silver seal of a dream noted after a full moon's night: a small full moon lit from the
 * upper left, its seas and two bright craters in their true places, its edge dimming toward
 * the limb, inside a silver rim and a faint halo. Decorative: whatever carries it names the
 * full moon in words.
 */
export function FullMoonSeal({ size = 20 }: { size?: number }) {
  const { colors, mode } = useTheme();
  const moon = useMemo(() => getNoctaliaDesignTokens(colors, mode).fullMoon, [colors, mode]);
  // Two seals on one web page must not share a gradient's id.
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const light = `full-moon-light-${id}`;
  const limb = `full-moon-limb-${id}`;
  const halo = `full-moon-halo-${id}`;
  // The rim stays one device pixel thick whatever the seal's size.
  const hairline = 100 / size;
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={halo} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
            <Stop offset="0.84" stopColor={moon.halo} stopOpacity={1} />
            <Stop offset="1" stopColor={moon.halo} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={light} cx="40" cy="36" r="62" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={moon.light} />
            <Stop offset="0.55" stopColor={moon.light} />
            <Stop offset="1" stopColor={moon.shade} />
          </RadialGradient>
          <RadialGradient id={limb} cx="50" cy="50" r="44" gradientUnits="userSpaceOnUse">
            <Stop offset="0.72" stopColor={moon.shade} stopOpacity={0} />
            <Stop offset="1" stopColor={moon.shade} stopOpacity={0.55} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={50} fill={`url(#${halo})`} />
        <Circle cx={50} cy={50} r={44} fill={`url(#${light})`} />
        <G fill={moon.shade} opacity={0.55}>
          {SEAS.map((d) => <Path key={d} d={d} />)}
          <Ellipse cx={80} cy={36} rx={5.5} ry={7} />
        </G>
        {/* Copernicus and Tycho catch the light: a pale spot ringed by its shadow. */}
        <G>
          <Circle cx={36} cy={47} r={3} fill={moon.shade} opacity={0.35} />
          <Circle cx={36} cy={47} r={1.8} fill={moon.light} />
          <Circle cx={46} cy={80} r={4} fill={moon.shade} opacity={0.3} />
          <Circle cx={46} cy={80} r={2.4} fill={moon.light} />
        </G>
        <Circle cx={50} cy={50} r={44} fill={`url(#${limb})`} />
        <Circle cx={50} cy={50} r={44 - hairline / 2} fill="none" stroke={moon.rim} strokeWidth={hairline} />
      </Svg>
    </View>
  );
}
