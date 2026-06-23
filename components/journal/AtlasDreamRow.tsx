import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout, getTagColor } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamThemeLabel } from '@/lib/dreamLabels';
import { isDreamAnalyzed, isDreamExplored } from '@/lib/dreamUsage';
import { getDreamImageVersion, getDreamThumbnailUri, getImageConfig, withCacheBuster } from '@/lib/imageUtils';
import type { DreamAnalysis } from '@/lib/types';
import { Image } from 'expo-image';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

interface AtlasDreamRowProps {
  dream: DreamAnalysis;
  dateLabel: string;
  sectionLabel?: string | null;
  onPress: (dreamId: number) => void;
  scrollState?: 'idle' | 'scrolling';
  testID?: string;
}

const failedThumbnailUris = new Set<string>();

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
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionLabel, { color: noctalia.accent.soft }]}>{sectionLabel}</Text>
          <View style={[styles.sectionRule, { backgroundColor: noctalia.surface.border }]} />
        </View>
      ) : null}
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.row,
          isNarrow && styles.rowNarrow,
          { borderBottomColor: noctalia.surface.border },
          pressed && styles.rowPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={dream.title || t('journal.card.accessibility.open')}
        testID={testID}
      >
        <View style={styles.timelineColumn}>
          <View style={[styles.timelineLine, { backgroundColor: noctalia.surface.border }]} />
          <View style={[styles.timelineDot, isNarrow && styles.timelineDotNarrow, { backgroundColor: noctalia.accent.soft }]} />
        </View>

        <View style={[styles.thumbnail, isNarrow && styles.thumbnailNarrow, { backgroundColor: noctalia.surface.soft }]}>
          {hasImage ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.thumbnailImage}
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

        <View style={[styles.content, isNarrow && styles.contentNarrow]}>
          <Text style={[styles.title, isNarrow && styles.titleNarrow, { color: noctalia.text.primary }]} numberOfLines={isNarrow ? 2 : 1}>
            {dream.title}
          </Text>
          <Text style={[styles.excerpt, isNarrow && styles.excerptNarrow, { color: noctalia.text.secondary }]} numberOfLines={isNarrow ? 3 : 2}>
            {dream.transcript || dream.shareableQuote}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.date, { color: noctalia.text.tertiary }]}>{dateLabel}</Text>
            {dream.theme ? (
              <View style={[styles.themePill, { backgroundColor: getTagColor(dream.theme, colors) }]}>
                <Text style={[styles.themePillText, { color: noctalia.text.primary }]} numberOfLines={1}>
                  {themeLabel}
                </Text>
              </View>
            ) : null}
            {isExplored || isAnalyzed ? (
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: isExplored
                      ? noctalia.status.success.background
                      : noctalia.action.disabled,
                  },
                ]}
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

      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ThemeLayout.spacing.sm,
    paddingTop: ThemeLayout.spacing.lg,
    paddingBottom: ThemeLayout.spacing.sm,
  },
  sectionLabel: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  sectionRule: {
    flex: 1,
    height: 1,
    opacity: 0.78,
  },
  row: {
    minHeight: 136,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ThemeLayout.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: ThemeLayout.spacing.md,
  },
  rowNarrow: {
    minHeight: 156,
    alignItems: 'flex-start',
    gap: ThemeLayout.spacing.sm,
  },
  rowPressed: {
    opacity: 0.72,
  },
  timelineColumn: {
    alignSelf: 'stretch',
    width: 14,
    alignItems: 'center',
  },
  timelineLine: {
    position: 'absolute',
    top: -ThemeLayout.spacing.md,
    bottom: -ThemeLayout.spacing.md,
    width: 1,
    opacity: 0.8,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 40,
  },
  timelineDotNarrow: {
    marginTop: 32,
  },
  thumbnail: {
    width: 96,
    height: 96,
    borderRadius: ThemeLayout.borderRadius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailNarrow: {
    width: 78,
    height: 78,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: ThemeLayout.spacing.xs,
  },
  contentNarrow: {
    paddingTop: 1,
  },
  title: {
    fontFamily: Fonts.lora.bold,
    fontSize: 21,
  },
  titleNarrow: {
    fontSize: 19,
    lineHeight: 24,
  },
  excerpt: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  excerptNarrow: {
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: ThemeLayout.spacing.sm,
    minHeight: 28,
  },
  date: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
  },
  themePill: {
    maxWidth: 94,
    borderRadius: ThemeLayout.borderRadius.full,
    borderCurve: 'continuous',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  themePillText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
  },
  statusDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
