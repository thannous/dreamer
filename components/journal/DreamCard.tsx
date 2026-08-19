import { PressableScale } from '@/components/motion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamThemeLabel } from '@/lib/dreamLabels';
import { areDreamMemoryMetadataEqual, getDreamSyncState } from '@/lib/dreamUtils';
import { isRememberedDream } from '@/lib/dreamFilters';
import { isDreamAnalyzed, isDreamExplored } from '@/lib/dreamUsage';
import { isMockModeEnabled } from '@/lib/env';
import { getDreamImageVersion, getDreamThumbnailUri, getImageConfig, withCacheBuster } from '@/lib/imageUtils';
import { DreamAnalysis } from '@/lib/types';
import { Image } from 'expo-image';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

export type DreamCardVariant = 'standard' | 'featured';

interface DreamCardProps {
  dream: DreamAnalysis;
  onPress: (dreamId: number) => void;
  scrollState?: 'idle' | 'scrolling';
  testID?: string;
  /** Date string to display as an overline above the title */
  dateLabel?: string;
  /** Card variant: 'featured' for first card, 'standard' for rest */
  variant?: DreamCardVariant;
}

const failedThumbnailUris = new Set<string>();

/** expo-image is not a Uniwind component, so its fill style stays an object. */
const CARD_IMAGE_STYLE = { width: '100%', height: '100%' } as const;

/** Tag colours have to resolve to a literal class so Tailwind can see them. */
const THEME_TAG_CLASS: Record<string, string> = {
  surreal: 'bg-tag-surreal',
  mystical: 'bg-tag-mystical',
  calm: 'bg-tag-calm',
  noir: 'bg-tag-noir',
};

