import { Image, type ImageProps } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ScopedTheme } from 'uniwind';

import { GrainOverlay } from '@/components/atmosphere/GrainOverlay';
import { ArtworkGlass, Radius, type ThemeMode } from '@/constants/theme';
import type { AccentPair } from '@/lib/types';

type Props = {
  accent: AccentPair;
  source?: ImageProps['source'];
  /** Corner radius: cards use `xl`, the hero uses the wider artwork radius. */
  rounded?: 'md' | 'xl' | 'artwork';
  /** Light copy uses a localized ivory reserve; omitted appearance stays dark. */
  appearance?: ThemeMode;
  className?: string;
  testID?: string;
  children?: React.ReactNode;
};

const RADIUS = { md: Radius.md, xl: Radius.xl, artwork: Radius.artwork } as const;

/**
 * Generated editorial artwork with a typed gradient fallback.
 *
 * Dark copy on an image keeps the existing lower ink scrim. Light copy uses a
 * localized bottom-left ivory reserve from `ArtworkGlass.light`, never a
 * full-screen wash. Thumbnail-only uses keep the unmasked image.
 */
export function SessionArtwork({
  accent,
  source,
  rounded = 'xl',
  appearance,
  className,
  testID,
  children,
}: Props) {
  const isLight = appearance === 'light';
  const lightReserve = ArtworkGlass.light;

  return (
    <View
      testID={testID}
      className={`overflow-hidden ${className ?? ''}`}
      style={{ borderRadius: RADIUS[rounded] }}>
      {source ? (
        <Image
          accessible={false}
          source={source}
          contentFit="cover"
          contentPosition="center"
          style={StyleSheet.absoluteFill}
          testID={testID ? `${testID}.artwork` : undefined}
        />
      ) : (
        <LinearGradient
          colors={[accent[0], accent[1]]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {source && children ? (
        isLight ? (
          <LinearGradient
            colors={lightReserve.artworkScrim}
            locations={lightReserve.artworkScrimLocations}
            start={{ x: 0, y: 1 }}
            end={lightReserve.artworkScrimEnd}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            testID={testID ? `${testID}.artwork-scrim` : undefined}
          />
        ) : (
          <LinearGradient
            colors={['rgba(13, 11, 28, 0.06)', 'rgba(13, 11, 28, 0.82)']}
            locations={[0.25, 1]}
            style={StyleSheet.absoluteFill}
            testID={testID ? `${testID}.artwork-scrim` : undefined}
          />
        )
      ) : null}
      <GrainOverlay opacity={0.05} />
      <ScopedTheme theme={isLight ? 'light' : 'dark'}>{children}</ScopedTheme>
    </View>
  );
}
