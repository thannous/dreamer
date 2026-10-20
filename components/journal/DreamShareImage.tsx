import type { ViewInstance } from 'react-native';
import { isPoeticDreamQuote } from '@/lib/dreamQuote';
import { useDreamMedia } from '@/hooks/useDreamMedia';
import { DarkTheme } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { getShareCardStory, type ShareCardOptions } from '@/lib/journal/shareCard';
import type { DreamAnalysis } from '@/lib/types';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { forwardRef, useEffect, useState } from 'react';
import { Image as RNImage, StyleSheet, Text, View } from 'react-native';

import { SEAL_EMBLEMS, SEAL_GOLD } from './story/sealEmblems';

interface DreamShareImageProps {
  dream: DreamAnalysis;
  resolvedMedia?: { imageUrl: string; thumbnailUrl?: string };
  onMediaReady?: (source: string, ready: boolean) => void;
  /** What the card shows; « Créé par Noctalia Dream » is always on it. */
  options?: ShareCardOptions;
  /** The dream's date as the card writes it. */
  date?: string;
  t: (key: string, params?: any) => string;
}

const DEFAULT_OPTIONS: ShareCardOptions = { painting: true, title: true, date: false, text: 'quote' };
/** How long the card waits for its small images (the logo, the emblem) before it is drawn without them. */
const MARKS_WAIT_MS = 1000;

/**
 * Fixed-size component for generating shareable dream images.
 * Designed for use with react-native-view-shot captureRef.
 * Instagram 4:5 ratio: 1080x1350px
 */
