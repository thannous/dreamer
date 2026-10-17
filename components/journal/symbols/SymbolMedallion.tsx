import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { sparklePath } from '@/components/journal/story/sparkle';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { getSymbolIllustration } from '@/constants/symbolIllustrations';
import { useTheme } from '@/context/ThemeContext';
import { useDreamMedia } from '@/hooks/useDreamMedia';
import { getDreamImageVersion, getDreamThumbnailUri, withCacheBuster } from '@/lib/imageUtils';
import type { LinkedSymbol } from '@/lib/symbolLinks';

/**
 * A symbol's face, round as a medallion. A dictionary symbol wears its plate from the
 * dictionary; the dreamer's own symbol wears the painting of the dream it was born in,
 * and, before any painting, the story's star. Decorative: the name always goes with it.
 */
export function SymbolMedallion({ symbol, size }: { symbol: LinkedSymbol; size: number }) {
  const { colors, mode } = useTheme();
  const ink = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const birthplace = symbol.kind === 'personal' ? symbol.appearances[0]?.dream : undefined;
  const media = useDreamMedia(birthplace);
  const [failed, setFailed] = useState<string | null>(null);

  const source = useMemo(() => {
    if (symbol.symbolId) return getSymbolIllustration(symbol.symbolId, size > 64 ? 'poster' : 'thumb');
    if (!birthplace) return undefined;
    const thumbnail = getDreamThumbnailUri({
      thumbnailUrl: media.thumbnailUrl,
      imageUrl: media.imageUrl,
      imageUpdatedAt: birthplace.imageUpdatedAt,
      analysisRequestId: birthplace.analysisRequestId,
      analyzedAt: birthplace.analyzedAt,
      id: birthplace.id,
    })?.trim();
    if (thumbnail) return { uri: thumbnail, cacheKey: media.thumbnailUrl ? media.thumbnailCacheKey : undefined };
    const full = media.imageUrl?.trim();
    return full ? { uri: withCacheBuster(full, getDreamImageVersion(birthplace)), cacheKey: media.imageCacheKey } : undefined;
  }, [birthplace, media.imageCacheKey, media.imageUrl, media.thumbnailCacheKey, media.thumbnailUrl, size, symbol.symbolId]);
  const uri = source && 'uri' in source ? source.uri ?? null : null;
  const shown = source && uri !== failed ? source : undefined;

  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      className="items-center justify-center overflow-hidden border border-champagne-soft bg-ink-raised"
      style={{ width: size, height: size, borderRadius: size / 2 }}>
      {shown ? (
        <Image source={shown} contentFit="cover" transition={240} style={StyleSheet.absoluteFill}
          onError={() => setFailed(uri)} />
      ) : (
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={size * 0.3} fill={ink.accent.text} opacity={0.08} />
          <Path d={sparklePath(size / 2, size / 2, size * 0.2)} fill={ink.accent.text} />
        </Svg>
      )}
    </View>
  );
}
