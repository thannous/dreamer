import { ThemeLayout, getTagColor } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';
import { useScalePress } from '@/hooks/useJournalAnimations';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamThemeLabel } from '@/lib/dreamLabels';
import { isDreamAnalyzed, isDreamExplored } from '@/lib/dreamUsage';
import { getDreamThumbnailUri, getImageConfig } from '@/lib/imageUtils';
import { DreamAnalysis } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

interface DreamCardProps {
  dream: DreamAnalysis;
  onPress: (dream: DreamAnalysis) => void;
  shouldLoadImage?: boolean;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const thumbnailUri = useMemo(() => {
    return getDreamThumbnailUri({ thumbnailUrl: dream.thumbnailUrl, imageUrl: dream.imageUrl }) ?? '';
  }, [dream.thumbnailUrl, dream.imageUrl]);

  const themeLabel = useMemo(() => getDreamThemeLabel(dream.theme, t) ?? dream.theme, [dream.theme, t]);

  // Get optimized image config for thumbnails
  const imageConfig = useMemo(() => getImageConfig('thumbnail'), []);

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

  const accessibilityLabel = useMemo(() => {
    const parts = [dream.title || t('journal.card.accessibility.open')];

    if (themeLabel) {
      parts.push(t('journal.card.accessibility.theme', { theme: themeLabel }));
    }

    badges.forEach((b) => {
      if (b.label) parts.push(b.label);
    });

    const snippet = dream.interpretation || dream.transcript;
    if (snippet) {
      parts.push(t('journal.card.accessibility.snippet', { text: snippet }));
    }

    return parts.join('. ');
  }, [dream.title, dream.interpretation, dream.transcript, themeLabel, badges, t]);

  return (
    <Animated.View>
      <AnimatedPressable
        style={[styles.card, { backgroundColor: colors.backgroundCard }, animatedStyle]}
        onPress={() => onPress(dream)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={t('journal.card.accessibility.hint')}
        testID={testID}
      >
        {dream.imageUrl && (
          <View style={styles.imageContainer}>
            {/* Actual Thumbnail - only load if shouldLoadImage is true */}
            {shouldLoadImage && (
              <View style={styles.imageWrapper}>
                <Image
                  source={{ uri: thumbnailUri }}
                  style={styles.image}
                  contentFit={imageConfig.contentFit}
                  transition={imageConfig.transition}
                  cachePolicy={imageConfig.cachePolicy}
                  priority={imageConfig.priority}
                  // Placeholder with blur hash for smoother loading
                  placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                />
              </View>
            )}
          </View>
        )}
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {dream.title}
          </Text>
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
            {dream.interpretation || dream.transcript}
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
    minHeight: 96,
  },
  imageContainer: {
    width: 96,
    flexShrink: 0,
    alignSelf: 'stretch',
    minHeight: 96,
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
