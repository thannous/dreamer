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
    if (!online) return;
    let current = true;
    resolveDreamMedia({ imageUrl, thumbnailUrl, imageUpdatedAt, analysisRequestId, analyzedAt }, userId).then(value => {
      if (!current) return;
      setResolved({ identity, epoch: refreshEpoch, value });
    }).catch(() => {
      if (current) setResolved({ identity, epoch: refreshEpoch, value: {
        imageUrl: '', imageStatus: 'error', thumbnailStatus: 'error',
      } });
    });
    return () => { current = false; };
  }, [identity, imageUrl, thumbnailUrl, imageUpdatedAt, analysisRequestId, analyzedAt, userId, refreshEpoch, online]);
  // Expiry must keep running offline, even when no replacement request can start.
  useEffect(() => {
    if (resolved?.identity !== identity || resolved.epoch !== refreshEpoch || resolved.value.expiresAt === undefined) return;
    const timer = setTimeout(() => setRefreshEpoch(epoch => epoch + 1), Math.max(1, resolved.value.expiresAt - Date.now() + 1));
    return () => clearTimeout(timer);
  }, [resolved, identity, refreshEpoch]);
  const value = resolved?.identity === identity && resolved.epoch === refreshEpoch
    ? resolved.value : undefined;
  return {
    imageUrl: value?.imageUrl ?? getDirectDreamMediaUrl(imageUrl) ?? '',
    thumbnailUrl: value?.thumbnailUrl ?? getDirectDreamMediaUrl(thumbnailUrl),
    loading: !value && Boolean(imageUrl || thumbnailUrl),
    error: value?.imageStatus === 'error' || value?.thumbnailStatus === 'error',
  };
}
