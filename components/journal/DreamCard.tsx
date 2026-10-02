import { thumbnailFailures } from '@/lib/thumbnailFailureCache';
import { getDreamIdentityKey } from '@/lib/dreamIdentity';
import { useDreamMedia } from '@/hooks/useDreamMedia';
import { PressableScale } from '@/components/motion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamThemeLabel, getDreamTypeLabel } from '@/lib/dreamLabels';
import { formatLocaleDate } from '@/lib/dateUtils';
import { getFormattingLocale } from '@/lib/locale';
import { areDreamMemoryMetadataEqual, getDreamSyncState } from '@/lib/dreamUtils';
import { isRememberedDream, isRecurringDream } from '@/lib/dreamFilters';
import { getDreamAnalysisState, isDreamAnalyzed, isDreamExplored } from '@/lib/dreamUsage';
import { isMockModeEnabled } from '@/lib/env';
import { getDreamImageVersion, getDreamThumbnailCacheKey, getDreamThumbnailUri, getImageConfig, withCacheBuster } from '@/lib/imageUtils';
import { DreamAnalysis } from '@/lib/types';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

export type DreamCardVariant = 'standard' | 'featured';

interface DreamCardProps {
  dream: DreamAnalysis;
  onPress: (dream: DreamAnalysis) => void;
  testID?: string;
  /** Date string to display as an overline above the title */
  dateLabel?: string;
  /** Card variant: 'featured' for first card, 'standard' for rest */
  variant?: DreamCardVariant;
}


