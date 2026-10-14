import { LinearGradient } from 'expo-linear-gradient';
import React, { useId, useMemo } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as Fade, Path, Stop } from 'react-native-svg';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

/**
 * The leaves still to turn along the fore-edge, outermost first: where each edge sits and
 * how it catches the light. Thick enough to read as a block of pages one can leaf through.
 */
const LEAVES = [
  { right: 0.5, opacity: 0.12 },
  { right: 1.9, opacity: 0.17 },
  { right: 3.3, opacity: 0.22 },
  { right: 4.7, opacity: 0.27 },
  { right: 6.1, opacity: 0.32 },
  { right: 7.5, opacity: 0.38 },
  { right: 8.9, opacity: 0.46 },
];
/** The block of leaves, and the shadow this page casts on it. */
const BLOCK = 10;
const CAST = 22;
/** How far round the screen's corner the leaves follow it before they fade, in radians. */
const CORNER_SWEEP = (70 * Math.PI) / 180;

/**
 * The screen's corner radius, which the platform does not report: phones with a sensor
 * housing or an island have rounded displays (about 55 points with an island, 44 with a
 * notch), Android phones commonly about 32; a square display, or the web, has none.
 */
function displayCornerRadius(top: number): number {
  if (Platform.OS === 'ios') return top >= 59 ? 55 : top >= 44 ? 44 : 0;
  if (Platform.OS === 'android') return top > 0 ? 32 : 0;
  return 0;
}

/**
 * One leaf's edge, `inset` from the screen's right side: down the side and, where the
 * display is rounded, round its corners on the same centre, so the leaves stay concentric
 * with the glass instead of being cut by it.
 */
function leafPath(width: number, height: number, inset: number, corner: number): string {
  const x = width - inset;
  const radius = corner - inset;
  if (radius <= 0) return `M${x} 0 L${x} ${height}`;
  const centre = width - corner;
  const along = (angle: number, y: number) => `${centre + radius * Math.cos(angle)} ${y + radius * Math.sin(angle)}`;
  return [
    `M${along(-CORNER_SWEEP, corner)}`,
    `A${radius} ${radius} 0 0 1 ${x} ${corner}`,
    `L${x} ${height - corner}`,
    `A${radius} ${radius} 0 0 1 ${along(CORNER_SWEEP, height - corner)}`,
  ].join(' ');
}

/**
 * The edges of the journal page a dream is written on, the right-hand page the capture
 * seal dives into: on the left the paper curves into the binding, on the right the leaves
 * beneath it show as a stack of fine edges, which follow the screen's rounded corners and
 * fade as they turn them. Decorative, still, and kept to the margins so the reading keeps
 * its full width.
 */
export function JournalPageEdges() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const fadeId = `leaves${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const night = mode === 'dark';
  const shadow = noctalia.surface.overlay;
  // The leaves' edges take the page's ink, so they read on night paper and on ivory alike.
  const leaf = noctalia.text.primary;
  const corner = displayCornerRadius(insets.top);
  const turned = corner > 0 ? corner * 0.4 / height : 0;

  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden className="absolute inset-0">
      <LinearGradient start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} colors={[shadow, 'transparent']}
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 22, opacity: night ? 0.55 : 0.26 }} />
      {/* The block of leaves, a shade apart from the page, and the shadow the page casts on it. */}
      <LinearGradient start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} colors={[shadow, 'transparent']}
        style={{ position: 'absolute', right: 0, top: corner * 0.4, bottom: corner * 0.4, width: BLOCK, opacity: night ? 0.35 : 0.16 }} />
      <LinearGradient start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} colors={['transparent', shadow]}
        style={{ position: 'absolute', right: BLOCK, top: corner * 0.5, bottom: corner * 0.5, width: CAST, opacity: night ? 0.5 : 0.3 }} />
      <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Defs>
          {/* The leaves fade out as they turn the screen's corners. */}
          <Fade id={fadeId} x1="0" y1="0" x2="0" y2={height} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={leaf} stopOpacity={0} />
            <Stop offset={turned} stopColor={leaf} stopOpacity={1} />
            <Stop offset={1 - turned} stopColor={leaf} stopOpacity={1} />
            <Stop offset="1" stopColor={leaf} stopOpacity={0} />
          </Fade>
        </Defs>
        {LEAVES.map((edge) => (
          <Path key={edge.right} d={leafPath(width, height, edge.right, corner)} fill="none"
            stroke={`url(#${fadeId})`} strokeOpacity={edge.opacity} strokeWidth={1} />
        ))}
      </Svg>
    </View>
  );
}
