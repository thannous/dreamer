import type { ImageSource } from 'expo-image';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';

import { DreamShareImage } from '@/components/journal/DreamShareImage';
import { DreamShareSheet } from '@/components/journal/DreamShareSheet';
import { useDreamCoverPlaceholder } from '@/hooks/useDreamCoverPlaceholder';
import { useDreamMedia } from '@/hooks/useDreamMedia';
import { useDreamShareComposite } from '@/hooks/useDreamShareComposite';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamIdentityKey } from '@/lib/dreamIdentity';
import { getDreamImageCacheKey } from '@/lib/imageUtils';
import type { ShareCardOptions } from '@/lib/journal/shareCard';
import type { DreamAnalysis } from '@/lib/types';

/** The dream's painting as the screen behind the composer already resolved it. */
export type DreamShareMedia = {
  imageUrl: string;
  thumbnailUrl?: string;
  loading: boolean;
  /** The picture the dream's journal card holds. */
  placeholder?: ImageSource | null;
};

type SharePreparationStatus = 'ready' | 'failed' | 'stale';

interface ShareCompositeRequest {
  id: number;
  source: string;
  cacheKey?: string;
  dream: DreamAnalysis;
  options: ShareCardOptions;
  date: string;
  onMediaReady: (source: string, ready: boolean) => void;
}

interface PendingShareComposite {
  id: number;
  source: string;
  dreamIdentity: string;
  resolve: (status: SharePreparationStatus) => void;
}

/**
 * Shares a dream as a card, on a phone: the dreamer chooses what the card shows, then the
 * card is drawn off screen, captured once drawn and handed to the system's share sheet.
 * It opens over the screen it is asked from, the dream's page or the journal.
 */
