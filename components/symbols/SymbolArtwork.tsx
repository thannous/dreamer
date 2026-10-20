import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { getSymbolIllustration } from '@/constants/symbolIllustrations';
import { useSymbolAtlasEntry } from '@/hooks/useSymbolAtlas';
import { atlasContentPosition, atlasPictureSources } from '@/lib/symbolAtlas';

/**
 * A symbol's painting filling a thumbnail or a poster. A symbol from the atlas shows its
 * portrait, the painting its sheet opens on, so the two read as one picture; the others
 * keep their illustration, as does a portrait that cannot load (offline, never fetched).
 */
export function SymbolArtwork({ symbolId, size }: { symbolId: string; size: 'thumb' | 'poster' }) {
  const living = useSymbolAtlasEntry(symbolId);
  // Keyed by symbol, since a recycled list row shows another one next.
  const [failedId, setFailedId] = useState<string>();
  const portrait = useMemo(() => {
    if (!living || failedId === symbolId) return undefined;
    const { atlas, entry } = living;
    return {
      sources: atlasPictureSources(atlas, symbolId, entry.portrait),
      position: atlasContentPosition(entry.portrait.position),
    };
  }, [failedId, living, symbolId]);
  const illustration = portrait ? undefined : getSymbolIllustration(symbolId, size);

  if (portrait) {
    return (
      <Image
        source={portrait.sources}
        contentFit="cover"
        contentPosition={portrait.position}
        style={StyleSheet.absoluteFill}
        onError={() => setFailedId(symbolId)}
      />
    );
  }
  return illustration ? <Image source={illustration} contentFit="cover" style={StyleSheet.absoluteFill} /> : null;
}
