import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DreamAnalysisContent } from '@/components/journal/DreamAnalysisContent';
import { BOOK_MEASURE, BookOrnament, BookProse, BookSectionMark, BookStar } from '@/components/journal/JournalBook';
import { JournalCoverPlate } from '@/components/journal/JournalCoverPlate';
import { JournalEditLink } from '@/components/journal/JournalEditLink';
import { JournalSealShare } from '@/components/journal/JournalSealShare';
import { JournalFolio } from '@/components/journal/JournalFolio';
import { JournalPageEdges } from '@/components/journal/JournalPageEdges';
import { JournalPaper } from '@/components/journal/JournalPaper';
import { JournalRunningHead, RUNNING_HEAD_GAP } from '@/components/journal/JournalRunningHead';
import { DecorativeCopy } from '@/components/journal/DecorativeCopy';
import { SavedDreamMoment } from '@/components/journal/SavedDreamMoment';
import { SEAL_EMBLEMS, SEAL_NAME_LINES } from '@/components/journal/story/sealMarks';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PaintingAtRest } from '@/components/ui/PaintingTilt';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useDreamCoverPlaceholder } from '@/hooks/useDreamCoverPlaceholder';
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
 * seal bearing those details and its reading; its story under "My story", then its
 * actions), so that once turned to, the dream page takes its place without anything moving.
 * It runs none of the page's work and offers none of its controls.
 */
