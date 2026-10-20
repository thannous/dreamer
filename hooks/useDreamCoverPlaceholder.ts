import { useEffect, useMemo } from 'react';
import type { ImageSource } from 'expo-image';

import { useDreamMedia } from '@/hooks/useDreamMedia';
import { getDreamImageVersion, getDreamThumbnailCacheKey, getDreamThumbnailUri, withCacheBuster } from '@/lib/imageUtils';
import { isSquareDreamThumbnail } from '@/lib/journalImageReference';
import { thumbnailFailures } from '@/lib/thumbnailFailureCache';
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
  const { loadOriginal } = media;
  const id = dream?.id;
  const imageUpdatedAt = dream?.imageUpdatedAt;
  const analysisRequestId = dream?.analysisRequestId;
  const analyzedAt = dream?.analyzedAt;
  const thumbnailCacheKey = getDreamThumbnailCacheKey(media);
  const thumbnailUri = useMemo(() => (id === undefined ? undefined : getDreamThumbnailUri({
    thumbnailUrl: media.thumbnailUrl,
    imageUrl: media.imageUrl,
    imageUpdatedAt,
    analysisRequestId,
    analyzedAt,
    id,
  })), [analysisRequestId, analyzedAt, id, imageUpdatedAt, media.imageUrl, media.thumbnailUrl]);
  // So does a card whose thumbnail just failed to load.
  const failedThumbnail = !square && Boolean(thumbnailUri)
    && thumbnailFailures.has(media.accessScope ?? null, thumbnailCacheKey ?? thumbnailUri?.trim() ?? '');
  useEffect(() => {
    if (failedThumbnail) loadOriginal();
  }, [failedThumbnail, loadOriginal]);
  const holdsOriginal = square || failedThumbnail;
  const cacheKey = holdsOriginal ? media.imageCacheKey : thumbnailCacheKey;
  return useMemo(() => {
    if (id === undefined) return null;
    if (holdsOriginal) {
      const original = media.imageUrl?.trim();
      const version = getDreamImageVersion({ imageUpdatedAt, analysisRequestId, analyzedAt, id });
      return original ? { uri: withCacheBuster(original, version), cacheKey } : null;
    }
    return thumbnailUri ? { uri: thumbnailUri, cacheKey } : null;
  }, [analysisRequestId, analyzedAt, cacheKey, holdsOriginal, id, imageUpdatedAt, media.imageUrl, thumbnailUri]);
}
