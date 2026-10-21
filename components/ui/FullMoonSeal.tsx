import React, { useId, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

/**
 * The silver seal of a dream noted after a full moon's night: a small full moon, lit from
 * the upper left, its seas faint, inside a silver rim. Decorative: whatever carries it
 * names the full moon in words.
 */
export function FullMoonSeal({ size = 20 }: { size?: number }) {
  const { colors, mode } = useTheme();
  const moon = useMemo(() => getNoctaliaDesignTokens(colors, mode).fullMoon, [colors, mode]);
  // Two seals on one web page must not share a gradient's id.
  const light = `full-moon-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const r = size / 2;
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={light} cx="38%" cy="34%" r="70%">
            <Stop offset="0" stopColor={moon.light} />
            <Stop offset="1" stopColor={moon.shade} />
          </RadialGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r - 0.75} fill={`url(#${light})`} />
        <Ellipse cx={r * 0.78} cy={r * 0.8} rx={r * 0.24} ry={r * 0.17} fill={moon.shade} opacity={0.45} />
        <Ellipse cx={r * 1.28} cy={r * 1.12} rx={r * 0.2} ry={r * 0.26} fill={moon.shade} opacity={0.4} />
        <Ellipse cx={r * 0.92} cy={r * 1.42} rx={r * 0.14} ry={r * 0.1} fill={moon.shade} opacity={0.35} />
        <Circle cx={r} cy={r} r={r - 0.75} fill="none" stroke={moon.rim} strokeWidth={1} />
      </Svg>
    </View>
  );
}