export function JournalPagePreview({ dream, folio, height }: { dream: DreamAnalysis; folio?: number; height: number }) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { formatDreamDate, formatDreamTime, formatDreamStamp } = useLocaleFormatting();
  const media = useDreamMedia(dream);
  const coverPlaceholder = useDreamCoverPlaceholder(dream);
  const [introHeight, setIntroHeight] = useState<number | null>(null);

  // The dream page's own measures.
  const compactTextScale = Math.min(1.3, Math.max(1, window.fontScale));
  const titleTextScale = Math.min(1.4, Math.max(1, window.fontScale));
  const metadataTextStyle = { fontSize: 14 * compactTextScale, lineHeight: 20 * compactTextScale };
  const navigationHeight = insets.top + 76;
  const analysisState = getDreamAnalysisState(dream);
  const showReading = shouldShowCompletedJournalReading(dream.analysisStatus, analysisState.isAnalyzed);
  const typeLabel = getDreamTypeLabel(dream.dreamType, t) ?? dream.dreamType;
  const themeLabel = getDreamThemeLabel(dream.theme, t) ?? dream.theme;
  const typeShown = Boolean(dream.dreamType && (analysisState.isAnalyzed || dream.dreamType !== 'Symbolic Dream'));

  // An illustrated dream opens on its plate, as its page does, unless its picture cannot be
  // had; the picture, from the same source and cache as the dream page, shows once resolved,
  // over the painting its card holds. At the top of the page, where a turned-to page opens, it
  // rests undrifted, enlarged as the page's own painting is for its tilt.
  const plated = Boolean(dream.imageUrl?.trim()) && !(media.error && !media.imageUrl);
  const imageVersion = dream.imageUrl ? getDreamImageVersion(dream) : undefined;
  const cover = plated && media.imageUrl
    ? { uri: withCacheBuster(media.imageUrl, imageVersion), cacheKey: imageVersion ? `${dream.imageUrl}|${imageVersion}` : undefined }
    : null;
  const coverTravel = Math.round(height * 0.06);

  const head = <JournalRunningHead label={plated ? undefined : t('nav.sidebar_tagline')} />;
  // A read dream's seal heads its reading, between its name and its story, and carries its details.
  const sealMark = showReading && dream.theme && dream.theme in SEAL_EMBLEMS ? {
    theme: dream.theme,
    legend: [typeShown ? typeLabel : null, themeLabel]
      .filter(Boolean).join(' · '),
  } : null;
  const heading = (
    <View className="w-full self-center" style={{ maxWidth: BOOK_MEASURE - 32 }}
      onLayout={({ nativeEvent: { layout } }) => setIntroHeight(layout.height)}>
      <View className={`mx-2 ${showReading ? 'mb-1' : 'mb-7'}`}>
        <View style={showReading && !plated ? { minHeight: SEAL_NAME_LINES * 32 * titleTextScale + 8 } : undefined}>
          <Text allowFontScaling={false} style={{ fontSize: 26 * titleTextScale, lineHeight: 32 * titleTextScale }}
            className="mb-2 font-display-semibold text-[26px] leading-8 text-ivory">
            {dream.title || t('journal.detail.untitled_dream')}
          </Text>
        </View>
        {showReading ? null : (
          <View className="mb-5 flex-row items-center justify-between gap-3">
            <Text allowFontScaling={false} style={{ fontSize: 13 * compactTextScale, lineHeight: 20 * compactTextScale }}
              className="shrink font-serif-italic text-[13px] leading-5 text-ivory-muted">
              {formatDreamDate(dream.id)} · {formatDreamTime(dream.id)}
            </Text>
          </View>
        )}
        {sealMark || (!typeShown && !themeLabel) ? null : <View className="flex-row flex-wrap items-center gap-x-2.5 gap-y-2">
          {typeShown ? (
            <Text allowFontScaling={false} style={metadataTextStyle}
              className="max-w-full shrink font-serif-italic text-[14px] text-ivory-muted">{typeLabel}</Text>
          ) : null}
          {typeShown && themeLabel ? <BookStar size={3} opacity={0.7} /> : null}
          {themeLabel ? (
            <Text allowFontScaling={false} style={metadataTextStyle}
              className="max-w-full shrink font-serif-italic text-[14px] text-ivory-muted">{themeLabel}</Text>
          ) : null}
        </View>}
      </View>
    </View>
  );

  return (
    <DecorativeCopy>
      <View className="flex-1 overflow-hidden bg-ink" accessible={false} importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden {...(Platform.OS === 'web' ? { 'aria-hidden': true, inert: true } : {})}>
        <JournalPaper />
        {/* The plate fills the page at least: what follows it on the dream page lies below. */}
        {plated ? (
          <JournalCoverPlate height={height} titleHeight={introHeight} head={head}
            picture={(
              <View style={{ position: 'absolute', left: 0, right: 0, top: -coverTravel, bottom: -coverTravel }}>
                <PaintingAtRest>
                  {coverPlaceholder ? (
                    <Image source={coverPlaceholder} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
                  ) : null}
                  {cover ? <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                </PaintingAtRest>
              </View>
            )}>
            {heading}
          </JournalCoverPlate>
        ) : (
          <View style={{ paddingTop: navigationHeight - 64 }}>
            <View style={{ marginBottom: RUNNING_HEAD_GAP }}>{head}</View>
            <View className="w-full self-center px-4 pb-6" style={{ maxWidth: BOOK_MEASURE }}>
              {heading}
              {showReading ? (
                <>
                  <SavedDreamMoment phase="read" still wordsLine={false} sealing={sealMark ? { mark: sealMark, settled: true } : null}
                    date={formatDreamStamp(dream.id)} />
                  <JournalSealShare />
                  <DreamAnalysisContent dream={dream} pending={false} />
                </>
              ) : null}

              <View className="mt-2 mb-5">
                <View className="px-2 pb-4">
                  <BookSectionMark label={t('journal.original_transcript')} scale={compactTextScale} className="mb-5" />
                  <BookProse text={dream.transcript} />
                </View>
              </View>

              <BookOrnament className="mt-3 mb-4" />
              <View className="mb-1 flex-row flex-wrap items-center justify-center">
                <View className="min-h-[44px] flex-row items-center justify-center gap-2 px-4">
                  <IconSymbol name={dream.isFavorite ? 'heart.fill' : 'heart'} size={18} color={noctalia.accent.text} />
                  <Text className="font-serif-italic text-[16px] text-ivory">
                    {dream.isFavorite ? t('journal.detail.favorite.on') : t('journal.detail.favorite.off')}
                  </Text>
                </View>
                <View className="h-5 w-px bg-line" />
                <View className="min-h-[44px] flex-row items-center justify-center gap-2 px-4">
                  <IconSymbol name="square.and.arrow.up" size={18} color={noctalia.accent.text} />
                  <Text className="font-serif-italic text-[16px] text-ivory">{t('journal.detail.share.button_default')}</Text>
                </View>
              </View>
              <View className="flex-row items-center justify-center self-center">
                <JournalEditLink />
                <View className="h-5 w-px bg-line" />
                <View className="min-h-[44px] flex-row items-center justify-center gap-1.5 px-3">
                  <IconSymbol name="trash" size={16} color={noctalia.status.danger.icon} />
                  <Text className="font-serif-italic text-[15px] text-danger-on">{t('journal.menu.delete')}</Text>
                </View>
              </View>
              <JournalFolio folio={folio} className="mt-8" />
            </View>
          </View>
        )}
        <JournalPageEdges />
      </View>
    </DecorativeCopy>
  );
}
