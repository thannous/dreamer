import { ThemeLayout, getTagColor } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';
import { useScalePress } from '@/hooks/useJournalAnimations';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamThemeLabel } from '@/lib/dreamLabels';
import { isDreamAnalyzed, isDreamExplored } from '@/lib/dreamUsage';
import { getDreamImageVersion, getDreamThumbnailUri, getImageConfig, withCacheBuster } from '@/lib/imageUtils';
import { DreamAnalysis } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

interface DreamCardProps {
  dream: DreamAnalysis;
  onPress: (dream: DreamAnalysis) => void;
  shouldLoadImage?: boolean;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const failedThumbnailUris = new Set<string>();

export const DreamCard = memo(function DreamCard({
  dream,
  onPress,
  shouldLoadImage = true,
  testID,
}: DreamCardProps) {
  const { colors } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = useScalePress();
  const { t } = useTranslation();

  // Use thumbnail URL for list view, fallback to generating one from full URL
  const imageVersion = useMemo(
    () => getDreamImageVersion(dream),
    [dream.imageUpdatedAt, dream.analysisRequestId, dream.analyzedAt, dream.id]
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

  // OPTIMIZATION: Removed dynamic scroll-based props (transition, priority, placeholder)
  // because toggling them causes full list re-renders that outweigh the benefits.
  const imageTransition = imageConfig.transition;
  const imagePlaceholder = { blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' };
  const imagePriority = imageConfig.priority;

  const isExplored = isDreamExplored(dream);
  const isAnalyzed = isDreamAnalyzed(dream);
  const isFavorite = !!dream.isFavorite;

  const badges = useMemo(() => {
    const list: { label?: string; icon?: string; variant: 'accent' | 'secondary' }[] = [];
    if (isExplored) {
      list.push({
        label: t('journal.badge.explored'),
        icon: 'chatbubble-ellipses-outline',
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
    if (isFavorite) {
      list.push({
        label: t('journal.badge.favorite'),
        icon: 'heart',
        variant: 'secondary',
      });
    }
    return list;
  }, [isExplored, isAnalyzed, isFavorite, t]);

  return (
    <Animated.View>
      <AnimatedPressable
        style={[styles.card, { backgroundColor: colors.backgroundCard }, animatedStyle]}
        onPress={() => onPress(dream)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={dream.title || t('journal.card.accessibility.open')}
        testID={testID}
      >
        {hasImage && (
          <View style={styles.imageContainer}>
            {/* Actual Thumbnail - only load if shouldLoadImage is true */}
            {shouldLoadImage && (
              <View style={styles.imageWrapper}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.image}
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
              </View>
            )}
          </View>
        )}
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {dream.title}
          </Text>
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={3}>
            {dream.transcript}
          </Text>
          {(dream.theme || badges.length > 0) && (
            <View style={styles.tagContainer}>
              {dream.theme && (
                <View style={[styles.tag, { backgroundColor: getTagColor(dream.theme, colors) }]}>
                  <Text style={[styles.tagText, { color: colors.textPrimary }]}>{themeLabel}</Text>
                </View>
              )}
              {badges.map((badge, i) => {
                const isAccent = badge.variant === 'accent';
                const key = badge.label || badge.icon || String(i);

                return (
                  <View
                    key={key}
                    style={[
                      styles.stateBadge,
                      {
                        backgroundColor: isAccent ? colors.accent : colors.backgroundSecondary,
                      },
                    ]}
                    accessibilityLabel={badge.label}
                    accessible={!!badge.label}
                  >
                    {badge.icon && (
                      <Ionicons
                        name={badge.icon as any}
                        size={14}
                        color={isAccent ? colors.textOnAccentSurface : colors.textPrimary}
                      />
                    )}
                    {!badge.icon && badge.label && (
                      <Text
                        style={[
                          styles.stateBadgeText,
                          {
                            color: isAccent ? colors.textOnAccentSurface : colors.textPrimary,
                          },
                        ]}
                      >
                        {badge.label}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: ThemeLayout.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    minHeight: 180,
  },
  imageContainer: {
    width: 120,
    flexShrink: 0,
    alignSelf: 'stretch',
    minHeight: 160,
    overflow: 'hidden',
    position: 'relative',
  },
  imageWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingVertical: ThemeLayout.spacing.md,
  },
  title: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    lineHeight: 20,
    marginBottom: 8,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: ThemeLayout.borderRadius.full,
  },
  tagText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  stateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: ThemeLayout.borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stateBadgeText: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
});
