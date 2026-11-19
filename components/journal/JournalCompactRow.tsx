import { Image } from 'expo-image';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useDreamMedia } from '@/hooks/useDreamMedia';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamIdentityKey } from '@/lib/dreamIdentity';
import { getDreamThemeLabel } from '@/lib/dreamLabels';
import { getDreamAnalysisState, isDreamAnalyzed, isDreamExplored } from '@/lib/dreamUsage';
import { getDreamSyncState } from '@/lib/dreamUtils';
import { isMockModeEnabled } from '@/lib/env';
import {
  getDreamImageVersion,
  getDreamThumbnailCacheKey,
  getDreamThumbnailUri,
  getImageConfig,
  withCacheBuster,
} from '@/lib/imageUtils';
import { getCardPictureKey, rememberCardPicture } from '@/lib/journalCardPictures';
import { thumbnailFailures } from '@/lib/thumbnailFailureCache';
import type { DreamAnalysis } from '@/lib/types';

interface JournalCompactRowProps {
  dream: DreamAnalysis;
  dateLabel: string;
  /** The month heading above the first dream of each month; omitted in a grid. */
  sectionLabel?: string | null;
  onPress: (dream: DreamAnalysis) => void;
  onToggleFavorite?: (dream: DreamAnalysis) => void;
  testID?: string;
}

