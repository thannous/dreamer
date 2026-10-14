import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DreamAnalysisContent } from '@/components/journal/DreamAnalysisContent';
import { JournalPageEdges } from '@/components/journal/JournalPageEdges';
import { JournalPaper } from '@/components/journal/JournalPaper';
import { JournalRunningHead, RUNNING_HEAD_GAP } from '@/components/journal/JournalRunningHead';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MarkdownText } from '@/components/ui/MarkdownText';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useDreamMedia } from '@/hooks/useDreamMedia';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamThemeLabel, getDreamTypeLabel } from '@/lib/dreamLabels';
import { getDreamAnalysisState } from '@/lib/dreamUsage';
import { getDreamImageVersion, withCacheBuster } from '@/lib/imageUtils';
import { shouldShowCompletedJournalReading } from '@/lib/journalIllustrationPolicy';
import type { DreamAnalysis } from '@/lib/types';

/**
 * Another dream's page as it lies in the journal, drawn so it can be turned to: the top of
 * its dream page as that page sets it, at the same sizes and places (its running head, its
 * name, date and details, its cover and its story under "My account", then its reading and
 * actions), so that once turned to, the dream page takes its place without anything moving.
 * It runs none of the page's work and offers none of its controls.
 */
export function JournalPagePreview({ dream, folio }: { dream: DreamAnalysis; folio?: number }) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { formatDreamDate, formatDreamTime } = useLocaleFormatting();
  const media = useDreamMedia(dream);
  const reducedMotion = useReducedMotion();
  const [introHeight, setIntroHeight] = useState<number | null>(null);

  // The dream page's own measures.
  const compactTextScale = Math.min(1.3, Math.max(1, window.fontScale));
  const titleTextScale = Math.min(1.4, Math.max(1, window.fontScale));
  const metadataTextStyle = { fontSize: 13 * compactTextScale, lineHeight: 18 * compactTextScale };
  const navigationHeight = insets.top + 76;
  const analysisState = getDreamAnalysisState(dream);
  const showReading = shouldShowCompletedJournalReading(dream.analysisStatus, analysisState.isAnalyzed);
  const typeLabel = getDreamTypeLabel(dream.dreamType, t) ?? dream.dreamType;
  const themeLabel = getDreamThemeLabel(dream.theme, t) ?? dream.theme;

  // Its cover, from the same source and cache as the dream page, at the same height.
  const imageVersion = dream.imageUrl ? getDreamImageVersion(dream) : undefined;
  const cover = dream.imageUrl?.trim() && media.imageUrl
    ? { uri: withCacheBuster(media.imageUrl, imageVersion), cacheKey: imageVersion ? `${dream.imageUrl}|${imageVersion}` : undefined }
    : null;
  const coverHeight = Math.max(96, Math.min(
    window.height * 0.62,
    window.height - navigationHeight - (introHeight ?? 180 * Math.min(window.fontScale, 1.4)) - insets.bottom - 24
  ));
  const coverTravel = Math.round(coverHeight * 0.06);
  // The page's illustration drifts with its place on screen (`useFrameParallax`); at the
  // top of the page, where a turned-to page opens, it rests here.
  const coverCenter = navigationHeight + (introHeight ?? 180 * Math.min(window.fontScale, 1.4)) + coverHeight / 2;
  const coverPlace = (coverCenter - window.height / 2) / (window.height / 2 + coverHeight / 2);
  const coverDrift = reducedMotion ? 0 : -coverTravel * Math.max(-1, Math.min(1, coverPlace));
  const ground = noctalia.screen.background;

  return (
    <View className="flex-1 overflow-hidden bg-ink" accessible={false} importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      <JournalPaper />
      <View style={{ paddingTop: navigationHeight - 64 }}>
        <View style={{ marginBottom: RUNNING_HEAD_GAP }}>
          <JournalRunningHead folio={folio} edit />
        </View>
        <View className="px-4 pb-6">
          <View onLayout={({ nativeEvent: { layout } }) => setIntroHeight(layout.height)}>
            <View className="mx-2 mb-7">
              <Text allowFontScaling={false} style={{ fontSize: 26 * titleTextScale, lineHeight: 32 * titleTextScale }}
                className="mb-2 font-display-semibold text-[26px] leading-8 text-ivory">
                {dream.title || t('journal.detail.untitled_dream')}
              </Text>
              <Text allowFontScaling={false} style={{ fontSize: 12 * compactTextScale, lineHeight: 20 * compactTextScale }}
                className="mb-5 font-sans text-[12px] leading-5 text-ivory-muted">
                {formatDreamDate(dream.id)} · {formatDreamTime(dream.id)}
              </Text>
              <View className="flex-row flex-wrap items-center gap-x-5 gap-y-2">
                {dream.dreamType && (analysisState.isAnalyzed || dream.dreamType !== 'Symbolic Dream') ? (
                  <View className="max-w-full flex-row items-center gap-1.5">
                    <IconSymbol name="moon.stars.fill" size={15} color={noctalia.accent.text} />
                    <Text allowFontScaling={false} style={metadataTextStyle}
                      className="shrink font-sans-medium text-[13px] text-ivory-muted">{typeLabel}</Text>
                  </View>
                ) : null}
                {themeLabel ? (
                  <View className="max-w-full flex-row items-center gap-1.5">
                    <IconSymbol name="paintpalette" size={15} color={noctalia.accent.text} />
                    <Text allowFontScaling={false} style={metadataTextStyle}
                      className="shrink font-sans-medium text-[13px] text-ivory-muted">{themeLabel}</Text>
                  </View>
                ) : (
                  <View className="min-h-[44px] max-w-full justify-center">
                    <View className="flex-row items-center gap-1.5 rounded-full border border-line px-3 py-1.5">
                      <IconSymbol name="paintpalette" size={14} color={noctalia.accent.text} />
                      <Text className="shrink font-sans-medium text-[13px] text-champagne-on">{t('journal.detail.theme_placeholder')}</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>

          {cover ? (
            <View className="-mx-4 mb-4">
              <View className="relative overflow-hidden bg-ink" style={{ height: coverHeight }}>
                <Image source={cover} contentFit="cover"
                  style={{ position: 'absolute', left: 0, right: 0, top: -coverTravel, bottom: -coverTravel,
                    transform: [{ translateY: coverDrift }] }} />
                <LinearGradient colors={[ground, `${ground}A6`, `${ground}3D`, `${ground}00`]} locations={[0, 0.3, 0.62, 1]}
                  style={{ position: 'absolute', top: 0, right: 0, left: 0, height: Math.min(72, coverHeight * 0.18) }} />
                <LinearGradient colors={noctalia.cover.gradient} locations={noctalia.cover.gradientLocations}
                  style={{ position: 'absolute', bottom: 0, right: 0, left: 0, height: Math.min(180, coverHeight) }} />
              </View>
            </View>
          ) : null}

          <View className="mt-2 mb-5">
            <View className="px-2 pb-4">
              <Text allowFontScaling={false} style={{ fontSize: 12 * compactTextScale, lineHeight: 18 * compactTextScale }}
                className="mb-3 font-sans-medium text-[12px] uppercase tracking-[2px] text-champagne-on">
                {t('journal.original_transcript')}
              </Text>
              <MarkdownText style={{ fontFamily: Fonts.lora.regularItalic, fontSize: 17, lineHeight: 28, color: noctalia.accent.text }}>
                {dream.transcript}
              </MarkdownText>
            </View>
          </View>

          {showReading ? <DreamAnalysisContent dream={dream} pending={false} /> : null}

          <View className="mt-5 mb-3 flex-row items-center gap-2.5">
            <Text className="font-sans-bold text-[16px] text-ivory">{t('journal.detail.zone.actions')}</Text>
          </View>
          <View className="mb-6 flex-row justify-around gap-3">
            <View className="flex-1 flex-row items-center justify-center gap-2 rounded-md border border-line-strong bg-ink-soft px-4 py-3.5">
              <IconSymbol name={dream.isFavorite ? 'heart.fill' : 'heart'} size={24} color={noctalia.accent.text} />
              <Text className="font-sans-medium text-[14px] text-ivory">
                {dream.isFavorite ? t('journal.detail.favorite.on') : t('journal.detail.favorite.off')}
              </Text>
            </View>
            <View className="flex-1 flex-row items-center justify-center gap-2 rounded-md border border-line-strong bg-ink-soft px-4 py-3.5">
              <IconSymbol name="square.and.arrow.up" size={24} color={noctalia.accent.text} />
              <Text className="font-sans-medium text-[14px] text-ivory">{t('journal.detail.share.button_default')}</Text>
            </View>
          </View>
        </View>
      </View>
      <JournalPageEdges />
    </View>
  );
}