/** Expo media components keep their geometry as native props. */
const CARD_IMAGE_STYLE = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } as const;
const SCRIM_FADE_STYLE = { height: 56, width: '100%' } as const;
const CARD_IMAGE_PLACEHOLDER = { blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' };

const BADGE_TEXT_CLASS = {
  secondary: 'text-ivory-muted',
  warning: 'text-warning-on',
  danger: 'text-danger-on',
} as const;

export const DreamCard = memo(function DreamCard({
  dream,
  onPress,
  testID,
  dateLabel,
  variant = 'standard',
}: DreamCardProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t, currentLang } = useTranslation();
  const media = useDreamMedia(dream);
  const handlePress = useCallback(() => {
    onPress(dream);
  }, [onPress, dream]);

  // Native Text still shapes long inputs behind numberOfLines. Keep enough text
  // for every card width; navigation and storage retain the complete dream.
  const transcriptPreview = useMemo(() => dream.transcript.length > 1000
    ? `${dream.transcript.slice(0, 1000).replace(/[\uD800-\uDBFF]$/u, '')}…`
    : dream.transcript, [dream.transcript]);

  // Use thumbnail URL for list view, fallback to generating one from full URL
  const imageVersion = useMemo(
    () => getDreamImageVersion(dream),
    [dream]
  );
  const thumbnailUri = useMemo(() => (
    getDreamThumbnailUri({
      thumbnailUrl: media.thumbnailUrl,
      imageUrl: media.imageUrl,
      imageUpdatedAt: dream.imageUpdatedAt,
      analysisRequestId: dream.analysisRequestId,
      analyzedAt: dream.analyzedAt,
      id: dream.id,
    }) ?? ''
  ), [media.thumbnailUrl, media.imageUrl, dream.imageUpdatedAt, dream.analysisRequestId, dream.analyzedAt, dream.id]);
  const fullImageUri = useMemo(() => {
    const uri = media.imageUrl?.trim() ?? '';
    return uri ? withCacheBuster(uri, imageVersion) : '';
  }, [media.imageUrl, imageVersion]);
  const trimmedThumbnailUri = thumbnailUri.trim();

  const accessScope = media.accessScope ?? null;
  const thumbnailCacheKey = getDreamThumbnailCacheKey(media);
  const failureKey = thumbnailCacheKey ?? trimmedThumbnailUri;
  const retryIdentity = JSON.stringify([accessScope, failureKey]);
  const retriedThumbnail = useRef<string | null>(null);

  // Initialize state with known failed status to avoid double-render on mount
  const [useFullImage, setUseFullImage] = useState(() => {
    return !!trimmedThumbnailUri && thumbnailFailures.has(accessScope, failureKey);
  });

  useEffect(() => {
    const shouldFallback = !!trimmedThumbnailUri && thumbnailFailures.has(accessScope, failureKey);
    // Only update if state doesn't match derived reality
    if (useFullImage !== shouldFallback) {
      setUseFullImage(shouldFallback);
    }
  }, [trimmedThumbnailUri, fullImageUri, useFullImage, accessScope, failureKey]);

  useEffect(() => {
    if (!useFullImage || retriedThumbnail.current === retryIdentity) return;
    const timer = setTimeout(() => {
      retriedThumbnail.current = retryIdentity;
      thumbnailFailures.remove(accessScope, failureKey);
      setUseFullImage(false);
    }, thumbnailFailures.ttlMs);
    return () => clearTimeout(timer);
  }, [useFullImage, retryIdentity, accessScope, failureKey]);

  const preferFullImage = useFullImage || (trimmedThumbnailUri && thumbnailFailures.has(accessScope, failureKey));
  const imageUri = preferFullImage
    ? fullImageUri
    : (trimmedThumbnailUri || fullImageUri);
  const hasImage = Boolean(dream.imageUrl || dream.thumbnailUrl);

  const themeLabel = useMemo(() => getDreamThemeLabel(dream.theme, t) ?? dream.theme, [dream.theme, t]);

  // Get optimized image config for thumbnails
  const imageConfig = useMemo(() => getImageConfig('thumbnail'), []);
  const imageRecyclingKey = JSON.stringify([accessScope, getDreamIdentityKey(dream), imageVersion ?? 0]);
  const imageTransition = imageConfig.transition;
  const imagePlaceholder = CARD_IMAGE_PLACEHOLDER;
  const imagePriority = imageConfig.priority;

  const isExplored = isDreamExplored(dream);
  const isAnalyzed = isDreamAnalyzed(dream);
  const isRemembered = isRememberedDream(dream);
  const isRecurring = isRecurringDream(dream);
  const isFavorite = !!dream.isFavorite;
  const analysisState = getDreamAnalysisState(dream);
  // Legacy unanalysed captures defaulted to Symbolic Dream without classification.
  const dreamType = !dream.dreamType || (dream.dreamType === 'Symbolic Dream' && !isAnalyzed)
    ? 'Unknown'
    : dream.dreamType;
  const typeLabel = getDreamTypeLabel(dreamType, t);
  const locale = getFormattingLocale(currentLang ?? 'en');
  const dateDay = formatLocaleDate(dream.id, locale, { day: 'numeric' });
  const dateMonth = formatLocaleDate(dream.id, locale, { month: 'short' });
  const dateYear = new Date(dream.id).getFullYear();
  const syncState = isMockModeEnabled() ? 'clean' : getDreamSyncState(dream);

  const badges = useMemo(() => {
    const list: {
      label?: string;
      icon?: Parameters<typeof IconSymbol>[0]['name'];
      variant: keyof typeof BADGE_TEXT_CLASS;
    }[] = [];
    if (isExplored) {
      list.push({
        label: t('journal.badge.explored'),
        icon: 'bubble.left.and.bubble.right.fill',
        variant: 'secondary',
      });
    }
    if (!isExplored && isAnalyzed) {
      list.push({
        label: t('journal.badge.analyzed'),
        icon: 'sparkles',
        variant: 'secondary',
      });
    }
    if (!isAnalyzed && !isExplored) {
      list.push({
        label: analysisState.status === 'pending'
          ? t('journal.detail.action.pending.cta')
          : analysisState.status === 'failed'
            ? t('analysis_error.title')
            : t('journal.badge.unanalyzed'),
        icon: analysisState.status === 'pending' ? 'hourglass' : undefined,
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
  }, [analysisState.status, isAnalyzed, isExplored, syncState, t]);

  const getBadgeIconColor = useCallback(
    (variant: keyof typeof BADGE_TEXT_CLASS) => {
      if (variant === 'danger') return noctalia.status.danger.text;
      if (variant === 'warning') return noctalia.status.warning.text;
      return noctalia.text.secondary;
    },
    [noctalia]
  );

  const badgeList = badges.map((badge, i) => {
    const key = badge.label || badge.icon || String(i);

    return (
      <View
        key={key}
        className="gap-1 border-t border-line pt-3"
      >
        {badge.icon && (
          <IconSymbol name={badge.icon} size={14} color={getBadgeIconColor(badge.variant)} />
        )}
        {badge.label && (
          <Text className={`font-sans text-[12px] leading-[18px] ${BADGE_TEXT_CLASS[badge.variant]}`}>
            {badge.label}
          </Text>
        )}
      </View>
    );
  });

  const recurringLabel = isRecurring && dreamType !== 'Recurring Dream'
    ? t('journal.badge.recurring')
    : undefined;
  const memoryLabel = isRemembered ? t('recording.activation_insight.signal.memory') : undefined;
  const accessibilityLabel = [
    dream.title || t('journal.card.accessibility.open'),
    dateLabel ?? formatLocaleDate(dream.id, locale, { day: 'numeric', month: 'long', year: 'numeric' }),
    isFavorite ? t('journal.badge.favorite') : undefined,
    typeLabel, recurringLabel, memoryLabel, themeLabel,
    ...badges.map((badge) => badge.label),
  ].filter(Boolean).join(', ');

  const readingText = (
    <>
      <Text
        className={hasImage
          ? `font-display leading-[28px] text-illustration-text ${variant === 'featured' ? 'text-[22px]' : 'text-[20px]'}`
          : 'font-display text-[22px] leading-[28px] text-ivory'}
        numberOfLines={2}
      >
        {dream.title}
      </Text>
      <Text
        className={hasImage
          ? 'font-sans text-[15px] leading-[22px] text-illustration-text'
          : 'font-sans text-[15px] leading-[22px] text-ivory-muted'}
        numberOfLines={hasImage ? 3 : 4}
      >
        {transcriptPreview}
      </Text>
    </>
  );

  return (
    <PressableScale
      className="flex-row items-start gap-3 border-t border-line pt-4"
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <View className="w-[84px] shrink-0 self-stretch gap-4 border-r border-line pr-3" testID={testID && `journal.margin.${testID}`}>
        <View>
          <Text className="font-sans-medium text-[30px] leading-[34px] text-ivory">{dateDay}</Text>
          <Text className="font-sans text-[14px] leading-[20px] text-ivory-muted">{dateMonth}</Text>
          {dateYear !== new Date().getFullYear() && (
            <Text className="font-sans text-[12px] leading-[18px] text-ivory-muted">{dateYear}</Text>
          )}
        </View>
        {isFavorite && <IconSymbol name="heart.fill" size={24} color={noctalia.accent.text} />}
        <View className="gap-2">
          <Text className="font-sans text-[12px] leading-[18px] text-ivory">{typeLabel}</Text>
          {recurringLabel && (
            <View className="gap-1">
              <IconSymbol name="arrow.triangle.2.circlepath" size={14} color={noctalia.text.secondary} />
              <Text className="font-sans text-[12px] leading-[18px] text-ivory-muted">{recurringLabel}</Text>
            </View>
          )}
          {memoryLabel && (
            <View className="gap-1">
              <IconSymbol name="moon.stars.fill" size={14} color={noctalia.text.secondary} />
              <Text className="font-sans text-[12px] leading-[18px] text-ivory-muted">{memoryLabel}</Text>
            </View>
          )}
        </View>
        {themeLabel && (
          <View className="border-t border-line pt-3">
            <Text className="font-sans text-[12px] leading-[18px] text-ivory-muted">{themeLabel}</Text>
          </View>
        )}
        {badgeList}
      </View>
      <View className="min-w-0 flex-1">
        {hasImage ? (
          <View className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-ink-raised" testID={testID && `journal.cover.${testID}`}>
            <Image
              source={imageUri ? { uri: imageUri, cacheKey: preferFullImage ? media.imageCacheKey : thumbnailCacheKey } : null}
              style={CARD_IMAGE_STYLE}
              contentFit={imageConfig.contentFit}
              transition={imageTransition}
              cachePolicy={imageConfig.cachePolicy}
              priority={imagePriority}
              recyclingKey={imageRecyclingKey}
              onError={() => {
                if (!preferFullImage && trimmedThumbnailUri && trimmedThumbnailUri !== fullImageUri) {
                  thumbnailFailures.record(accessScope, failureKey);
                }
                if (!preferFullImage && fullImageUri && imageUri !== fullImageUri) {
                  setUseFullImage(true);
                }
              }}
              placeholder={imagePlaceholder}
              accessible={false}
              importantForAccessibility="no"
            />
            <View testID={testID && `journal.text.${testID}`}>
              {/* In-flow backing covers every text line before the gradient fades. */}
              <View className="gap-2 bg-illustration-scrim px-4 pb-3 pt-4">
                {readingText}
              </View>
              <LinearGradient
                colors={[noctalia.illustration.scrim, noctalia.illustration.transparent]}
                style={SCRIM_FADE_STYLE}
                pointerEvents="none"
              />
            </View>
          </View>
        ) : (
          <View className="gap-2 pr-1" testID={testID && `journal.text.${testID}`}>{readingText}</View>
        )}
      </View>
    </PressableScale>
  );
}, (prev, next) => {
  if (prev === next) return true;
  if (prev.onPress !== next.onPress) return false;
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
    && prevDream.dreamType === nextDream.dreamType
    && prevDream.isFavorite === nextDream.isFavorite
    && prevDream.thumbnailUrl === nextDream.thumbnailUrl
    && prevDream.imageUrl === nextDream.imageUrl
    && prevDream.imageUpdatedAt === nextDream.imageUpdatedAt
    && prevDream.analysisRequestId === nextDream.analysisRequestId
    && prevDream.analyzedAt === nextDream.analyzedAt
    && prevDream.isAnalyzed === nextDream.isAnalyzed
    && prevDream.analysisStatus === nextDream.analysisStatus
    && prevDream.explorationStartedAt === nextDream.explorationStartedAt
    && prevDream.shareableQuote === nextDream.shareableQuote
    && areDreamMemoryMetadataEqual(prevDream.memory, nextDream.memory)
    && prevDream.syncState === nextDream.syncState
    && prevDream.lastSyncError === nextDream.lastSyncError
    && prevHasModelMessage === nextHasModelMessage
  );
});
