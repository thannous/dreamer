import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

/** The leaves under this one along the fore-edge, outermost first: where each edge sits and how it catches the light. */
const LEAVES = [
  { right: 0.5, opacity: 0.1 },
  { right: 2.5, opacity: 0.16 },
  { right: 4.5, opacity: 0.22 },
  { right: 6.5, opacity: 0.3 },
];

/**
 * The edges of the journal page a dream is written on, the right-hand page the capture
 * seal dives into: on the left the paper curves into the binding, on the right the leaves
 * beneath it show as a stack of fine edges. Decorative, still, and kept to the margins so
 * the reading keeps its full width.
 */
export function JournalPageEdges() {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const night = mode === 'dark';
  const shadow = noctalia.surface.overlay;
  // The leaves' edges take the page's ink, so they read on night paper and on ivory alike.
  const leaf = noctalia.text.primary;

  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden className="absolute inset-0">
      <LinearGradient start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} colors={[shadow, 'transparent']}
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 22, opacity: night ? 0.55 : 0.26 }} />
      <LinearGradient start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} colors={['transparent', shadow]}
        style={{ position: 'absolute', right: 8, top: 0, bottom: 0, width: 14, opacity: night ? 0.4 : 0.22 }} />
      {LEAVES.map((edge) => (
        <View key={edge.right} style={{
          position: 'absolute', right: edge.right, top: 0, bottom: 0, width: 1,
          backgroundColor: leaf, opacity: edge.opacity,
        }} />
      ))}
    </View>
  );
}
