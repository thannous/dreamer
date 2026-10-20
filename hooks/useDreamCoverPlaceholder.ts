import { useMemo } from 'react';
import type { ImageSource } from 'expo-image';

import { useDreamMedia } from '@/hooks/useDreamMedia';
import { getDreamImageVersion, getDreamThumbnailCacheKey, getDreamThumbnailUri, withCacheBuster } from '@/lib/imageUtils';
import { isSquareDreamThumbnail } from '@/lib/journalImageReference';
import type { DreamAnalysis } from '@/lib/types';

/**
 * What a dream's plate shows while its original resolves and loads: the painting its journal
 * card already holds, from the same source and cache, so the page opens on the painting and
 * only sharpens. Without one, the plate shows the page's own ground.
 */
export function useDreamCoverPlaceholder(dream?: DreamAnalysis | null): ImageSource | null {
  // An uploaded image's square thumbnail is squeezed: its card holds the original instead.
  const square = isSquareDreamThumbnail(dream?.thumbnailUrl);
  const media = useDreamMedia(dream, square ? undefined : { variant: 'thumbnail' });
  const id = dream?.id;
  const imageUpdatedAt = dream?.imageUpdatedAt;
  const analysisRequestId = dream?.analysisRequestId;
  const analyzedAt = dream?.analyzedAt;
  const cacheKey = square ? media.imageCacheKey : getDreamThumbnailCacheKey(media);
  return useMemo(() => {
    if (id === undefined) return null;
    if (square) {
      const original = media.imageUrl?.trim();
      const version = getDreamImageVersion({ imageUpdatedAt, analysisRequestId, analyzedAt, id });
      return original ? { uri: withCacheBuster(original, version), cacheKey } : null;
    }
    const uri = getDreamThumbnailUri({
      thumbnailUrl: media.thumbnailUrl,
      imageUrl: media.imageUrl,
      imageUpdatedAt,
      analysisRequestId,
      analyzedAt,
      id,
    });
    return uri ? { uri, cacheKey } : null;
  }, [analysisRequestId, analyzedAt, cacheKey, id, imageUpdatedAt, media.imageUrl, media.thumbnailUrl, square]);
}
