import { LinearGradient } from 'expo-linear-gradient';
import React, { useId, useMemo } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, G, LinearGradient as Gradient, Mask, Path, Rect, Stop } from 'react-native-svg';

import { getNoctaliaPalette } from '@/constants/noctaliaPalette';
import { useTheme } from '@/context/ThemeContext';

/** The block of leaves still to turn; the capture seal lands the journal's own paper's edge where it starts. */
export const JOURNAL_LEAF_BLOCK = 10;
const BLOCK = JOURNAL_LEAF_BLOCK;
/** The edges within the block, outermost first, alternately in shadow and catching the light. */
const EDGES = [
  { inset: 1.2, light: false, opacity: 0.55 },
  { inset: 2.6, light: true, opacity: 0.5 },
  { inset: 4, light: false, opacity: 0.5 },
  { inset: 5.4, light: true, opacity: 0.45 },
  { inset: 6.8, light: false, opacity: 0.42 },
  { inset: 8.2, light: true, opacity: 0.4 },
];
/** The page's own shading where it meets the block, and where it runs into the binding. */
const SHADE = 14;
const BINDING = 20;
/** How far round the screen's corner the edges follow it before they fade, in radians. */
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

/** A point on the screen's right-hand corner arcs, `inset` in from its edge. */
const onCorner = (width: number, corner: number, inset: number, angle: number, y: number) => {
  const radius = corner - inset;
  return `${width - corner + radius * Math.cos(angle)} ${y + radius * Math.sin(angle)}`;
};

/**
 * One line `inset` from the screen's right side: down the side and, where the display is
 * rounded, round its corners on the same centre, so it stays concentric with the glass.
 */
function edgePath(width: number, height: number, inset: number, corner: number): string {
  const x = width - inset;
  const radius = corner - inset;
  if (radius <= 0) return `M${x} 0 L${x} ${height}`;
  return [
    `M${onCorner(width, corner, inset, -CORNER_SWEEP, corner)}`,
    `A${radius} ${radius} 0 0 1 ${x} ${corner}`,
    `L${x} ${height - corner}`,
    `A${radius} ${radius} 0 0 1 ${onCorner(width, corner, inset, CORNER_SWEEP, height - corner)}`,
  ].join(' ');
}

/** The block of leaves: the band between the screen's edge and `BLOCK` in from it, round the corners too. */
function blockPath(width: number, height: number, corner: number): string {
  if (corner <= BLOCK) return `M${width - BLOCK} 0 H${width} V${height} H${width - BLOCK} Z`;
  const outer = corner;
  const inner = corner - BLOCK;
  return [
    `M${onCorner(width, corner, 0, -CORNER_SWEEP, corner)}`,
    `A${outer} ${outer} 0 0 1 ${width} ${corner}`,
    `L${width} ${height - corner}`,
    `A${outer} ${outer} 0 0 1 ${onCorner(width, corner, 0, CORNER_SWEEP, height - corner)}`,
    `L${onCorner(width, corner, BLOCK, CORNER_SWEEP, height - corner)}`,
    `A${inner} ${inner} 0 0 0 ${width - BLOCK} ${height - corner}`,
    `L${width - BLOCK} ${corner}`,
    `A${inner} ${inner} 0 0 0 ${onCorner(width, corner, BLOCK, -CORNER_SWEEP, corner)}`,
    'Z',
  ].join(' ');
}

/**
 * The edges of the journal page a dream is written on, the right-hand page the capture
 * seal dives into, in the very colours of the journal's art so that its edges become the
 * page's own: on the left the paper runs into the binding's crease, on the right lies the
 * block of leaves still to turn, its edges alternately in shadow and catching the light.
 * The block follows the screen's rounded corners and fades as it turns them. Decorative,
 * still, and kept to the margins so the reading keeps its full width.
 */
export function JournalPageEdges() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { mode } = useTheme();
  const leaves = useMemo(() => getNoctaliaPalette(mode).journalLeaves, [mode]);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const corner = displayCornerRadius(insets.top);
  const turned = corner > 0 ? (corner * 0.4) / height : 0;
  // The paths occupy only the right margin. A full-width SVG creates a full-screen
  // bitmap on Android for every mounted preview, even though the rest is transparent.
  const edgeWidth = Math.min(width, Math.ceil(Math.max(corner, BLOCK) + 1));
  const edgeLeft = width - edgeWidth;

  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden className="absolute inset-0">
      <LinearGradient start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} colors={[leaves.binding, `${leaves.binding}00`]}
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: BINDING, opacity: 0.7 }} />
      <LinearGradient start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} colors={[`${leaves.inner}00`, leaves.inner]}
        style={{ position: 'absolute', right: BLOCK, top: corner * 0.5, bottom: corner * 0.5, width: SHADE, opacity: 0.6 }} />
      <Svg width={edgeWidth} height={height} viewBox={`${edgeLeft} 0 ${edgeWidth} ${height}`}
        style={{ position: 'absolute', right: 0, top: 0 }}>
        <Defs>
          <Gradient id={`across${id}`} x1={width - BLOCK} y1="0" x2={width} y2="0" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={leaves.inner} />
            <Stop offset="1" stopColor={leaves.outer} />
          </Gradient>
          {/* The block fades out as it turns the screen's corners. */}
          <Gradient id={`along${id}`} x1="0" y1="0" x2="0" y2={height} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset={turned} stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset={1 - turned} stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </Gradient>
          <Mask id={`fade${id}`} x={edgeLeft} y="0" width={edgeWidth} height={height} maskUnits="userSpaceOnUse">
            <Rect x={edgeLeft} y="0" width={edgeWidth} height={height} fill={`url(#along${id})`} />
          </Mask>
        </Defs>
        <G mask={`url(#fade${id})`}>
          <Path d={blockPath(width, height, corner)} fill={`url(#across${id})`} />
          {EDGES.map((edge) => (
            <Path key={edge.inset} d={edgePath(width, height, edge.inset, corner)} fill="none"
              stroke={edge.light ? leaves.light : leaves.line} strokeOpacity={edge.opacity} strokeWidth={0.8} />
          ))}
        </G>
      </Svg>
    </View>
  );
}
