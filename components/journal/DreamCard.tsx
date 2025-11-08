import React, { memo, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { JournalTheme, getTagColor } from '@/constants/journalTheme';
import { DreamAnalysis } from '@/lib/types';
import { useScalePress } from '@/hooks/useJournalAnimations';
import { getThumbnailUrl, getImageConfig } from '@/lib/imageUtils';

interface DreamCardProps {
  dream: DreamAnalysis;
  onPress: () => void;
  index: number;
  shouldLoadImage?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const DreamCard = memo(function DreamCard({ dream, onPress, index, shouldLoadImage = true }: DreamCardProps) {
  const { animatedStyle, onPressIn, onPressOut } = useScalePress();
  const [imageLoaded, setImageLoaded] = useState(false);

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
        style={styles.card}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
      {dream.imageUrl && (
        <View style={styles.imageContainer}>
          {/* Placeholder */}
          {!imageLoaded && (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <View style={styles.placeholderShimmer} />
            </View>
          )}
          {/* Actual Thumbnail - only load if shouldLoadImage is true */}
          {shouldLoadImage && (
            <Animated.View entering={FadeIn.duration(300)}>
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
        <Text style={styles.title} numberOfLines={1}>
          {dream.title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {dream.interpretation || dream.transcript}
        </Text>
        {dream.theme && (
          <View style={styles.tagContainer}>
            <View style={[styles.tag, { backgroundColor: getTagColor(dream.theme) }]}>
              <Text style={styles.tagText}>{dream.theme}</Text>
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
    backgroundColor: JournalTheme.backgroundCard,
    borderRadius: JournalTheme.borderRadius.md,
    padding: JournalTheme.spacing.md,
    flexDirection: 'row',
    gap: JournalTheme.spacing.md,
  },
  imageContainer: {
    width: 80,
    height: 80,
    position: 'relative',
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: JournalTheme.borderRadius.sm,
    flexShrink: 0,
    backgroundColor: JournalTheme.backgroundSecondary,
  },
  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  placeholderShimmer: {
    width: '100%',
    height: '100%',
    backgroundColor: JournalTheme.backgroundSecondary,
    opacity: 0.6,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: JournalTheme.textPrimary,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textSecondary,
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
    borderRadius: JournalTheme.borderRadius.full,
  },
  tagText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textPrimary,
  },
});
