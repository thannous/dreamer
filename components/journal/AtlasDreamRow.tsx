import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamThemeLabel } from '@/lib/dreamLabels';
import { isDreamAnalyzed, isDreamExplored } from '@/lib/dreamUsage';
import { getDreamImageVersion, getDreamThumbnailUri, getImageConfig, withCacheBuster } from '@/lib/imageUtils';
import type { DreamAnalysis } from '@/lib/types';
import { Image } from 'expo-image';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

interface AtlasDreamRowProps {
  dream: DreamAnalysis;
  dateLabel: string;
  sectionLabel?: string | null;
  onPress: (dreamId: number) => void;
  scrollState?: 'idle' | 'scrolling';
  testID?: string;
}

const failedThumbnailUris = new Set<string>();

/** expo-image is not a Uniwind component, so its fill style stays an object. */
const THUMBNAIL_IMAGE_STYLE = { width: '100%', height: '100%' } as const;

/** Tag colours have to resolve to a literal class so Tailwind can see them. */
const THEME_PILL_CLASS: Record<string, string> = {
  surreal: 'bg-tag-surreal',
  mystical: 'bg-tag-mystical',
  calm: 'bg-tag-calm',
  noir: 'bg-tag-noir',
};

export const AtlasDreamRow = memo(function AtlasDreamRow({
  dream,
  dateLabel,
  sectionLabel,
  onPress,
  scrollState = 'idle',
  testID,
}: AtlasDreamRowProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isNarrow = width < 520;
  const imageConfig = useMemo(() => getImageConfig('thumbnail'), []);
  const imageVersion = useMemo(() => getDreamImageVersion(dream), [dream]);
  const thumbnailUri = useMemo(
    () =>
      getDreamThumbnailUri({
        thumbnailUrl: dream.thumbnailUrl,
        imageUrl: dream.imageUrl,
        imageUpdatedAt: dream.imageUpdatedAt,
        analysisRequestId: dream.analysisRequestId,
        analyzedAt: dream.analyzedAt,
        id: dream.id,
      }) ?? '',
    [
      dream.analyzedAt,
      dream.analysisRequestId,
      dream.id,
      dream.imageUpdatedAt,
      dream.imageUrl,
      dream.thumbnailUrl,
    ],
  );
  const fullImageUri = useMemo(() => {
    const uri = dream.imageUrl?.trim() ?? '';
    return uri ? withCacheBuster(uri, imageVersion) : '';
  }, [dream.imageUrl, imageVersion]);
  const trimmedThumbnailUri = thumbnailUri.trim();
  const [useFullImage, setUseFullImage] = useState(() => {
    return Boolean(trimmedThumbnailUri && failedThumbnailUris.has(trimmedThumbnailUri));
  });
  const preferFullImage = useFullImage || Boolean(trimmedThumbnailUri && failedThumbnailUris.has(trimmedThumbnailUri));
  const imageUri = preferFullImage ? fullImageUri : trimmedThumbnailUri || fullImageUri;
  const hasImage = Boolean(imageUri);
  const isScrolling = scrollState === 'scrolling';
  const themeLabel = useMemo(() => getDreamThemeLabel(dream.theme, t) ?? dream.theme, [dream.theme, t]);
  const isAnalyzed = isDreamAnalyzed(dream);
  const isExplored = isDreamExplored(dream);

  const handlePress = useCallback(() => {
    onPress(dream.id);
  }, [dream.id, onPress]);

  const imageTransition = isScrolling ? 0 : imageConfig.transition;
  const imagePriority = isScrolling ? 'low' : imageConfig.priority;
  const imagePlaceholder = isScrolling ? null : { blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' };
  const imageRecyclingKey = `${dream.id}-${imageVersion ?? 0}`;

  return (
    <View>
      {sectionLabel ? (
        <View className="flex-row items-center gap-2 pb-2 pt-6">
          {/* `champagne-soft` is #EAD4B4 in BOTH themes, so as text it was near-invisible on
              the light cream ground. `champagne-on` is the readable accent per theme. */}
          <Text className="font-sans-bold text-[12px] uppercase text-champagne-on">{sectionLabel}</Text>
          <View className="h-px flex-1 bg-line opacity-[0.78]" />
        </View>
      ) : null}
      <PressableScale
        onPress={handlePress}
        className={`flex-row border-b-[length:hairlineWidth()] border-line py-4 ${
          isNarrow ? 'min-h-[156px] items-start gap-2' : 'min-h-[136px] items-center gap-4'
        }`}
        accessibilityRole="button"
        accessibilityLabel={dream.title || t('journal.card.accessibility.open')}
        testID={testID}
      >
        <View className="w-[14px] items-center self-stretch">
          <View className="absolute -bottom-4 -top-4 w-px bg-line opacity-80" />
          <View className={`h-2 w-2 rounded-full bg-champagne-soft ${isNarrow ? 'mt-8' : 'mt-10'}`} />
        </View>

        <View
          className={`items-center justify-center overflow-hidden rounded-lg border-continuous bg-ink-soft ${
            isNarrow ? 'h-[78px] w-[78px]' : 'h-24 w-24'
          }`}
        >
          {hasImage ? (
            <Image
              source={{ uri: imageUri }}
              style={THUMBNAIL_IMAGE_STYLE}
              contentFit={imageConfig.contentFit}
              transition={imageTransition}
              cachePolicy={imageConfig.cachePolicy}
              priority={imagePriority}
              recyclingKey={imageRecyclingKey}
              placeholder={imagePlaceholder}
              onError={() => {
                if (trimmedThumbnailUri && trimmedThumbnailUri !== fullImageUri) {
                  failedThumbnailUris.add(trimmedThumbnailUri);
                }
                if (!preferFullImage && fullImageUri && imageUri !== fullImageUri) {
                  setUseFullImage(true);
                }
              }}
            />
          ) : (
            <IconSymbol name="moon.stars.fill" size={30} color={noctalia.accent.soft} />
          )}
        </View>

        <View className={`min-w-0 flex-1 gap-1 ${isNarrow ? 'pt-px' : ''}`}>
          <Text
            className={`font-serif-bold text-ivory ${isNarrow ? 'text-[19px] leading-6' : 'text-[21px]'}`}
            numberOfLines={isNarrow ? 2 : 1}
          >
            {dream.title}
          </Text>
          <Text
            className={`font-sans text-ivory-muted ${isNarrow ? 'text-[13px] leading-[18px]' : 'text-body-sm'}`}
            numberOfLines={isNarrow ? 3 : 2}
          >
            {dream.transcript || dream.shareableQuote}
          </Text>
          <View className="min-h-[28px] flex-row flex-wrap items-center gap-2">
            <Text className="font-sans text-[13px] text-ivory-faint">{dateLabel}</Text>
            {dream.theme ? (
              <View
                className={`max-w-[94px] rounded-full border-continuous px-2.5 py-1 ${
                  THEME_PILL_CLASS[dream.theme] ?? THEME_PILL_CLASS.surreal
                }`}
              >
                <Text className="font-sans-medium text-[12px] text-ivory" numberOfLines={1}>
                  {themeLabel}
                </Text>
              </View>
            ) : null}
            {isExplored || isAnalyzed ? (
              <View
                className={`h-[26px] w-[26px] items-center justify-center rounded-full ${
                  isExplored ? 'bg-success' : 'bg-champagne-dim'
                }`}
                accessibilityLabel={isExplored ? t('journal.badge.explored') : t('journal.badge.analyzed')}
              >
                <IconSymbol
                  name={isExplored ? 'bubble.left.and.bubble.right.fill' : 'sparkles'}
                  size={13}
                  color={isExplored ? noctalia.status.success.icon : noctalia.accent.soft}
                />
              </View>
            ) : null}
          </View>
        </View>

      </PressableScale>
    </View>
  );
});