/** expo-image is not a Uniwind component, so its fill style stays an object. */
const THUMBNAIL_IMAGE_STYLE = { width: '100%', height: '100%' } as const;
const THUMBNAIL_PLACEHOLDER = { blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' };
const FAVORITE_HIT_SLOP = 6;

/** Tag colours have to resolve to a literal class so Uniwind can see them. */
const THEME_PILL_CLASS: Record<string, string> = {
  surreal: 'bg-tag-surreal',
  mystical: 'bg-tag-mystical',
  calm: 'bg-tag-calm',
  noir: 'bg-tag-noir',
  luminous: 'bg-tag-luminous',
  nostalgic: 'bg-tag-nostalgic',
};

const SYNC_ICONS = {
  pending: 'arrow.triangle.2.circlepath',
  failed: 'exclamationmark.triangle.fill',
  conflict: 'exclamationmark.octagon.fill',
} as const;

/**
 * The journal's compact layout: one dense row per dream, its painting as a small square,
 * so many dreams can be reread at a glance.
 */
export const JournalCompactRow = memo(function JournalCompactRow({
  dream,
  dateLabel,
  sectionLabel,
  onPress,
  onToggleFavorite,
  testID,
}: JournalCompactRowProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  // A square frame: the square thumbnail is exactly what it shows.
  const media = useDreamMedia(dream, { variant: 'thumbnail' });
  const { loadOriginal } = media;

  const imageVersion = useMemo(() => getDreamImageVersion(dream), [dream]);
  const thumbnailUri = useMemo(() => (
    getDreamThumbnailUri({
      thumbnailUrl: media.thumbnailUrl,
      imageUrl: media.imageUrl,
      imageUpdatedAt: dream.imageUpdatedAt,
      analysisRequestId: dream.analysisRequestId,
      analyzedAt: dream.analyzedAt,
      id: dream.id,
    }) ?? ''
  ).trim(), [media.thumbnailUrl, media.imageUrl, dream.imageUpdatedAt, dream.analysisRequestId, dream.analyzedAt, dream.id]);
  const fullImageUri = useMemo(() => {
    const uri = media.imageUrl?.trim() ?? '';
    return uri ? withCacheBuster(uri, imageVersion) : '';
  }, [media.imageUrl, imageVersion]);

  const accessScope = media.accessScope ?? null;
  const thumbnailCacheKey = getDreamThumbnailCacheKey(media);
  const failureKey = thumbnailCacheKey ?? thumbnailUri;
  // A recycled row gets its own failure state: the attempt names the dream and its source.
  const attemptIdentity = JSON.stringify([accessScope, getDreamIdentityKey(dream), imageVersion]);
  const [fallback, setFallback] = useState<{ identity: string; full: boolean; failed: boolean } | null>(null);
  const attempt = fallback?.identity === attemptIdentity ? fallback : null;
  const preferFullImage = attempt?.full || (Boolean(thumbnailUri) && thumbnailFailures.has(accessScope, failureKey));
  const imageUri = preferFullImage ? fullImageUri : (thumbnailUri || fullImageUri);
  const imageCacheKey = preferFullImage ? media.imageCacheKey : thumbnailCacheKey;
  const imageSource = useMemo(() => (imageUri ? { uri: imageUri, cacheKey: imageCacheKey } : null), [imageCacheKey, imageUri]);
  const hasImage = Boolean(imageSource) && !attempt?.failed;
  const imageConfig = useMemo(() => getImageConfig('thumbnail'), []);

  const handleImageError = useCallback(() => {
    if (!preferFullImage && thumbnailUri && thumbnailUri !== fullImageUri) {
      thumbnailFailures.record(accessScope, failureKey);
    }
    if (!preferFullImage && (fullImageUri || dream.imageUrl?.trim())) {
      loadOriginal();
      setFallback({ identity: attemptIdentity, full: true, failed: false });
    } else {
      setFallback({ identity: attemptIdentity, full: true, failed: true });
    }
  }, [accessScope, attemptIdentity, dream.imageUrl, failureKey, fullImageUri, loadOriginal, preferFullImage, thumbnailUri]);

  const handlePress = useCallback(() => onPress(dream), [dream, onPress]);

  const themeLabel = useMemo(() => getDreamThemeLabel(dream.theme, t) ?? dream.theme, [dream.theme, t]);
  const isFavorite = Boolean(dream.isFavorite);
  const analysisState = getDreamAnalysisState(dream);
  // As on the cards, an analysed or deepened dream names no state.
  const stateLabel = isDreamAnalyzed(dream) || isDreamExplored(dream)
    ? undefined
    : analysisState.status === 'pending'
      ? t('journal.detail.action.pending.cta')
      : analysisState.status === 'failed'
        ? t('analysis_error.title')
        : t('journal.badge.unanalyzed');
  const syncState = isMockModeEnabled() ? 'clean' : getDreamSyncState(dream);
  const syncLabel = syncState === 'pending'
    ? t('journal.badge.sync_pending')
    : syncState === 'failed'
      ? t('journal.badge.sync_failed')
      : syncState === 'conflict'
        ? t('journal.badge.sync_conflict')
        : undefined;
  const syncIconColor = syncState === 'failed'
    ? noctalia.status.warning.text
    : syncState === 'conflict'
      ? noctalia.status.danger.text
      : noctalia.text.secondary;

  const accessibilityLabel = [
    dream.title || t('journal.card.accessibility.open'),
    dateLabel,
    isFavorite ? t('journal.badge.favorite') : undefined,
    themeLabel,
    stateLabel,
    syncLabel,
  ].filter(Boolean).join(', ');

  return (
    <View>
      {sectionLabel ? (
        <View className="flex-row items-center gap-2 pb-2 pt-5" accessibilityRole="header">
          <Text className="font-sans-bold text-[12px] uppercase text-champagne-on">{sectionLabel}</Text>
          <View className="h-px flex-1 bg-line opacity-[0.78]" />
        </View>
      ) : null}
      <View className="flex-row items-center border-b-[length:hairlineWidth()] border-line">
        <PressableScale
          onPress={handlePress}
          className="min-w-0 flex-1 flex-row items-center gap-3 py-3"
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          testID={testID}
        >
          <View className="h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-xl border-continuous bg-ink-raised">
            {hasImage ? (
              <Image
                source={imageSource}
                style={THUMBNAIL_IMAGE_STYLE}
                pointerEvents="none"
                contentFit="cover"
                transition={imageConfig.transition}
                cachePolicy={imageConfig.cachePolicy}
                priority={imageConfig.priority}
                recyclingKey={JSON.stringify([accessScope, getDreamIdentityKey(dream), imageVersion ?? 0])}
                placeholder={THUMBNAIL_PLACEHOLDER}
                onError={handleImageError}
                onDisplay={() => {
                  if (imageSource) rememberCardPicture(getCardPictureKey(accessScope, dream), imageSource);
                }}
                accessible={false}
                importantForAccessibility="no"
              />
            ) : (
              <IconSymbol name="moon.stars.fill" size={28} color={noctalia.accent.soft} />
            )}
          </View>

          <View className="min-w-0 flex-1 gap-0.5" accessible={false} importantForAccessibility="no-hide-descendants">
            <Text className="font-serif-bold text-[18px] leading-6 text-ivory" numberOfLines={1}
              testID={testID && `journal.compact.title.${testID}`}>
              {dream.title}
            </Text>
            <Text className="font-sans text-[13px] leading-[18px] text-ivory-muted" numberOfLines={2}>
              {dream.transcript || dream.shareableQuote}
            </Text>
            <View className="mt-1 flex-row flex-wrap items-center gap-x-2 gap-y-1">
              <Text className="font-sans text-[12px] leading-4 text-ivory-faint" numberOfLines={1}>{dateLabel}</Text>
              {themeLabel ? (
                <View className={`max-w-[110px] rounded-full border-continuous px-2 py-0.5 ${
                  THEME_PILL_CLASS[dream.theme ?? ''] ?? THEME_PILL_CLASS.surreal
                }`}>
                  <Text className="font-sans-medium text-[11px] leading-4 text-ivory" numberOfLines={1}>{themeLabel}</Text>
                </View>
              ) : null}
              {stateLabel ? (
                <Text className="font-sans text-[12px] leading-4 text-ivory-faint" numberOfLines={1}>{stateLabel}</Text>
              ) : null}
              {syncLabel ? (
                <IconSymbol name={SYNC_ICONS[syncState as keyof typeof SYNC_ICONS]} size={13} color={syncIconColor} />
              ) : null}
            </View>
          </View>
        </PressableScale>

        {onToggleFavorite ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isFavorite }}
            aria-pressed={isFavorite}
            accessibilityLabel={t('journal.badge.favorite')}
            hitSlop={FAVORITE_HIT_SLOP}
            onPress={() => onToggleFavorite(dream)}
            testID={testID && `journal.favorite.${testID}`}
            className="h-11 w-11 items-center justify-center"
          >
            <IconSymbol
              name={isFavorite ? 'heart.fill' : 'heart'}
              size={20}
              color={isFavorite ? noctalia.accent.text : noctalia.text.secondary}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});
