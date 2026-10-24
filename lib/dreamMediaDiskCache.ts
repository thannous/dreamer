import { Image } from 'expo-image';
import { Platform } from 'react-native';

import {
  getDreamMediaCacheKeys, resolveDreamMedia, type DreamMediaInput, type DreamMediaResult,
} from '@/services/dreamMediaService';

async function readDiskCache(cacheKey?: string): Promise<string | null> {
  if (!cacheKey || Platform.OS === 'web') return null;
  const path = await Image.getCachePathAsync(cacheKey).catch(() => null);
  return path ? (path.startsWith('file:') ? path : `file://${path}`) : null;
}

/**
 * Bytes this account already has on disk are shown as they are. Only the variants
 * missing from the device ask the server for a signed URL.
 */
export async function resolveWithDiskCache(
  media: DreamMediaInput,
  userId: string | null,
  cacheOnly: boolean,
  options?: { variant: 'thumbnail' },
): Promise<DreamMediaResult> {
  // List warm-up needs one variant. Do not sign/read the original just because
  // it belongs to the same dream; mounted cards retain their normal fallback.
  if (options?.variant === 'thumbnail' && media.thumbnailUrl?.trim()) {
    media = { ...media, imageUrl: '' };
  }
  const keys = getDreamMediaCacheKeys(media, userId);
  const [image, thumbnail] = await Promise.all([
    media.imageUrl ? readDiskCache(keys.imageCacheKey) : null,
    media.thumbnailUrl ? readDiskCache(keys.thumbnailCacheKey) : null,
  ]);
  const imageMissing = Boolean(media.imageUrl && !image);
  const thumbnailMissing = Boolean(media.thumbnailUrl && !thumbnail);
  const remote: DreamMediaResult = imageMissing || thumbnailMissing
    ? await resolveDreamMedia({
      ...media,
      imageUrl: imageMissing ? media.imageUrl : '',
      thumbnailUrl: thumbnailMissing ? media.thumbnailUrl : '',
    }, userId, { cacheOnly })
    : { imageUrl: '', imageStatus: 'missing', thumbnailStatus: 'missing' };
  return {
    ...remote,
    ...(image ? { imageUrl: image, imageCacheKey: keys.imageCacheKey, imageStatus: 'ready' as const } : {}),
    ...(thumbnail ? { thumbnailUrl: thumbnail, thumbnailCacheKey: keys.thumbnailCacheKey, thumbnailStatus: 'ready' as const } : {}),
  };
}
