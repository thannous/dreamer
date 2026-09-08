import { useContext, useEffect, useState } from 'react';
import { useNetworkState } from 'expo-network';
import { AuthContext } from '@/context/AuthContext';
import type { DreamAnalysis } from '@/lib/types';
import { getDirectDreamMediaUrl, resolveDreamMedia, type DreamMediaResult } from '@/services/dreamMediaService';

/** Resolve only mounted media; never replace durable references in journal state. */
export function useDreamMedia(dream?: DreamAnalysis | null) {
  const userId = useContext(AuthContext)?.user?.id ?? null;
  const network = useNetworkState();
  const online = network.isInternetReachable ?? network.isConnected ?? true;
  const imageUrl = dream?.imageUrl ?? '';
  const thumbnailUrl = dream?.thumbnailUrl ?? '';
  const imageUpdatedAt = dream?.imageUpdatedAt;
  const analysisRequestId = dream?.analysisRequestId;
  const analyzedAt = dream?.analyzedAt;
  const [refreshEpoch, setRefreshEpoch] = useState(0);
  const identity = JSON.stringify([userId, imageUrl, thumbnailUrl, imageUpdatedAt, dream?.analysisRequestId, dream?.analyzedAt]);
  const [resolved, setResolved] = useState<{ identity: string; epoch: number; value: DreamMediaResult }>();
  useEffect(() => {
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const run = async () => {
      let value: DreamMediaResult;
      try {
        value = await resolveDreamMedia({ imageUrl, thumbnailUrl, imageUpdatedAt, analysisRequestId, analyzedAt }, userId, { cacheOnly: !online });
      } catch {
        value = { imageUrl: '', imageStatus: 'error', thumbnailStatus: 'error' };
      }
      if (!current) return;
      setResolved(previous => {
        // A mounted guest capability may be valid without an authenticated cache entry.
        if (!online && previous?.identity === identity && previous.epoch === refreshEpoch
          && previous.value.expiresAt !== undefined && previous.value.expiresAt > Date.now()) return previous;
        return { identity, epoch: refreshEpoch, value };
      });
      if (online && (value.imageStatus === 'error' || value.thumbnailStatus === 'error') && attempts < 2) {
        timer = setTimeout(() => { attempts++; void run(); }, attempts === 0 ? 1000 : 3000);
      }
    };
    void run();
    return () => { current = false; if (timer) clearTimeout(timer); };
  }, [identity, imageUrl, thumbnailUrl, imageUpdatedAt, analysisRequestId, analyzedAt, userId, refreshEpoch, online]);
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
    retry: () => setRefreshEpoch(epoch => epoch + 1),
    imageUrl: value?.imageUrl ?? getDirectDreamMediaUrl(imageUrl) ?? '',
    thumbnailUrl: value?.thumbnailUrl ?? getDirectDreamMediaUrl(thumbnailUrl),
    loading: !value && Boolean(imageUrl || thumbnailUrl),
    error: value?.imageStatus === 'error' || value?.thumbnailStatus === 'error',
  };
}
