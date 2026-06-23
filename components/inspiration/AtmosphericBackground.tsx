import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

type AtmosphericBackgroundVariant = 'immersive' | 'subtle';

interface AtmosphericBackgroundProps {
  variant?: AtmosphericBackgroundVariant;
}

/**
 * AtmosphericBackground component creates a dreamlike background with:
 * - Quiet theme-aware base wash
 * - Thin orbit lines and horizon marks
 * - Soft texture without decorative blobs
 */
export function AtmosphericBackground({ variant = 'immersive' }: AtmosphericBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const { mode, colors } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const isWeb = Platform.OS === 'web';
  const isSubtle = variant === 'subtle';

  const gradientColors: readonly [string, string, ...string[]] = mode === 'dark'
    ? isSubtle
      ? [
          colors.backgroundDark,
          colors.backgroundDark,
          colors.backgroundCard,
          colors.backgroundDark,
        ]
      : [
          noctalia.screen.gradient[0],
          colors.backgroundCard,
          noctalia.screen.gradient[1],
          colors.backgroundSecondary,
          colors.backgroundCard,
          noctalia.screen.gradient[0],
          colors.backgroundDark,
        ]
    : isSubtle
      ? [
          colors.backgroundDark,
          colors.backgroundDark,
          colors.backgroundSecondary,
        ]
      : [
          colors.backgroundDark,
          colors.backgroundDark,
          colors.backgroundSecondary,
          colors.backgroundDark,
          colors.backgroundDark,
        ];

  const gradientLocations: readonly [number, number, ...number[]] = mode === 'dark'
    ? isSubtle
      ? [0, 0.46, 0.76, 1]
      : [0, 0.15, 0.35, 0.5, 0.65, 0.85, 1]
    : isSubtle
      ? [0, 0.72, 1]
      : [0, 0.25, 0.5, 0.75, 1];
  const orbitOpacity = isSubtle ? (mode === 'dark' ? 0.24 : 0.14) : (mode === 'dark' ? 0.64 : 0.42);
  const textureOpacity = isSubtle ? (mode === 'dark' ? 0.12 : 0.05) : (mode === 'dark' ? 0.34 : 0.14);
  const veilOpacity = isSubtle ? (mode === 'dark' ? 0.08 : 0.16) : (mode === 'dark' ? 0.2 : 0.42);
  const horizonOpacity = isSubtle ? (mode === 'dark' ? 0.22 : 0.16) : (mode === 'dark' ? 0.74 : 0.48);

  return (
    <View style={styles.container} pointerEvents="none">
      <LinearGradient
        colors={gradientColors}
        locations={gradientLocations}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.28, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${Math.max(width, 1)} ${Math.max(height, 1)}`}
        style={StyleSheet.absoluteFill}
        preserveAspectRatio="none"
      >
        <Defs>
          <SvgLinearGradient id="noctaliaSurfaceVeil" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={noctalia.atmosphere.veil} stopOpacity={veilOpacity} />
            <Stop offset="1" stopColor={noctalia.atmosphere.glow} stopOpacity={isSubtle ? 0.03 : mode === 'dark' ? 0.05 : 0.08} />
          </SvgLinearGradient>
        </Defs>
        <Ellipse
          cx={width * 0.92}
          cy={height * 0.02}
          rx={Math.min(width * 0.42, 220)}
          ry={Math.min(height * 0.24, 180)}
          fill="url(#noctaliaSurfaceVeil)"
        />
        <Circle
          cx={width * 0.84}
          cy={height * 0.1}
          r={Math.min(width * 0.28, 140)}
          fill="none"
          stroke={noctalia.atmosphere.orbit}
          strokeOpacity={orbitOpacity}
          strokeWidth="0.8"
        />
        {!isSubtle ? (
          <Circle
            cx={width * 0.84}
            cy={height * 0.1}
            r={Math.min(width * 0.42, 210)}
            fill="none"
            stroke={noctalia.atmosphere.orbit}
            strokeDasharray="2 8"
            strokeOpacity={orbitOpacity}
            strokeWidth="0.7"
          />
        ) : null}
        <Path
          d={`M ${-width * 0.06} ${height * 0.76} C ${width * 0.18} ${height * 0.68}, ${width * 0.36} ${height * 0.73}, ${width * 0.54} ${height * 0.8} C ${width * 0.7} ${height * 0.86}, ${width * 0.86} ${height * 0.82}, ${width * 1.06} ${height * 0.76}`}
          fill="none"
          stroke={noctalia.atmosphere.horizon}
          strokeOpacity={horizonOpacity}
          strokeWidth="1"
        />
        {!isSubtle ? (
          <Path
            d={`M ${width * 0.04} ${height * 0.88} C ${width * 0.28} ${height * 0.84}, ${width * 0.5} ${height * 0.9}, ${width * 0.74} ${height * 0.88}`}
            fill="none"
            stroke={noctalia.atmosphere.horizon}
            strokeDasharray="2 7"
            strokeOpacity={mode === 'dark' ? 0.42 : 0.28}
            strokeWidth="0.8"
          />
        ) : null}
      </Svg>

      {/* Bottom fade to navbar background — ensures seamless transition */}
      <LinearGradient
        colors={['transparent', colors.backgroundDark]}
        locations={[0, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.bottomFade}
      />

      {/* Noise Overlay for texture depth */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isWeb ? 'transparent' : `${colors.textPrimary}05`,
            opacity: textureOpacity,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },
});
