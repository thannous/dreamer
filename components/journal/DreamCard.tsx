import { thumbnailFailures } from '@/lib/thumbnailFailureCache';
import { getDreamIdentityKey } from '@/lib/dreamIdentity';
import { useDreamMedia } from '@/hooks/useDreamMedia';
import { PressableScale } from '@/components/motion';
import { DreamStoryHalo } from '@/components/journal/story/DreamStoryHalo';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useContentWindow } from '@/context/ContentWindowContext';
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
import { getCardPictureKey, rememberCardPicture } from '@/lib/journalCardPictures';
import { isSquareDreamThumbnail } from '@/lib/journalImageReference';
import { DreamAnalysis } from '@/lib/types';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Platform, Pressable, Text, View } from 'react-native';
import { JournalCardSeal, SEAL_FADE_HEIGHT } from '@/components/journal/JournalCardSeal';
import { FullMoonSeal } from '@/components/ui/FullMoonSeal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { isFullMoonDream } from '@/lib/fullMoon';

export type DreamCardVariant = 'standard' | 'featured';

interface DreamCardProps {
  dream: DreamAnalysis;
  onPress: (dream: DreamAnalysis) => void;
  /** Opens the dream's share sheet; an icon at the card's top right. */
  onShare?: (dream: DreamAnalysis) => void;
  /** Adds or removes the dream from favourites; the heart beside the share icon. */
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
const SCRIM_FADE_STYLE = { height: 140, width: '100%' } as const;
const SEAL_FADE_STYLE = { height: SEAL_FADE_HEIGHT, width: '100%' } as const;
// A sine-like ease into the reading backing below: no step where a bright painting ends.
const SCRIM_FADE_LOCATIONS = [0, 0.14, 0.3, 0.5, 0.7, 0.88, 1] as const;
const SCRIM_FADE_STRENGTH = [0, 0.13, 0.3, 0.52, 0.75, 0.92, 1] as const;
// The heart and share icons at the card's top right, each a 44 pt touch target.
const CARD_ACTION_STYLE = { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' } as const;
// The date on the icons' line: a pill of the same height and veil as their discs.
const CARD_DATE_STYLE = { minHeight: 44, borderRadius: 22, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1, minWidth: 0 } as const;
// Below this card width (scaled with the text), the date names its month and year only.
const CARD_DATE_FULL_WIDTH = 340;
// The arrow beside the dream's last line: 28 pt wide, grown to a 44 pt touch target.
const EXPAND_ARROW_WIDTH = 28;
// The reading block's side and bottom padding (px-6, pb-6) and the gap between its lines (gap-2).
const READING_INSET = 24;
const READING_GAP = 8;
const EXPAND_HIT_SLOP = { top: 11, bottom: 11, left: 8, right: 8 } as const;
// Narrower than any letter of the reading face, in ems: four lines of it overflow any three.
const NARROWEST_LETTER_EM = 0.18;
const MIN_FOLD_LENGTH = 240;
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
  const { fontScale, width: windowWidth, height: windowHeight } = useContentWindow();
  const compactTextScale = Math.min(1.3, Math.max(1, fontScale));
  const titleTextScale = Math.min(1.4, Math.max(1, fontScale));
  const captionStyle = { fontSize: 12 * compactTextScale, lineHeight: 18 * compactTextScale };
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t, currentLang } = useTranslation();
  // The card shows the whole painting at 9:16: an uploaded image's square thumbnail would be
  // cropped and enlarged there, so such a dream loads its original instead.
  const squareThumbnail = isSquareDreamThumbnail(dream.thumbnailUrl);
  const media = useDreamMedia(dream, squareThumbnail ? undefined : { variant: 'thumbnail' });
  const { loadOriginal } = media;
  const handlePress = useCallback(() => {
    onPress(dream);
  }, [onPress, dream]);

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
    if (shouldFallback) loadOriginal();
    // Only update if state doesn't match derived reality
    if (useFullImage !== shouldFallback) {
      setUseFullImage(shouldFallback);
    }
  }, [trimmedThumbnailUri, fullImageUri, useFullImage, accessScope, failureKey, loadOriginal]);

  // The original first for a square thumbnail, while it resolves and loads: offline or after
  // a failed load, the square still shows the painting.
  const [failedOriginal, setFailedOriginal] = useState<string | null>(null);
  const originalAttemptKey = JSON.stringify([accessScope, getDreamIdentityKey(dream), imageVersion, fullImageUri]);
  const preferOriginal = squareThumbnail && Boolean(fullImageUri) && failedOriginal !== originalAttemptKey;
  const preferFullImage = useFullImage || preferOriginal || (trimmedThumbnailUri && thumbnailFailures.has(accessScope, failureKey));
  const imageUri = preferFullImage
    ? fullImageUri
    : (trimmedThumbnailUri || fullImageUri);
  // A recycled card or refreshed signed URL gets its own failure state. Keeping
  // the account in this identity prevents a previous user's load from hiding media.
  const imageAttemptKey = JSON.stringify([accessScope, getDreamIdentityKey(dream), imageVersion, imageUri]);
  const imageCacheKey = preferFullImage ? media.imageCacheKey : thumbnailCacheKey;
  const imageSource = useMemo(() => (imageUri ? { uri: imageUri, cacheKey: imageCacheKey } : null), [imageCacheKey, imageUri]);
  const [failedImageAttempt, setFailedImageAttempt] = useState<string | null>(null);
  // A phone list's card spans the screen less its 16 pt sides: right from the first frame.
  const [coverWidth, setCoverWidth] = useState(() => windowWidth - 32);
  // Native Text still shapes long inputs behind numberOfLines. Four lines of the narrowest
  // letters always reach past the three shown, so more text changes neither what the card
  // shows nor whether its arrow appears: the card's width sets how much to keep. Navigation
  // and storage retain the complete dream.
  const foldLength = Math.max(MIN_FOLD_LENGTH, Math.ceil(4 * Math.max(0, coverWidth - 2 * READING_INSET)
    / (NARROWEST_LETTER_EM * 15 * compactTextScale)));
  const transcriptPreview = useMemo(() => dream.transcript.length > foldLength
    ? `${dream.transcript.slice(0, foldLength).replace(/[\uD800-\uDBFF]$/u, '')}…`
    : dream.transcript, [dream.transcript, foldLength]);
  // 9:16, the format the paintings are generated in: on a phone the whole painting shows.
  // Never taller than most of the screen, so a short screen still sees the dream's text. On
  // the web the screen, not the window: a mobile browser's window follows its toolbars and
  // keyboard. A native window keeps its height under the keyboard, and on the iPhone Duo,
  // whose two displays make "the screen" ambiguous, it is the display the dream is on.
  const coverMaxHeight = Platform.OS === 'web' ? Dimensions.get('screen').height : windowHeight;
  const coverMinHeight = Math.min(coverWidth * 16 / 9, Math.round(coverMaxHeight * 0.8));
  // The scrim's own colour at rising strength, so the painting eases into the backing.
  const scrimFade = useMemo(() => {
    const base = Number(/([\d.]+)\)$/.exec(noctalia.illustration.scrim)?.[1] ?? 1);
    const at = (alpha: number) => noctalia.illustration.scrim.replace(/[\d.]+\)$/, `${+(alpha).toFixed(3)})`);
    return SCRIM_FADE_STRENGTH.map((strength) => at(base * strength)) as unknown as readonly [string, string, ...string[]];
  }, [noctalia]);
  // The whole dream can be read in place; the arrow shows only when three lines cut it.
  // FlashList can reuse this component for another dream without unmounting it: an unfolded
  // dream folds again, while whether three lines cut the text stays the last measure's verdict.
  // A measure reports a layout only when its height changes, and the same height gives the
  // same verdict, so a recycled card renders once, not again for its arrow.
  const readingKey = `${getDreamIdentityKey(dream)}:${compactTextScale}:${dream.transcript}`;
  const [reading, setReading] = useState({ key: readingKey, expanded: false, canExpand: false });
  const expanded = reading.key === readingKey && reading.expanded;
  const { canExpand } = reading;
  // A dream unfolded here folds again once the card shows another one: only then does the card
  // render again for it, so it comes back folded whichever card it lands in.
  useEffect(() => {
    if (reading.expanded && reading.key !== readingKey) setReading((previous) => ({ ...previous, expanded: false }));
  }, [reading.expanded, reading.key, readingKey]);
  // The dream's last line ends just above its labels, at the foot of the card: their height
  // alone places the arrow beside it. Sizes, not positions, because the web reports a layout
  // only when a size changes, while a recycled card or a resized list can move the text.
  const [metadataHeight, setMetadataHeight] = useState<number | null>(null);
  // Without a painting, what the folded text leaves above it is the seal's room. Only a seal's
  // card renders again for it; a painted card keeps it for the seal it may fall back to.
  const foldedReading = useRef<number | null>(null);
  const [foldedReadingHeight, setFoldedReadingHeight] = useState<number | null>(null);
  const hasImage = (Boolean(imageUri) || (media.loading && Boolean(dream.imageUrl || dream.thumbnailUrl)))
    && failedImageAttempt !== imageAttemptKey;
  useEffect(() => {
    if (!hasImage) setFoldedReadingHeight(foldedReading.current);
  }, [hasImage]);

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
  // An almanac leaf: the day's numeral, then its weekday over its month and year; a narrow card
  // keeps the month and year only.
  const fullDate = coverWidth >= CARD_DATE_FULL_WIDTH * compactTextScale;
  const dateDay = String(new Date(dream.id).getDate());
  const dateEyebrow = formatLocaleDate(dream.id, locale, fullDate ? { weekday: 'long' } : { month: 'short' });
  const dateFoot = formatLocaleDate(dream.id, locale, fullDate ? { month: 'long', year: 'numeric' } : { year: 'numeric' });
  const syncState = isMockModeEnabled() ? 'clean' : getDreamSyncState(dream);
  const fullMoon = isFullMoonDream(dream.id);

  const badges = useMemo(() => {
    const list: {
      label?: string;
      icon?: Parameters<typeof IconSymbol>[0]['name'];
      variant: keyof typeof BADGE_TEXT_CLASS;
    }[] = [];
    // An analysed or deepened dream is the usual case: its card names no state (owner
    // decisions 2026-10-20).
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
      return noctalia.illustration.text;
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
          <Text allowFontScaling={false} style={captionStyle} className={`min-w-0 shrink font-sans text-[12px] leading-[18px] ${badge.variant === 'secondary' ? 'text-illustration-text' : BADGE_TEXT_CLASS[badge.variant]}`}>
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
    fullMoon ? t('full_moon.seal') : undefined,
    typeLabel, recurringLabel, memoryLabel, themeLabel,
    ...badges.map((badge) => badge.label),
  ].filter(Boolean).join(', ');

  const readingText = (
    <>
      <Text
        key={`title-${fontScale}`}
        allowFontScaling={false}
        style={[{ fontSize: (variant === 'featured' ? 26 : 24) * titleTextScale, lineHeight: (variant === 'featured' ? 32 : 30) * titleTextScale }]}
        className={`font-display text-illustration-text ${variant === 'featured' ? 'text-[26px] leading-[32px]' : 'text-[24px] leading-[30px]'}`}
        numberOfLines={2}
      >
        {dream.title}
      </Text>
      {/* The arrow's column is kept even when the dream fits, so the text never rewraps once measured. */}
      <View className="flex-row items-end gap-1">
      <View className="relative min-w-0 flex-1">
      <Text accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        allowFontScaling={false} pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, opacity: 0,
          fontSize: 15 * compactTextScale, lineHeight: 22 * compactTextScale }}
        className="font-sans" testID={testID && `journal.measure.${testID}`}
        numberOfLines={4}
        onLayout={(event) => {
          // A page hidden behind another route (on the web) lays its cards out at zero
          // size: keep the last real measure instead of rendering the card twice.
          if (event.nativeEvent.layout.height <= 0) return;
          const overflows = event.nativeEvent.layout.height > 3 * 22 * compactTextScale + 1;
          setReading((previous) => previous.canExpand === overflows ? previous : { ...previous, canExpand: overflows });
        }}>
        {transcriptPreview}
      </Text>
      <Text
        key={`preview-${fontScale}`}
        testID={testID && `journal.preview.${testID}`}
        allowFontScaling={false}
        style={[{ fontSize: 15 * compactTextScale, lineHeight: 22 * compactTextScale }]}
        className="font-sans text-[15px] leading-[22px] text-illustration-text"
        // At least three lines of the dream, with or without an illustration; all of it once unfolded.
        numberOfLines={expanded ? undefined : 3}
      >
        {expanded ? dream.transcript : transcriptPreview}
      </Text>
      </View>
      <View style={{ width: EXPAND_ARROW_WIDTH }} />
      </View>
    </>
  );
  const labelClass = 'min-w-0 shrink font-sans text-[12px] leading-[18px] text-illustration-text';
  const labelIconColor = noctalia.illustration.text;
  // What the dream is, below its text: its kind, theme, signals and state.
  const metadata = (
    <View key={`metadata-${fontScale}`} className="flex-row flex-wrap items-center gap-x-3 gap-y-1 pt-1" testID={testID && `journal.metadata.${testID}`}
      onLayout={(event) => {
        // A page hidden behind another route (on the web) lays its cards out at zero size.
        const { height } = event.nativeEvent.layout;
        if (height > 0) setMetadataHeight((previous) => previous === height ? previous : height);
      }}>
      <Text allowFontScaling={false} style={captionStyle} className="min-w-0 shrink font-sans-medium text-[12px] leading-[18px] text-illustration-text">{typeLabel}</Text>
      {themeLabel ? <Text allowFontScaling={false} style={captionStyle} className={labelClass}>{themeLabel}</Text> : null}
      {recurringLabel ? (
        <View className="flex-row items-center gap-1">
          <IconSymbol name="arrow.triangle.2.circlepath" size={12} color={labelIconColor} />
          <Text allowFontScaling={false} style={captionStyle} className={labelClass}>{recurringLabel}</Text>
        </View>
      ) : null}
      {memoryLabel ? (
        <View className="flex-row items-center gap-1">
          <IconSymbol name="moon.stars.fill" size={12} color={labelIconColor} />
          <Text allowFontScaling={false} style={captionStyle} className={labelClass}>{memoryLabel}</Text>
        </View>
      ) : null}
      {badgeList}
    </View>
  );
  // Over the painting or the seal's night, each icon sits on a disc of the reading veil, and the
  // date on a pill of it at the line's start. The card's own label already names the date.
  const actionStyle = [CARD_ACTION_STYLE, { backgroundColor: noctalia.illustration.scrim }];
  const dateChip = (
    <View key={`date-${fontScale}`} style={[CARD_DATE_STYLE, { backgroundColor: noctalia.illustration.scrim }]} pointerEvents="none"
      accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID && `journal.date.${testID}`}>
      <Text allowFontScaling={false} style={{ fontSize: 24 * compactTextScale, lineHeight: 28 * compactTextScale }}
        className="font-display text-[24px] leading-[28px] text-illustration-text">
        {dateDay}
      </Text>
      <View className="min-w-0 shrink">
        <Text allowFontScaling={false} numberOfLines={1} style={{ fontSize: 11 * compactTextScale, lineHeight: 14 * compactTextScale, letterSpacing: 1.4 }}
          className="font-sans-medium text-[11px] uppercase leading-[14px] text-illustration-text">
          {dateEyebrow}
        </Text>
        <Text allowFontScaling={false} numberOfLines={1} style={{ fontSize: 12 * compactTextScale, lineHeight: 15 * compactTextScale }}
          className="font-sans text-[12px] leading-[15px] text-illustration-text">
          {dateFoot}
        </Text>
      </View>
      {/* A dream noted after a full moon's night keeps its silver seal on the date. */}
      {fullMoon ? <FullMoonSeal size={22 * compactTextScale} /> : null}
    </View>
  );
  const actions = (
    <View className="absolute left-3 right-3 top-3 flex-row items-start justify-between gap-2" pointerEvents="box-none">
      {dateChip}
      <View className="flex-row gap-2">
      {onToggleFavorite ? (
        <Pressable accessibilityRole="button" accessibilityState={{ selected: isFavorite }} aria-pressed={isFavorite}
          accessibilityLabel={t('journal.badge.favorite')} hitSlop={4} onPress={(event) => { event.stopPropagation(); onToggleFavorite(dream); }}
          testID={testID && `journal.favorite.${testID}`} style={actionStyle}>
          <IconSymbol name={isFavorite ? 'heart.fill' : 'heart'} size={22} color={isFavorite ? noctalia.accent.text : labelIconColor} />
        </Pressable>
      ) : isFavorite ? (
        <View style={actionStyle}><IconSymbol name="heart.fill" size={22} color={noctalia.accent.text} /></View>
      ) : null}
      {onShare ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('journal.detail.share.button_default')}
          hitSlop={4} onPress={(event) => { event.stopPropagation(); onShare(dream); }} testID={testID && `journal.share.${testID}`} style={actionStyle}>
          <IconSymbol name="square.and.arrow.up" size={21} color={labelIconColor} />
        </Pressable>
      ) : null}
      </View>
    </View>
  );
  // Over the card rather than inside its button: a button never holds another one.
  const expandControl = canExpand && metadataHeight !== null ? (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
      accessibilityLabel={t(expanded ? 'journal.card.collapse' : 'journal.card.expand')}
      hitSlop={EXPAND_HIT_SLOP} onPress={(event) => { event.stopPropagation(); setReading((previous) => ({ ...previous, key: readingKey, expanded: !(previous.key === readingKey && previous.expanded) })); }}
      testID={testID && `journal.expand.${testID}`} className="absolute items-end justify-center"
      style={{ right: READING_INSET, bottom: READING_INSET + metadataHeight + READING_GAP, width: EXPAND_ARROW_WIDTH, height: 22 * compactTextScale }}
    >
      <IconSymbol name={expanded ? 'chevron.up' : 'chevron.down'} size={20} color={noctalia.illustration.text} />
    </Pressable>
  ) : null;
  return (
    <PressableScale onPress={handlePress} accessible={false} testID={testID}>
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel}
        onPress={(event) => { event.stopPropagation(); handlePress(); }}>
      {/* Every card has the painting's frame: without a painting, the dream's seal stands in it. */}
      <View
        className="w-full justify-end overflow-hidden rounded-[24px] bg-ink-raised"
        style={{ minHeight: coverMinHeight }}
        onLayout={(event) => {
          if (event.nativeEvent.layout.width > 0) setCoverWidth(event.nativeEvent.layout.width);
        }}
        testID={testID && `journal.cover.${testID}`}
      >
        {hasImage ? (
          // The list already moves the paintings with the finger. Keep each one
          // still in its frame: no per-card native measure or animated commit
          // on every scroll event, including cards in the recycling pool.
          <Image
            source={imageSource}
            style={CARD_IMAGE_STYLE}
            pointerEvents="none"
            contentFit={imageConfig.contentFit}
            transition={imageTransition}
            cachePolicy={imageConfig.cachePolicy}
            priority={imagePriority}
            recyclingKey={imageRecyclingKey}
            onError={() => {
              if (!preferFullImage && trimmedThumbnailUri && trimmedThumbnailUri !== fullImageUri) {
                thumbnailFailures.record(accessScope, failureKey);
              }
              if (!preferFullImage && (fullImageUri || dream.imageUrl?.trim()) && imageUri !== fullImageUri) {
                loadOriginal();
                setUseFullImage(true);
              } else if (preferOriginal && trimmedThumbnailUri && trimmedThumbnailUri !== fullImageUri) {
                setFailedOriginal(originalAttemptKey);
              } else {
                // Both sources failed (or the only source failed). Do not keep
                // presenting the blurhash as if an illustration were available.
                setFailedImageAttempt(imageAttemptKey);
              }
            }}
            // The dream's page opens on what the card shows, from the same source and cache.
            onDisplay={() => {
              if (imageSource) rememberCardPicture(getCardPictureKey(accessScope, dream), imageSource);
            }}
            placeholder={imagePlaceholder}
            accessible={false}
            importantForAccessibility="no"
          />
        ) : (
          <JournalCardSeal theme={dream.theme} frameHeight={coverMinHeight} readingHeight={foldedReadingHeight}
            testID={testID && `journal.seal.${testID}`} />
        )}
        <LinearGradient
          // Eased, not linear: the painting stays clear until the veil nears the text.
          colors={scrimFade}
          locations={SCRIM_FADE_LOCATIONS}
          style={hasImage ? SCRIM_FADE_STYLE : SEAL_FADE_STYLE}
          pointerEvents="none"
        />
        {/* In-flow backing grows with the dream's text; the card grows past 9:16 only when unfolded. */}
        <View className="gap-2 bg-illustration-scrim px-6 pb-6" testID={testID && `journal.text.${testID}`}
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            if (height <= 0 || expanded) return;
            foldedReading.current = height;
            if (!hasImage) setFoldedReadingHeight((previous) => previous === height ? previous : height);
          }}>
          {readingText}
          {metadata}
        </View>
      </View>
      </Pressable>
      {actions}
      {expandControl}
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