export const DreamShareImage = forwardRef<ViewInstance, DreamShareImageProps>(function DreamShareImage(
  { dream, t, resolvedMedia, onMediaReady, options = DEFAULT_OPTIONS, date },
  ref
) {
  const requestedMedia = useDreamMedia(resolvedMedia ? undefined : dream);
  const media = resolvedMedia ?? requestedMedia;
  // What became of the picture: shown, or left out because it failed or did not show in time.
  const [settled, setSettled] = useState<{ source: string; shown: boolean }>();
  const noctalia = getNoctaliaDesignTokens(DarkTheme, 'dark');

  // Use imageUrl first, fallback to thumbnailUrl
  const imageSource = options.painting ? media.imageUrl || media.thumbnailUrl || '' : '';
  const imageSettled = settled?.source === imageSource ? settled : undefined;
  const hasImage = !!imageSource && imageSettled?.shown !== false;
  const settle = (shown: boolean) => setSettled((current) =>
    current?.source === imageSource && current.shown === shown ? current : { source: imageSource, shown });
  useEffect(() => {
    if (!imageSource || !onMediaReady || imageSettled) return;
    const timer = setTimeout(() => setSettled({ source: imageSource, shown: false }), 10000);
    return () => clearTimeout(timer);
  }, [imageSource, onMediaReady, imageSettled]);

  // Without its painting the card rests on the night, under the emblem of the dream's seal.
  const emblem = !hasImage && dream.theme && dream.theme in SEAL_EMBLEMS ? SEAL_EMBLEMS[dream.theme] : null;
  // The card's logo and the mark it rests on without a painting are images too, loading on
  // their own; they are waited for, never for long. A ground that comes in late, under a
  // picture that failed, is waited for anew.
  const [marks, setMarks] = useState<{ logo?: true; ground?: true; waited?: true; onGround: boolean }>(
    { onGround: !hasImage });
  if (marks.onGround !== !hasImage) setMarks({ ...marks, onGround: !hasImage, waited: undefined });
  const marksDrawn = Boolean(marks.waited || (marks.logo && (hasImage || marks.ground)));
  useEffect(() => {
    if (!onMediaReady || marksDrawn) return;
    const timer = setTimeout(() => setMarks((current) => ({ ...current, waited: true })), MARKS_WAIT_MS);
    return () => clearTimeout(timer);
  }, [onMediaReady, marksDrawn]);
  const markDrawn = (mark: 'logo' | 'ground') => setMarks((current) => (current[mark] ? current : { ...current, [mark]: true }));
  // The card is ready once drawn as it will be captured: with its picture, or without one it
  // has none of or could not show.
  useEffect(() => {
    if (!onMediaReady || !marksDrawn) return;
    if (!imageSource) onMediaReady('', false);
    else if (imageSettled) onMediaReady(imageSource, imageSettled.shown);
  }, [imageSource, imageSettled, marksDrawn, onMediaReady]);

  const dateLine = options.date ? date?.trim() : undefined;
  const title = options.title ? dream.title?.trim() : undefined;
  const quote = options.text === 'quote' ? dream.shareableQuote?.trim() : undefined;
  const story = options.text === 'story' && dream.transcript?.trim() ? getShareCardStory(dream.transcript) : undefined;

  return (
    <View ref={ref} style={[styles.container, { backgroundColor: noctalia.screen.background }]} collapsable={false}>
      {hasImage ? (
        <Image
          source={{ uri: imageSource }}
          style={styles.backgroundImage}
          contentFit="cover"
          onDisplay={() => settle(true)}
          onError={() => settle(false)}
        />
      ) : (
        <View style={[styles.ground, { backgroundColor: noctalia.screen.background }]}>
          <LinearGradient
            colors={['rgba(234,212,180,0.22)', 'rgba(234,212,180,0.07)', 'transparent']}
            locations={[0, 0.4, 0.75]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.medallion, { borderColor: 'rgba(234,212,180,0.4)', backgroundColor: 'rgba(234,212,180,0.04)' }]}>
            <View style={[styles.medallionInner, { borderColor: 'rgba(234,212,180,0.22)', backgroundColor: 'rgba(234,212,180,0.05)' }]}>
              <RNImage
                source={emblem ?? require('@/assets/images/icon-transparent.png')}
                style={emblem ? [styles.emblem, { tintColor: SEAL_GOLD }] : styles.groundLogo}
                onLoad={() => markDrawn('ground')}
                onError={() => markDrawn('ground')}
              />
            </View>
          </View>
        </View>
      )}

      {/* The words rest on the painting's darkened foot, deeper under a told story. */}
      <LinearGradient
        colors={story
          ? ['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.9)']
          : ['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
        locations={story ? [0, 0.3, 1] : [0, 0.4, 1]}
        style={styles.gradientOverlay}
      />

      <View style={styles.textContainer}>
        {dateLine ? (
          <Text style={[styles.date, { color: noctalia.accent.base }]} numberOfLines={1}>
            {dateLine}
          </Text>
        ) : null}

        {title ? (
          <Text style={[styles.title, { color: noctalia.text.primary }]} numberOfLines={story ? 2 : 3}>
            {title}
          </Text>
        ) : null}

        {/* An original poetic line, identified separately from the dream transcript. */}
        {quote ? (
          <View>
            <Text style={[styles.quote, { color: noctalia.text.secondary }]} numberOfLines={4}>
              “{quote}”
            </Text>
            {isPoeticDreamQuote(dream) ? (
              <Text style={[styles.quoteAttribution, { color: noctalia.text.secondary }]}>
                {t('journal.detail.quote_attribution')}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* The dream in the dreamer's own words, only when they choose to share it. */}
        {story ? (
          <Text style={[styles.story, { color: noctalia.text.secondary }]} numberOfLines={6}>
            {story}
          </Text>
        ) : null}

        <View style={styles.footerContainer}>
          <Text style={[styles.footer, { color: noctalia.text.secondary }]}>{t('journal.detail.share_image.footer')}</Text>
          <RNImage
            source={require('@/assets/images/icon-transparent.png')}
            style={styles.footerLogo}
            onLoad={() => markDrawn('logo')}
            onError={() => markDrawn('logo')}
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
  ground: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
  },
  medallion: {
    marginTop: 150,
    width: 460,
    height: 460,
    borderRadius: 230,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionInner: {
    width: 368,
    height: 368,
    borderRadius: 184,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblem: {
    width: 240,
    height: 240,
  },
  groundLogo: {
    width: 180,
    height: 180,
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
  date: {
    fontFamily: Fonts.outfit.medium,
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: 4,
    marginBottom: 20,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 76,
    marginBottom: 28,
    lineHeight: 86,
  },
  quote: {
    fontFamily: Fonts.lora.regularItalic,
    fontSize: 40,
    marginBottom: 32,
    lineHeight: 52,
  },
  quoteAttribution: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 24,
    lineHeight: 32,
    marginBottom: 24,
  },
  story: {
    fontFamily: Fonts.lora.regular,
    fontSize: 34,
    lineHeight: 50,
    marginBottom: 40,
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  footer: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 34,
  },
  footerLogo: {
    width: 44,
    height: 44,
  },
});
