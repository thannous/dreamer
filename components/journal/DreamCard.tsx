import { ThemeLayout, getTagColor } from '@/constants/journalTheme';
import { getGlassCardBackground, GLASS_CARD_BORDER_WIDTH } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useScalePress } from '@/hooks/useJournalAnimations';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamThemeLabel } from '@/lib/dreamLabels';
import { isDreamAnalyzed, isDreamExplored } from '@/lib/dreamUsage';
import { getDreamImageVersion, getDreamThumbnailUri, getImageConfig, withCacheBuster } from '@/lib/imageUtils';
import { DreamAnalysis } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

export type DreamCardVariant = 'standard' | 'featured';

interface DreamCardProps {
  dream: DreamAnalysis;
  onPress: (dreamId: number) => void;
  shouldLoadImage?: boolean;
  isScrolling?: boolean;
  testID?: string;
  /** Date string to display as an overline above the title */
  dateLabel?: string;
  /** Card variant: 'featured' for first card, 'standard' for rest */
  variant?: DreamCardVariant;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const failedThumbnailUris = new Set<string>();

export const DreamCard = memo(function DreamCard({
  dream,
  onPress,
  shouldLoadImage = true,
  isScrolling = false,
  testID,
  dateLabel,
  variant = 'standard',
}: DreamCardProps) {
  const { colors, shadows, mode } = useTheme();
  const cardBg = getGlassCardBackground(colors.backgroundCard, mode);
  const { animatedStyle, onPressIn, onPressOut } = useScalePress();
  const { t } = useTranslation();
  const handlePress = useCallback(() => {
    onPress(dream.id);
  }, [onPress, dream.id]);

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
    // Don't add favorite badge when using vertical layout — we show the heart overlay instead
    if (isFavorite && !hasImage) {
      list.push({
        label: t('journal.badge.favorite'),
        icon: 'heart',
        variant: 'secondary',
      });
    }
    return list;
  }, [isExplored, isAnalyzed, isFavorite, hasImage, t]);

  const imageHeight = isFeatured ? 200 : 160;

  // Vertical layout: image on top (cards with images)
  if (hasImage) {
    return (
      <Animated.View>
        <AnimatedPressable
          style={[styles.cardVertical, shadows.sm, { backgroundColor: cardBg, borderColor: colors.divider, borderWidth: GLASS_CARD_BORDER_WIDTH }, animatedStyle]}
          onPress={handlePress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          accessibilityLabel={dream.title || t('journal.card.accessibility.open')}
          testID={testID}
        >
          <View style={[styles.verticalImageContainer, { height: imageHeight }]}>
            {shouldLoadImage && (
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
            )}
            {/* Heart overlay for favorited dreams */}
            {isFavorite && (
              <View style={styles.favoriteOverlay}>
                <Ionicons name="heart" size={18} color="#fff" />
              </View>
            )}
          </View>
          <View style={styles.verticalContent}>
            {dateLabel && (
              <Text style={[styles.dateOverline, { color: colors.textTertiary }]}>
                {dateLabel}
              </Text>
            )}
            <Text
              style={[
                isFeatured ? styles.titleFeatured : styles.title,
                { color: colors.textPrimary },
              ]}
              numberOfLines={isFeatured ? 2 : 1}
            >
              {dream.title}
            </Text>
            {isFeatured && dream.shareableQuote ? (
              <Text style={[styles.shareableQuote, { color: colors.textSecondary }]} numberOfLines={2}>
                {dream.shareableQuote}
              </Text>
            ) : (
              <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
                {dream.transcript}
              </Text>
            )}
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
  }

  // Horizontal layout: text-only cards (no image)
  return (
    <Animated.View>
      <AnimatedPressable
        style={[styles.card, shadows.sm, { backgroundColor: cardBg, borderColor: colors.divider, borderWidth: GLASS_CARD_BORDER_WIDTH }, animatedStyle]}
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={dream.title || t('journal.card.accessibility.open')}
        testID={testID}
      >
        <View style={styles.content}>
          {dateLabel && (
            <Text style={[styles.dateOverline, { color: colors.textTertiary }]}>
              {dateLabel}
            </Text>
          )}
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
}, (prev, next) => {
  if (prev === next) return true;
  if (prev.onPress !== next.onPress) return false;
  if (prev.isScrolling !== next.isScrolling) return false;
  if (prev.shouldLoadImage !== next.shouldLoadImage) return false;
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
    && prevHasModelMessage === nextHasModelMessage
  );
});

const styles = StyleSheet.create({
  // Vertical layout card (with image on top)
  cardVertical: {
    borderRadius: ThemeLayout.borderRadius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  verticalImageContainer: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  favoriteOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    borderCurve: 'continuous',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalContent: {
    padding: 16,
    gap: 8,
  },
  dateOverline: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_500Medium',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  // Horizontal layout card (text-only, no image)
  card: {
    borderRadius: ThemeLayout.borderRadius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Lora_700Bold',
  },
  titleFeatured: {
    fontSize: 20,
    fontFamily: 'Lora_700Bold',
  },
  shareableQuote: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  description: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    lineHeight: 20,
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
    borderCurve: 'continuous',
  },
  tagText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  stateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: ThemeLayout.borderRadius.full,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
  },
  stateBadgeText: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
});