const BADGE_CLASS: Record<'accent' | 'secondary' | 'warning' | 'danger', string> = {
  accent: 'bg-champagne',
  secondary: 'bg-ink-soft',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

const BADGE_TEXT_CLASS: Record<'accent' | 'secondary' | 'warning' | 'danger', string> = {
  accent: 'text-on-champagne',
  secondary: 'text-ivory',
  warning: 'text-warning-on',
  danger: 'text-danger-on',
};

const CARD_CLASS = 'overflow-hidden rounded-md border border-continuous border-line bg-ink-raised';

export const DreamCard = memo(function DreamCard({
  dream,
  onPress,
  scrollState = 'idle',
  testID,
  dateLabel,
  variant = 'standard',
}: DreamCardProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const handlePress = useCallback(() => {
    onPress(dream.id);
  }, [onPress, dream.id]);

  const isScrolling = scrollState === 'scrolling';
  const isFeatured = variant === 'featured';

  // Use thumbnail URL for list view, fallback to generating one from full URL
  const imageVersion = useMemo(
    () => getDreamImageVersion(dream),
    [dream]
  );
  const thumbnailUri = useMemo(() => (
    getDreamThumbnailUri({
      thumbnailUrl: dream.thumbnailUrl,
      imageUrl: dream.imageUrl,
      imageUpdatedAt: dream.imageUpdatedAt,
      analysisRequestId: dream.analysisRequestId,
      analyzedAt: dream.analyzedAt,
      id: dream.id,
    }) ?? ''
  ), [dream.thumbnailUrl, dream.imageUrl, dream.imageUpdatedAt, dream.analysisRequestId, dream.analyzedAt, dream.id]);
  const fullImageUri = useMemo(() => {
    const uri = dream.imageUrl?.trim() ?? '';
    return uri ? withCacheBuster(uri, imageVersion) : '';
  }, [dream.imageUrl, imageVersion]);
  const trimmedThumbnailUri = thumbnailUri.trim();

  // OPTIMIZATION: Initialize state with known failed status to avoid double-render on mount
  const [useFullImage, setUseFullImage] = useState(() => {
    return !!trimmedThumbnailUri && failedThumbnailUris.has(trimmedThumbnailUri);
  });

  useEffect(() => {
    const shouldFallback = !!trimmedThumbnailUri && failedThumbnailUris.has(trimmedThumbnailUri);
    // Only update if state doesn't match derived reality
    if (useFullImage !== shouldFallback) {
      setUseFullImage(shouldFallback);
    }
  }, [trimmedThumbnailUri, fullImageUri, useFullImage]);

  const preferFullImage = useFullImage || (trimmedThumbnailUri && failedThumbnailUris.has(trimmedThumbnailUri));
  const imageUri = preferFullImage
    ? fullImageUri
    : (trimmedThumbnailUri || fullImageUri);
  const hasImage = Boolean(imageUri);

  const themeLabel = useMemo(() => getDreamThemeLabel(dream.theme, t) ?? dream.theme, [dream.theme, t]);

  // Get optimized image config for thumbnails
  const imageConfig = useMemo(() => getImageConfig('thumbnail'), []);
  const imageRecyclingKey = `${dream.id}-${imageVersion ?? 0}`;
  const imageTransition = isScrolling ? 0 : imageConfig.transition;
  const imagePlaceholder = isScrolling ? null : { blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' };
  const imagePriority = isScrolling ? 'low' : imageConfig.priority;

  const isExplored = isDreamExplored(dream);
  const isAnalyzed = isDreamAnalyzed(dream);
  const isRemembered = isRememberedDream(dream);
  const isFavorite = !!dream.isFavorite;
  const syncState = isMockModeEnabled() ? 'clean' : getDreamSyncState(dream);

  const badges = useMemo(() => {
    const list: {
      label?: string;
      icon?: Parameters<typeof IconSymbol>[0]['name'];
      variant: 'accent' | 'secondary' | 'warning' | 'danger';
    }[] = [];
    if (isRemembered) {
      list.push({
        label: t('recording.activation_insight.signal.memory'),
        icon: 'moon.stars.fill',
        variant: 'secondary',
      });
    }
    if (isExplored) {
      list.push({
        label: t('journal.badge.explored'),
        icon: 'bubble.left.and.bubble.right.fill',
        variant: 'accent',
      });
    }
    if (!isExplored && isAnalyzed) {
      list.push({
        label: t('journal.badge.analyzed'),
        icon: 'sparkles',
        variant: 'secondary',
      });
    }
    // Don't add favorite badge when using vertical layout — we show the heart overlay instead
    if (isFavorite && !hasImage) {
      list.push({
        label: t('journal.badge.favorite'),
        icon: 'heart.fill',
        variant: 'secondary',
      });
    }
    if (syncState === 'pending') {
      list.push({
        label: t('journal.badge.sync_pending'),
        icon: 'arrow.triangle.2.circlepath',
        variant: 'secondary',
      });
    } else if (syncState === 'failed') {
      list.push({
        label: t('journal.badge.sync_failed'),
        icon: 'exclamationmark.triangle.fill',
        variant: 'warning',
      });
    } else if (syncState === 'conflict') {
      list.push({
        label: t('journal.badge.sync_conflict'),
        icon: 'exclamationmark.octagon.fill',
        variant: 'danger',
      });
    }
    return list;
  }, [hasImage, isAnalyzed, isExplored, isFavorite, isRemembered, syncState, t]);

  const getBadgeIconColor = useCallback(
    (variant: 'accent' | 'secondary' | 'warning' | 'danger') => {
      if (variant === 'accent') return noctalia.action.primaryText;
      if (variant === 'danger') return noctalia.status.danger.text;
      if (variant === 'warning') return noctalia.status.warning.text;
      return noctalia.text.primary;
    },
    [noctalia]
  );

  const badgeList = badges.map((badge, i) => {
    const key = badge.label || badge.icon || String(i);

    return (
      <View
        key={key}
        className={`flex-row items-center gap-1 rounded-full border-continuous px-2.5 py-1 ${BADGE_CLASS[badge.variant]}`}
        accessibilityLabel={badge.label}
        accessible={!!badge.label}
      >
        {badge.icon && (
          <IconSymbol name={badge.icon} size={14} color={getBadgeIconColor(badge.variant)} />
        )}
        {badge.label && (
          <Text className={`font-sans-medium text-[11px] ${BADGE_TEXT_CLASS[badge.variant]}`}>
            {badge.label}
          </Text>
        )}
      </View>
    );
  });

  const themeTag = dream.theme ? (
    <View
      className={`rounded-full border-continuous px-2 py-1 ${
        THEME_TAG_CLASS[dream.theme] ?? THEME_TAG_CLASS.surreal
      }`}
    >
      <Text className="font-sans text-[12px] text-ivory">{themeLabel}</Text>
    </View>
  ) : null;

  // Vertical layout: image on top (cards with images)
  if (hasImage) {
    return (
      <PressableScale
        className={CARD_CLASS}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={dream.title || t('journal.card.accessibility.open')}
        testID={testID}
      >
        <View className={`w-full overflow-hidden ${isFeatured ? 'h-[200px]' : 'h-[160px]'}`}>
          <Image
            source={{ uri: imageUri }}
            style={CARD_IMAGE_STYLE}
            contentFit={imageConfig.contentFit}
            transition={imageTransition}
            cachePolicy={imageConfig.cachePolicy}
            priority={imagePriority}
            recyclingKey={imageRecyclingKey}
            onError={() => {
              if (trimmedThumbnailUri && trimmedThumbnailUri !== fullImageUri) {
                failedThumbnailUris.add(trimmedThumbnailUri);
              }
              if (!preferFullImage && fullImageUri && imageUri !== fullImageUri) {
                setUseFullImage(true);
              }
            }}
            placeholder={imagePlaceholder}
          />
          {/* Heart overlay for favorited dreams */}
          {isFavorite && (
            <View className="absolute right-2.5 top-2.5 h-8 w-8 items-center justify-center rounded-md border-continuous bg-ink-overlay">
              <IconSymbol name="heart.fill" size={18} color={noctalia.accent.soft} />
            </View>
          )}
        </View>
        <View className="gap-2 p-4">
          {dateLabel && (
            <Text className="font-sans-medium text-[11px] uppercase text-ivory-faint">
              {dateLabel}
            </Text>
          )}
          <Text
            className={`font-serif-bold text-ivory ${isFeatured ? 'text-[20px]' : 'text-[16px]'}`}
            numberOfLines={isFeatured ? 2 : 1}
          >
            {dream.title}
          </Text>
          {isFeatured && dream.shareableQuote ? (
            <Text className="min-h-[80px] font-sans italic text-body-sm text-ivory-muted" numberOfLines={4}>
              {dream.shareableQuote}
            </Text>
          ) : (
            <Text className="min-h-[80px] font-sans text-body-sm text-ivory-muted" numberOfLines={4}>
              {dream.transcript}
            </Text>
          )}
          {(dream.theme || badges.length > 0) && (
            <View className="flex-row flex-wrap gap-2">
              {themeTag}
              {badgeList}
            </View>
          )}
        </View>
      </PressableScale>
    );
  }

  // Horizontal layout: text-only cards (no image)
  return (
    <PressableScale
      className={CARD_CLASS}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={dream.title || t('journal.card.accessibility.open')}
      testID={testID}
    >
      <View className="flex-1 justify-center gap-2 p-4">
        {dateLabel && (
          <Text className="font-sans-medium text-[11px] uppercase text-ivory-faint">
            {dateLabel}
          </Text>
        )}
        <Text className="font-serif-bold text-[16px] text-ivory" numberOfLines={1}>
          {dream.title}
        </Text>
        <Text className="font-sans text-body-sm text-ivory-muted" numberOfLines={3}>
          {dream.transcript}
        </Text>
        {(dream.theme || badges.length > 0) && (
          <View className="flex-row flex-wrap gap-2">
            {themeTag}
            {badgeList}
          </View>
        )}
      </View>
    </PressableScale>
  );
}, (prev, next) => {
  if (prev === next) return true;
  if (prev.onPress !== next.onPress) return false;
  if (prev.scrollState !== next.scrollState) return false;
  if (prev.testID !== next.testID) return false;
  if (prev.dateLabel !== next.dateLabel) return false;
  if (prev.variant !== next.variant) return false;

  const prevDream = prev.dream;
  const nextDream = next.dream;
  if (prevDream === nextDream) return true;

  const prevHasModelMessage = prevDream.chatHistory?.some((message) => message.role === 'model') ?? false;
  const nextHasModelMessage = nextDream.chatHistory?.some((message) => message.role === 'model') ?? false;

  return (
    prevDream.id === nextDream.id
    && prevDream.title === nextDream.title
    && prevDream.transcript === nextDream.transcript
    && prevDream.theme === nextDream.theme
    && prevDream.isFavorite === nextDream.isFavorite
    && prevDream.thumbnailUrl === nextDream.thumbnailUrl
    && prevDream.imageUrl === nextDream.imageUrl
    && prevDream.imageUpdatedAt === nextDream.imageUpdatedAt
    && prevDream.analysisRequestId === nextDream.analysisRequestId
    && prevDream.analyzedAt === nextDream.analyzedAt
    && prevDream.isAnalyzed === nextDream.isAnalyzed
    && prevDream.explorationStartedAt === nextDream.explorationStartedAt
    && prevDream.shareableQuote === nextDream.shareableQuote
    && areDreamMemoryMetadataEqual(prevDream.memory, nextDream.memory)
    && prevDream.syncState === nextDream.syncState
    && prevDream.lastSyncError === nextDream.lastSyncError
    && prevHasModelMessage === nextHasModelMessage
  );
});