export function DreamShareComposer({
  dream,
  visible,
  onClose,
  media,
  locked = false,
}: {
  dream: DreamAnalysis;
  visible: boolean;
  /** Asked once the composer may close: never while its card is captured or shared. */
  onClose: () => void;
  /** The painting as the screen resolved it; without it, the composer resolves its own. */
  media?: DreamShareMedia;
  /** The dream cannot be shared for now. */
  locked?: boolean;
}) {
  const { t } = useTranslation();
  const { formatDreamDate } = useLocaleFormatting();
  const { shareImageRef, shareComposite } = useDreamShareComposite();
  const ownMedia = useDreamMedia(media ? null : dream);
  const ownPlaceholder = useDreamCoverPlaceholder(media ? null : dream);
  const painting = media ?? ownMedia;
  const placeholder = media ? media.placeholder : ownPlaceholder;

  // The share card's picture, as resolved for the screen. Without one, the card goes without it.
  const shareSource = painting.imageUrl || painting.thumbnailUrl || '';
  const shareCacheKey = painting.imageUrl ? getDreamImageCacheKey(dream) : undefined;
  const shareMediaPending = Boolean(dream.imageUrl || dream.thumbnailUrl) && painting.loading;
  const shareDate = formatDreamDate(dream.id);
  const shareDreamIdentity = getDreamIdentityKey(dream);

  const [isSharing, setIsSharing] = useState(false);
  const [shareRequest, setShareRequest] = useState<ShareCompositeRequest | null>(null);
  // The chosen card is being drawn, before its capture: leaving then cancels the share.
  const [isPreparingShare, setPreparingShare] = useState(false);
  const shareRequestIdRef = useRef(0);
  const pendingShareRef = useRef<PendingShareComposite | null>(null);
  const shareInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const latestShareMediaRef = useRef({ source: shareSource, dreamIdentity: shareDreamIdentity });

  const close = useCallback(() => {
    const pending = pendingShareRef.current;
    if (pending) {
      pendingShareRef.current = null;
      pending.resolve('stale');
    } else if (shareInFlightRef.current) {
      return;
    }
    onClose();
  }, [onClose]);

  const onShareMediaReady = useCallback((requestId: number, source: string, ready: boolean) => {
    const pending = pendingShareRef.current;
    if (!pending || pending.id !== requestId || pending.source !== source) return;
    pendingShareRef.current = null;
    pending.resolve(ready && Boolean(shareImageRef.current) ? 'ready' : 'failed');
  }, [shareImageRef]);
  useLayoutEffect(() => {
    latestShareMediaRef.current = { source: shareSource, dreamIdentity: shareDreamIdentity };
    const pending = pendingShareRef.current;
    if (pending && ((pending.source && pending.source !== shareSource) || pending.dreamIdentity !== shareDreamIdentity)) {
      pendingShareRef.current = null;
      pending.resolve('stale');
    }
  }, [shareSource, shareDreamIdentity]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const pending = pendingShareRef.current;
      pendingShareRef.current = null;
      pending?.resolve('stale');
    };
  }, []);

  // The card as chosen, captured once drawn: after its illustration is displayed or, when
  // that is left out, cannot be had or shown, without it. The choice stays open over the
  // system's share sheet and closes once that sheet is done, shared or not.
  const shareCard = useCallback(async (options: ShareCardOptions) => {
    if (locked || shareInFlightRef.current) return;
    if (options.painting && shareMediaPending) return;
    shareInFlightRef.current = true;
    setIsSharing(true);
    try {
      const requestId = ++shareRequestIdRef.current;
      const source = options.painting ? shareSource : '';
      setPreparingShare(true);
      const preparation = await new Promise<SharePreparationStatus>(resolve => {
        pendingShareRef.current = { id: requestId, source, dreamIdentity: shareDreamIdentity, resolve };
        setShareRequest({
          id: requestId,
          source,
          cacheKey: shareCacheKey,
          dream,
          options,
          date: shareDate,
          onMediaReady: (readySource, ready) => onShareMediaReady(requestId, readySource, ready),
        });
      });
      if (mountedRef.current) setPreparingShare(false);
      if (preparation === 'stale'
        || (source && latestShareMediaRef.current.source !== source)
        || latestShareMediaRef.current.dreamIdentity !== shareDreamIdentity) return;
      if (!shareImageRef.current) throw new Error('Dream share card is not mounted');

      await shareComposite(dream);
      if (mountedRef.current) onClose();
    } catch (error) {
      if (!mountedRef.current) return;
      console.error('Share failed:', error);
      Alert.alert(t('common.error_title'), t('journal.detail.share.error_message'));
    } finally {
      pendingShareRef.current = null;
      shareInFlightRef.current = false;
      if (mountedRef.current) {
        setShareRequest(null);
        setPreparingShare(false);
        setIsSharing(false);
      }
    }
  }, [dream, locked, onClose, shareComposite, shareSource, shareCacheKey, shareDate, t, shareMediaPending, shareDreamIdentity, shareImageRef, onShareMediaReady]);

  return (
    <>
      <DreamShareSheet
        visible={visible}
        onClose={close}
        onShare={shareCard}
        dream={dream}
        date={shareDate}
        painting={shareSource}
        paintingCacheKey={shareCacheKey}
        paintingPlaceholder={placeholder}
        paintingPending={shareMediaPending}
        sharing={isSharing}
        capturing={isSharing && !isPreparingShare}
      />
      {/* The card is drawn off screen only while a share asks for it. */}
      {shareRequest ? (
        <View className="absolute top-0 left-[-10000px] h-[1350px] w-[1080px]">
          <DreamShareImage
            key={shareRequest.id}
            ref={shareImageRef}
            dream={shareRequest.dream}
            t={t}
            options={shareRequest.options}
            date={shareRequest.date}
            resolvedMedia={{ imageUrl: shareRequest.source, imageCacheKey: shareRequest.cacheKey }}
            onMediaReady={shareRequest.onMediaReady}
          />
        </View>
      ) : null}
    </>
  );
}
