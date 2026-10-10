import { thumbnailFailures } from '@/lib/thumbnailFailureCache';
import { getDreamIdentityKey } from '@/lib/dreamIdentity';
import { useDreamMedia } from '@/hooks/useDreamMedia';
import { PressableScale } from '@/components/motion';
import { DreamStoryHalo } from '@/components/journal/story/DreamStoryHalo';
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
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

export type DreamCardVariant = 'standard' | 'featured';

interface DreamCardProps {
  dream: DreamAnalysis;
  onPress: (dream: DreamAnalysis) => void;
  /** Opens the dream's share sheet; shown as an icon in the date margin. */
  onShare?: (dream: DreamAnalysis) => void;
  /** Adds or removes the dream from favourites; the heart in the margin. */
  onToggleFavorite?: (dream: DreamAnalysis) => void;
  testID?: string;
  /** Date string to display as an overline above the title */
  dateLabel?: string;
  /** Card variant: 'featured' for first card, 'standard' for rest */
  variant?: DreamCardVariant;
  /** The dream story's epilogue: this card glows once. */
  glow?: boolean;
  /** Called once the glow has played on this card. */
  onGlowDone?: () => void;
}


/** Expo media components keep their geometry as native props. */
const CARD_IMAGE_STYLE = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } as const;
const SCRIM_FADE_STYLE = { height: 56, width: '100%' } as const;
// Margin icons, one per line, each with a 44 pt touch target around its glyph.
const MARGIN_ACTION_STYLE = { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' } as const;
const CARD_IMAGE_PLACEHOLDER = { blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' };

const BADGE_TEXT_CLASS = {
  secondary: 'text-ivory-muted',
  warning: 'text-warning-on',
  danger: 'text-danger-on',
} as const;

export const DreamCard = memo(function DreamCard({
  dream,
  onPress,
  onShare,
  onToggleFavorite,
  testID,
  dateLabel,
  variant = 'standard',
  glow = false,
  onGlowDone,
}: DreamCardProps) {
  const { colors, mode } = useTheme();
  const { fontScale } = useWindowDimensions();
  const compactTextScale = Math.min(1.3, Math.max(1, fontScale));
  const titleTextScale = Math.min(1.4, Math.max(1, fontScale));
  const captionStyle = { fontSize: 12 * compactTextScale, lineHeight: 18 * compactTextScale };
  // The margin holds the date and the dream's labels; wide enough for a two-line label.
  const dateMarginWidth = Math.max(88, Math.ceil(64 * compactTextScale) + 12);
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

  const preferFullImage = useFullImage || (trimmedThumbnailUri && thumbnailFailures.has(accessScope, failureKey));
  const imageUri = preferFullImage
    ? fullImageUri
    : (trimmedThumbnailUri || fullImageUri);
  // A recycled card or refreshed signed URL gets its own failure state. Keeping
  // the account in this identity prevents a previous user's load from hiding media.
  const imageAttemptKey = JSON.stringify([accessScope, getDreamIdentityKey(dream), imageVersion, imageUri]);
  const [failedImageAttempt, setFailedImageAttempt] = useState<string | null>(null);
  const [coverWidth, setCoverWidth] = useState(260);
  // The whole dream can be read in place; the arrow shows only when three lines cut it.
  const [expanded, setExpanded] = useState(false);
  const canExpand = dream.transcript.trim().length > 120;
  const hasImage = (Boolean(imageUri) || (media.loading && Boolean(dream.imageUrl || dream.thumbnailUrl)))
    && failedImageAttempt !== imageAttemptKey;

  useEffect(() => {
    if ((!useFullImage && failedImageAttempt !== imageAttemptKey)
      || retriedThumbnail.current === retryIdentity) return;
    const timer = setTimeout(() => {
      retriedThumbnail.current = retryIdentity;
      thumbnailFailures.remove(accessScope, failureKey);
      setUseFullImage(false);
      setFailedImageAttempt(null);
    }, thumbnailFailures.ttlMs);
    return () => clearTimeout(timer);
  }, [useFullImage, failedImageAttempt, imageAttemptKey, retryIdentity, accessScope, failureKey]);

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
        className="max-w-full flex-row items-center gap-1.5"
        testID={testID && `journal.badge.${testID}.${i}`}
      >
        {badge.icon && (
          <IconSymbol name={badge.icon} size={13} color={getBadgeIconColor(badge.variant)} />
        )}
        {badge.label && (
          <Text allowFontScaling={false} style={captionStyle} className={`min-w-0 shrink font-sans text-[12px] leading-[18px] ${BADGE_TEXT_CLASS[badge.variant]}`}>
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
        key={`title-${fontScale}`}
        allowFontScaling={false}
        style={{ fontSize: (variant === 'featured' ? 22 : 20) * titleTextScale, lineHeight: 28 * titleTextScale }}
        className={`font-display leading-[28px] ${hasImage ? 'text-illustration-text' : 'text-ivory'} ${variant === 'featured' ? 'text-[22px]' : 'text-[20px]'}`}
        numberOfLines={2}
      >
        {dream.title}
      </Text>
      <Text
        key={`preview-${fontScale}`}
        allowFontScaling={false}
        style={{ fontSize: 15 * compactTextScale, lineHeight: 22 * compactTextScale }}
        className={`font-sans text-[15px] leading-[22px] ${hasImage ? 'text-illustration-text' : 'text-ivory-muted'}`}
        // At least three lines of the dream, with or without an illustration; all of it once unfolded.
        numberOfLines={expanded ? undefined : 3}
      >
        {expanded ? dream.transcript : transcriptPreview}
      </Text>
      {canExpand ? (
        <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
          accessibilityLabel={t(expanded ? 'journal.card.collapse' : 'journal.card.expand')}
          hitSlop={10} onPress={() => setExpanded((value) => !value)}
          testID={testID && `journal.expand.${testID}`} className="h-8 w-10 items-start justify-center">
          <IconSymbol name={expanded ? 'chevron.up' : 'chevron.down'} size={22} color={hasImage ? noctalia.illustration.text : noctalia.text.secondary} />
        </Pressable>
      ) : null}
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
      {/* The margin reads as three quiet blocks, set flush left: when, what you can do, what the dream is. */}
      <View className="shrink-0 self-stretch border-r border-line pr-2" style={{ width: dateMarginWidth }} testID={testID && `journal.margin.${testID}`}>
        <View key={`date-${fontScale}`} className="items-center">
          <Text allowFontScaling={false} style={{ fontSize: 38 * compactTextScale, lineHeight: 42 * compactTextScale }} className="font-sans-medium text-[38px] leading-[42px] text-ivory">{dateDay}</Text>
          <Text allowFontScaling={false} style={{ fontSize: 13 * compactTextScale, lineHeight: 18 * compactTextScale, letterSpacing: 1.2 }} className="font-sans-medium text-[13px] uppercase leading-[18px] text-ivory-muted">{dateMonth.replace('.', '')}</Text>
          <Text allowFontScaling={false} style={captionStyle} className="font-sans text-[12px] leading-[18px] text-ivory-faint">{dateYear}</Text>
        </View>
        <View className="my-3 h-px w-11/12 self-center bg-line" />
        <View className="items-center gap-1">
          {onToggleFavorite ? (
            <Pressable accessibilityRole="button" accessibilityState={{ selected: isFavorite }}
              accessibilityLabel={t('journal.badge.favorite')} hitSlop={8} onPress={() => onToggleFavorite(dream)}
              testID={testID && `journal.favorite.${testID}`} style={MARGIN_ACTION_STYLE}>
              <IconSymbol name={isFavorite ? 'heart.fill' : 'heart'} size={28} color={isFavorite ? noctalia.accent.text : noctalia.text.secondary} />
            </Pressable>
          ) : isFavorite ? <IconSymbol name="heart.fill" size={28} color={noctalia.accent.text} /> : null}
          {onShare ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('journal.detail.share.button_default')}
              hitSlop={8} onPress={() => onShare(dream)} testID={testID && `journal.share.${testID}`} style={MARGIN_ACTION_STYLE}>
              <IconSymbol name="square.and.arrow.up" size={27} color={noctalia.text.secondary} />
            </Pressable>
          ) : null}
        </View>
        <View className="my-3 h-px w-11/12 self-center bg-line" />
        <View key={`metadata-${fontScale}`} className="gap-1" testID={testID && `journal.metadata.${testID}`}>
          <Text allowFontScaling={false} style={captionStyle} className="font-sans-medium text-[12px] leading-[18px] text-ivory">{typeLabel}</Text>
          {themeLabel && <Text allowFontScaling={false} style={captionStyle} className="font-sans text-[12px] leading-[18px] text-ivory-muted">{themeLabel}</Text>}
          {recurringLabel && (
            <View className="flex-row items-center gap-1">
              <IconSymbol name="arrow.triangle.2.circlepath" size={12} color={noctalia.text.secondary} />
              <Text allowFontScaling={false} style={captionStyle} className="shrink font-sans text-[12px] leading-[18px] text-ivory-muted">{recurringLabel}</Text>
            </View>
          )}
          {memoryLabel && (
            <View className="flex-row items-center gap-1">
              <IconSymbol name="moon.stars.fill" size={12} color={noctalia.text.secondary} />
              <Text allowFontScaling={false} style={captionStyle} className="shrink font-sans text-[12px] leading-[18px] text-ivory-muted">{memoryLabel}</Text>
            </View>
          )}
        </View>
      </View>
      <View className="min-w-0 flex-1 gap-3">
        {hasImage ? (
          <View
            className="relative w-full overflow-hidden rounded-xl bg-ink-raised"
            // 9:16, the format the illustrations are generated in: the whole image shows. Capped on wide screens.
            style={{ minHeight: Math.min(coverWidth * 16 / 9, 620) }}
            onLayout={(event) => setCoverWidth(event.nativeEvent.layout.width)}
            testID={testID && `journal.cover.${testID}`}
          >
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
                } else {
                  // Both sources failed (or the only source failed). Do not keep
                  // presenting the blurhash as if an illustration were available.
                  setFailedImageAttempt(imageAttemptKey);
                }
              }}
              placeholder={imagePlaceholder}
              accessible={false}
              importantForAccessibility="no"
            />
            <View testID={testID && `journal.text.${testID}`}>
              {/* In-flow backing grows with the actual five-line text block. */}
              <View
                className="gap-2 bg-illustration-scrim px-4 pb-3 pt-4"
                testID={testID && `journal.backing.${testID}`}
              >
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
        {badgeList.length ? (
          <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1" testID={testID && `journal.status.${testID}`}>{badgeList}</View>
        ) : null}
      </View>
      {glow ? <DreamStoryHalo onDone={onGlowDone} /> : null}
    </PressableScale>
  );
}, (prev, next) => {
  if (prev === next) return true;
  if (prev.onPress !== next.onPress) return false;
  if (prev.onShare !== next.onShare) return false;
  if (prev.onToggleFavorite !== next.onToggleFavorite) return false;
  if (prev.testID !== next.testID) return false;
  if (prev.dateLabel !== next.dateLabel) return false;
  if (prev.variant !== next.variant) return false;
  if (prev.glow !== next.glow) return false;
  if (prev.onGlowDone !== next.onGlowDone) return false;

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
