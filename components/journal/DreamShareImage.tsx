import { DarkTheme } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { getDreamThemeLabel, getDreamTypeLabel } from '@/lib/dreamLabels';
import type { DreamAnalysis } from '@/lib/types';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { forwardRef, useState } from 'react';
import { Image as RNImage, StyleSheet, Text, View } from 'react-native';

interface DreamShareImageProps {
  dream: DreamAnalysis;
  t: (key: string, params?: any) => string;
}

/**
 * Fixed-size component for generating shareable dream images.
 * Designed for use with react-native-view-shot captureRef.
 * Instagram 4:5 ratio: 1080x1350px
 */
export const DreamShareImage = forwardRef<View, DreamShareImageProps>(function DreamShareImage(
  { dream, t },
  ref
) {
  const [imageError, setImageError] = useState(false);
  const noctalia = getNoctaliaDesignTokens(DarkTheme, 'dark');

  // Use imageUrl first, fallback to thumbnailUrl
  const imageSource = dream.imageUrl || dream.thumbnailUrl;
  const hasImage = !!imageSource && !imageError;

  const dreamTypeLabel = getDreamTypeLabel(dream.dreamType, t);
  const themeLabel = getDreamThemeLabel(dream.theme, t);

  // Build metadata string (max 1 line)
  const metadataParts: string[] = [];
  if (dreamTypeLabel) metadataParts.push(dreamTypeLabel);
  if (themeLabel) metadataParts.push(themeLabel);
  const metadataText = metadataParts.join(' \u2022 ');

  return (
    <View ref={ref} style={[styles.container, { backgroundColor: noctalia.screen.background }]} collapsable={false}>
      {/* Background Image or Fallback */}
      {hasImage ? (
        <Image
          source={{ uri: imageSource }}
          style={styles.backgroundImage}
          contentFit="cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <View style={[styles.fallbackBackground, { backgroundColor: noctalia.screen.background }]} />
      )}

      {/* Gradient Overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
        locations={[0, 0.4, 1]}
        style={styles.gradientOverlay}
      />

      {/* Text Content */}
      <View style={styles.textContainer}>
        {/* Title */}
        <Text style={[styles.title, { color: noctalia.text.primary }]} numberOfLines={2}>
          {dream.title}
        </Text>

        {/* Shareable Quote */}
        {dream.shareableQuote && (
          <Text style={[styles.quote, { color: noctalia.text.secondary }]} numberOfLines={3}>
            {'\u201C'}
            {dream.shareableQuote}
            {'\u201D'}
          </Text>
        )}

        {/* Metadata */}
        {metadataText && (
          <Text style={[styles.metadata, { color: noctalia.text.tertiary }]} numberOfLines={1}>
            {metadataText}
          </Text>
        )}

        <View style={styles.footerContainer}>
          <Text style={[styles.footer, { color: noctalia.text.secondary }]}>{t('journal.detail.share_image.footer')}</Text>
          <RNImage
            source={require('@/assets/images/icon-transparent.png')}
            style={styles.footerLogo}
          />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: 1080,
    height: 1350,
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  fallbackBackground: {
    ...StyleSheet.absoluteFill,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFill,
  },
  textContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 64,
    paddingBottom: 80,
    paddingTop: 40,
  },
  title: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 72,
    marginBottom: 24,
    lineHeight: 84,
  },
  quote: {
    fontFamily: Fonts.lora.regularItalic,
    fontSize: 40,
    marginBottom: 32,
    lineHeight: 52,
  },
  metadata: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 24,
    marginBottom: 32,
    textTransform: 'uppercase',
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  footer: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 34,
  },
  footerLogo: {
    width: 44,
    height: 44,
  },
});
