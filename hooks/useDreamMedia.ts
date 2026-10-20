import { useCallback, useContext, useEffect, useState } from 'react';
import { useNetworkOnline } from './useNetworkOnline';
import { AuthContext } from '@/context/AuthContext';
import type { DreamAnalysis } from '@/lib/types';
import { resolveWithDiskCache } from '@/lib/dreamMediaDiskCache';
import { getDirectDreamMediaUrl, type DreamMediaResult } from '@/services/dreamMediaService';

/** Resolve only mounted media; never replace durable references in journal state. */
export function useDreamMedia(dream?: DreamAnalysis | null, options?: { variant: 'thumbnail' }) {
  const userId = useContext(AuthContext)?.user?.id ?? null;
  const online = useNetworkOnline();
  const imageUrl = dream?.imageUrl ?? '';
  const thumbnailUrl = dream?.thumbnailUrl ?? '';
  const imageUpdatedAt = dream?.imageUpdatedAt;
  const analysisRequestId = dream?.analysisRequestId;
  const analyzedAt = dream?.analyzedAt;
  const [refreshEpoch, setRefreshEpoch] = useState(0);
  const identity = JSON.stringify([userId, imageUrl, thumbnailUrl, imageUpdatedAt, dream?.analysisRequestId, dream?.analyzedAt]);
  // FlashList recycles cards. An original requested by a previous dream/account
  // must not cause a new card to resolve anything beyond its thumbnail: the request
  // counts only for its own identity, so a recycled card renders once, not twice.
  const [originalRequest, setOriginalRequest] = useState({ identity, requested: false });
  const thumbnailOnly = options?.variant === 'thumbnail'
    && Boolean(thumbnailUrl.trim())
    && !(originalRequest.identity === identity && originalRequest.requested);
  const loadOriginal = useCallback(() => {
    if (thumbnailOnly) setOriginalRequest({ identity, requested: true });
  }, [identity, thumbnailOnly]);
  const [resolved, setResolved] = useState<{ identity: string; epoch: number; originalAttempted: boolean; value: DreamMediaResult }>();
  useEffect(() => {
    // A dream without an illustration has nothing to resolve: the result would equal the
    // unresolved one and only render its card once more.
    if (!imageUrl && !thumbnailUrl) return;
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const run = async () => {
      let value: DreamMediaResult;
      let originalAttempted = !thumbnailOnly;
      try {
        const input = { imageUrl, thumbnailUrl, imageUpdatedAt, analysisRequestId, analyzedAt };
        value = await resolveWithDiskCache(input, userId, !online, thumbnailOnly ? { variant: 'thumbnail' } : undefined);
        // Signing can fail before Image has a source (so no onError can fire).
        // Fall back through the same authorized/cache-aware path as the detail.
        if (thumbnailOnly && value.thumbnailStatus === 'error' && imageUrl) {
          value = await resolveWithDiskCache(input, userId, !online);
          originalAttempted = true;
        }
      } catch {
        value = { imageUrl: '', imageStatus: 'error', thumbnailStatus: 'error' };
      }
      if (!current) return;
      setResolved(previous => {
        // A mounted guest capability may be valid without an authenticated cache entry.
        if (!online && previous?.identity === identity && previous.epoch === refreshEpoch
          && previous.value.expiresAt !== undefined && previous.value.expiresAt > Date.now()) {
          // Keep an unexpired mounted capability only for a variant the offline
          // resolver could not recover. A newly found disk original must win.
          return { identity, epoch: refreshEpoch, originalAttempted, value: {
            ...value,
            ...(value.imageStatus !== 'ready' ? {
              imageUrl: previous.value.imageUrl,
              imageCacheKey: previous.value.imageCacheKey,
              imageStatus: previous.value.imageStatus,
            } : {}),
            ...(value.thumbnailStatus !== 'ready' ? {
              thumbnailUrl: previous.value.thumbnailUrl,
              thumbnailCacheKey: previous.value.thumbnailCacheKey,
              thumbnailStatus: previous.value.thumbnailStatus,
            } : {}),
            expiresAt: Math.min(previous.value.expiresAt, value.expiresAt ?? Infinity),
          } };
        }
        return { identity, epoch: refreshEpoch, originalAttempted, value };
      });
      if (online && (value.imageStatus === 'error' || value.thumbnailStatus === 'error') && attempts < 2) {
        timer = setTimeout(() => { attempts++; void run(); }, attempts === 0 ? 1000 : 3000);
      }
    };
    void run();
    return () => { current = false; if (timer) clearTimeout(timer); };
  }, [identity, imageUrl, thumbnailUrl, imageUpdatedAt, analysisRequestId, analyzedAt, userId, refreshEpoch, online, thumbnailOnly]);
  // Expiry must keep running offline, even when no replacement request can start.
  useEffect(() => {
    if (resolved?.identity !== identity || resolved.epoch !== refreshEpoch || resolved.value.expiresAt === undefined) return;
    const expiresAt = resolved.value.expiresAt;
    let timer: ReturnType<typeof setTimeout>;
    const scheduleExpiry = () => {
      timer = setTimeout(() => {
        if (Date.now() < expiresAt) scheduleExpiry();
        else setRefreshEpoch(epoch => epoch + 1);
      }, Math.min(2_147_483_647, Math.max(1, expiresAt - Date.now() + 1)));
    };
    scheduleExpiry();
    return () => clearTimeout(timer);
  }, [resolved, identity, refreshEpoch]);
  const value = resolved?.identity === identity && resolved.epoch === refreshEpoch
    ? resolved.value : undefined;
  return {
    accessScope: userId,
    imageCacheKey: value?.imageCacheKey,
    thumbnailCacheKey: value?.thumbnailCacheKey,
    retry: () => setRefreshEpoch(epoch => epoch + 1),
    loadOriginal,
    imageUrl: value?.imageUrl ?? (!thumbnailOnly ? getDirectDreamMediaUrl(imageUrl) : undefined) ?? '',
    thumbnailUrl: value?.thumbnailUrl ?? getDirectDreamMediaUrl(thumbnailUrl),
    loading: Boolean(imageUrl || thumbnailUrl) && (!value || (!thumbnailOnly && !resolved?.originalAttempted)),
    error: value?.imageStatus === 'error' || value?.thumbnailStatus === 'error',
  };
}
