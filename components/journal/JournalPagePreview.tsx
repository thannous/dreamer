import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DreamAnalysisContent } from '@/components/journal/DreamAnalysisContent';
import { JournalCoverPlate } from '@/components/journal/JournalCoverPlate';
import { JournalEditLink } from '@/components/journal/JournalEditLink';
import { JournalFolio } from '@/components/journal/JournalFolio';
import { JournalPageEdges } from '@/components/journal/JournalPageEdges';
import { JournalPaper } from '@/components/journal/JournalPaper';
import { JournalRunningHead, RUNNING_HEAD_GAP } from '@/components/journal/JournalRunningHead';
import { DecorativeCopy } from '@/components/journal/DecorativeCopy';
import { SavedDreamMoment } from '@/components/journal/SavedDreamMoment';
import { SEAL_EMBLEMS, SEAL_NAME_LINES } from '@/components/journal/story/sealMarks';
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
 * name, date and details, on the plate of its illustration when it has one; once read, its
 * seal bearing those details and its reading; its story under "My account", then its
 * actions), so that once turned to, the dream page takes its place without anything moving.
 * It runs none of the page's work and offers none of its controls.
 */
export function JournalPagePreview({ dream, folio }: { dream: DreamAnalysis; folio?: number }) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { formatDreamDate, formatDreamTime, formatDreamStamp } = useLocaleFormatting();
  const media = useDreamMedia(dream);
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

  // Its cover, from the same source and cache as the dream page, as the plate it opens on;
  // at the top of the page, where a turned-to page opens, it rests undrifted.
  const imageVersion = dream.imageUrl ? getDreamImageVersion(dream) : undefined;
  const cover = dream.imageUrl?.trim() && media.imageUrl
    ? { uri: withCacheBuster(media.imageUrl, imageVersion), cacheKey: imageVersion ? `${dream.imageUrl}|${imageVersion}` : undefined }
    : null;
  const coverTravel = Math.round(window.height * 0.06);

  const head = <JournalRunningHead />;
  // A read dream's seal heads its reading, between its name and its story, and carries its details.
  const sealMark = showReading && dream.theme && dream.theme in SEAL_EMBLEMS ? {
    theme: dream.theme,
    legend: [dream.dreamType && (analysisState.isAnalyzed || dream.dreamType !== 'Symbolic Dream') ? typeLabel : null, themeLabel]
      .filter(Boolean).join(' · '),
  } : null;
  const heading = (
    <View onLayout={({ nativeEvent: { layout } }) => setIntroHeight(layout.height)}>
      <View className={`mx-2 ${showReading ? 'mb-1' : 'mb-7'}`}>
        <View style={showReading && !cover ? { minHeight: SEAL_NAME_LINES * 32 * titleTextScale + 8 } : undefined}>
          <Text allowFontScaling={false} style={{ fontSize: 26 * titleTextScale, lineHeight: 32 * titleTextScale }}
            className="mb-2 font-display-semibold text-[26px] leading-8 text-ivory">
            {dream.title || t('journal.detail.untitled_dream')}
          </Text>
        </View>
        <View className={`${showReading ? 'mb-2' : 'mb-5'} flex-row items-center ${showReading ? 'justify-end' : 'justify-between'} gap-3`}>
          {showReading ? null : (
            <Text allowFontScaling={false} style={{ fontSize: 12 * compactTextScale, lineHeight: 20 * compactTextScale }}
              className="shrink font-sans text-[12px] leading-5 text-ivory-muted">
              {formatDreamDate(dream.id)} · {formatDreamTime(dream.id)}
            </Text>
          )}
          <JournalEditLink lineHeight={20 * compactTextScale} />
        </View>
        {sealMark ? null : <View className="flex-row flex-wrap items-center gap-x-5 gap-y-2">
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
        </View>}
      </View>
    </View>
  );

  return (
    <DecorativeCopy>
      <View className="flex-1 overflow-hidden bg-ink" accessible={false} importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden>
        <JournalPaper />
        {cover ? (
          <JournalCoverPlate height={window.height} titleHeight={introHeight} head={head}
            picture={<Image source={cover} contentFit="cover"
              style={{ position: 'absolute', left: 0, right: 0, top: -coverTravel, bottom: -coverTravel }} />}>
            {heading}
          </JournalCoverPlate>
        ) : null}
        <View style={{ paddingTop: cover ? 0 : navigationHeight - 64 }}>
          {cover ? null : <View style={{ marginBottom: RUNNING_HEAD_GAP }}>{head}</View>}
          <View className="px-4 pb-6">
            {cover ? null : heading}
            {showReading ? (
              <>
                <SavedDreamMoment phase="read" still wordsLine={false} sealing={sealMark ? { mark: sealMark, settled: true } : null}
                  date={formatDreamStamp(dream.id)} />
                <DreamAnalysisContent dream={dream} pending={false} />
              </>
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
            <JournalFolio folio={folio} className="mt-8" />
          </View>
        </View>
        <JournalPageEdges />
      </View>
    </DecorativeCopy>
  );
}
