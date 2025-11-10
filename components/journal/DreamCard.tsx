import React, { memo, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { ThemeLayout, getTagColor } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';
import { DreamAnalysis } from '@/lib/types';
import { useScalePress } from '@/hooks/useJournalAnimations';
import { getThumbnailUrl, getImageConfig } from '@/lib/imageUtils';
import { useTranslation } from '@/hooks/useTranslation';

interface DreamCardProps {
  dream: DreamAnalysis;
  onPress: () => void;
  index: number;
  shouldLoadImage?: boolean;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const DreamCard = memo(function DreamCard({
  dream,
  onPress,
  index,
  shouldLoadImage = true,
  testID,
}: DreamCardProps) {
  const { colors } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = useScalePress();
  const [imageLoaded, setImageLoaded] = useState(false);
  const { t } = useTranslation();

  // Use thumbnail URL for list view, fallback to generating one from full URL
  const thumbnailUri = useMemo(() => {
    return dream.thumbnailUrl || getThumbnailUrl(dream.imageUrl);
  }, [dream.thumbnailUrl, dream.imageUrl]);

  // Get optimized image config for thumbnails
  const imageConfig = useMemo(() => getImageConfig('thumbnail'), []);

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 50).springify().damping(20)}
      style={animatedStyle}
    >
      <AnimatedPressable
        style={[styles.card, { backgroundColor: colors.backgroundCard }]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={dream.title || t('journal.card.accessibility.open')}
        testID={testID}
      >
        {dream.imageUrl && (
          <View style={styles.imageContainer}>
            {/* Placeholder */}
            {!imageLoaded && (
              <View style={[styles.imagePlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                <View style={[styles.placeholderShimmer, { backgroundColor: colors.backgroundSecondary }]} />
              </View>
            )}
            {/* Actual Thumbnail - only load if shouldLoadImage is true */}
            {shouldLoadImage && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.imageWrapper}>
                <Image
                  source={{ uri: thumbnailUri }}
                  style={styles.image}
                  contentFit={imageConfig.contentFit}
                  transition={imageConfig.transition}
                  cachePolicy={imageConfig.cachePolicy}
                  priority={imageConfig.priority}
                  onLoad={() => setImageLoaded(true)}
                  // Placeholder with blur hash for smoother loading
                  placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                />
              </Animated.View>
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
          {dream.theme && (
            <View style={styles.tagContainer}>
              <View style={[styles.tag, { backgroundColor: getTagColor(dream.theme, colors) }]}>
                <Text style={[styles.tagText, { color: colors.textPrimary }]}>{dream.theme}</Text>
              </View>
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
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  placeholderShimmer: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
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
});
