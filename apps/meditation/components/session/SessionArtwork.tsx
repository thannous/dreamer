import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { GrainOverlay } from '@/components/atmosphere/GrainOverlay';
import { Radius } from '@/constants/theme';
import type { AccentPair } from '@/lib/types';

type Props = {
  accent: AccentPair;
  /** Corner radius: cards use `xl`, the hero uses the wider artwork radius. */
  rounded?: 'md' | 'xl' | 'artwork';
  className?: string;
  children?: React.ReactNode;
};

const RADIUS = { md: Radius.md, xl: Radius.xl, artwork: Radius.artwork } as const;

/**
 * Session artwork. Painted from the category's accent pair rather than shipped
 * as an image: 24 bitmaps is real weight for something the palette can express,
 * and the gradient stays inside the brand by construction.
 *
 * The grain is what stops it reading as a stock gradient — same film as the
 * atmosphere and the glass.
 */
export function SessionArtwork({ accent, rounded = 'xl', className, children }: Props) {
  return (
    <View
      className={`overflow-hidden ${className ?? ''}`}
      style={{ borderRadius: RADIUS[rounded] }}>
      <LinearGradient
        colors={[accent[0], accent[1]]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <GrainOverlay opacity={0.05} />
      {children}
    </View>
  );
}
