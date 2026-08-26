import { Image, type ImageProps } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { ScopedTheme } from 'uniwind';

import { ArtworkGlass, Radius, type ThemeMode } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

type Props = ViewProps & {
  appearance?: ThemeMode;
  artwork?: ImageProps['source'];
  className?: string;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Theme-aware glass for copy and controls placed over world artwork.
 *
 * It is deliberately composited rather than live-blurred: these panels can
 * appear in scrolling lists, where `BlurView` is both costly and unreliable on
 * Android. The full-screen artwork, translucent tint and bright edge provide
 * the material depth without adding a second visual shell.
 */
export function ArtworkGlassPanel({
  appearance,
  artwork,
  className,
  contentStyle,
  children,
  style,
  testID,
  ...rest
}: Props) {
  const { mode } = useTheme();
  const material = ArtworkGlass[appearance ?? mode];

  return (
    <View
      className={className}
      testID={testID}
      style={[
        styles.material,
        {
          backgroundColor: artwork ? material.artworkFill : material.fill,
          borderColor: artwork ? material.artworkBorder : material.border,
        },
        contentStyle,
        style,
      ]}
      {...rest}>
      {artwork ? (
        <>
          <Image
            accessible={false}
            source={artwork}
            contentFit="cover"
            contentPosition="center"
            style={[StyleSheet.absoluteFill, { opacity: material.artworkOpacity }]}
            testID={testID ? `${testID}.artwork` : undefined}
          />
          <LinearGradient
            colors={material.artworkScrim}
            locations={material.artworkScrimLocations}
            start={{ x: 0, y: 1 }}
            end={material.artworkScrimEnd}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            testID={testID ? `${testID}.artwork-scrim` : undefined}
          />
        </>
      ) : null}
      <View
        pointerEvents="none"
        style={[styles.specularEdge, { backgroundColor: material.specular }]}
      />
      {artwork ? <ScopedTheme theme={appearance ?? 'dark'}>{children}</ScopedTheme> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  material: {
    overflow: 'hidden',
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  specularEdge: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: 1,
    borderRadius: Radius.full,
  },
});
