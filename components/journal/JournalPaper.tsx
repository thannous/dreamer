import React, { useCallback, useMemo, useState } from 'react';
import { Image, PixelRatio, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

const PAPER = require('@/assets/images/journal-paper.webp');

/**
 * Android implements Image's `repeat` by allocating a bitmap the size of the whole
 * view. Several journal pages can coexist during a turn. Draw small, shared source
 * tiles instead, keeping the same physical pixel size and top-left origin as repeat.
 */
function AndroidPaper({ tint, opacity }: { tint: string; opacity: number }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = useCallback(({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    setSize(previous => previous.width === layout.width && previous.height === layout.height
      ? previous : { width: layout.width, height: layout.height });
  }, []);
  const tiles = useMemo(() => {
    if (size.width <= 0 || size.height <= 0) return [];
    const source = Image.resolveAssetSource(PAPER);
    if (!source?.width || !source.height) return [];
    const density = PixelRatio.get();
    const sourceWidth = source.width * source.scale;
    const sourceHeight = source.height * source.scale;
    const scale = Math.min(1, Math.round(size.width * density) / sourceWidth,
      Math.round(size.height * density) / sourceHeight);
    const width = sourceWidth * scale / density;
    const height = sourceHeight * scale / density;
    return Array.from({ length: Math.ceil(size.height / height) }, (_, row) =>
      Array.from({ length: Math.ceil(size.width / width) }, (_, column) => ({
        key: `${row}:${column}`,
        style: { position: 'absolute' as const, left: column * width, top: row * height, width, height },
      }))).flat();
  }, [size]);

  return (
    <View onLayout={onLayout} pointerEvents="none" accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { overflow: 'hidden', opacity }]}>
      {tiles.map(tile => (
        <Image key={tile.key} source={PAPER} resizeMode="stretch" resizeMethod="scale"
          fadeDuration={0} tintColor={tint} accessible={false} style={tile.style} />
      ))}
    </View>
  );
}

/**
 * The grain of a dream journal page behind a dream: cloudy mottling, fine grain and fibres
 * from one seamless mask, tinted with the theme's text so it reads as night paper or as
 * ivory paper. It stays still behind the reading, is decorative, and leaves the colours and
 * contrast of the copy as they are.
 */
export function JournalPaper() {
  const { colors, mode } = useTheme();
  const tint = useMemo(() => getNoctaliaDesignTokens(colors, mode).text.primary, [colors, mode]);
  const opacity = mode === 'dark' ? 0.1 : 0.14;
  if (Platform.OS === 'android') return <AndroidPaper tint={tint} opacity={opacity} />;
  return (
    <Image
      source={PAPER}
      resizeMode="repeat"
      tintColor={tint}
      accessible={false}
      importantForAccessibility="no"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', opacity }]}
    />
  );
}
