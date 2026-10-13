import React, { useMemo } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JournalPageEdges } from '@/components/journal/JournalPageEdges';
import { JournalPaper } from '@/components/journal/JournalPaper';
import { JournalRunningHead, RUNNING_HEAD_GAP } from '@/components/journal/JournalRunningHead';
import { Fonts } from '@/constants/theme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useTranslation } from '@/hooks/useTranslation';
import type { DreamAnalysis } from '@/lib/types';

/**
 * Another dream's page as it lies in the journal, drawn lightly so it can be turned to:
 * its paper, running head and edges, then its title and date, its illustration if it has
 * one and the start of its story in the journal's ink, where the dream page itself sets
 * them. It runs none of the page's work; the real page takes its place once it has been
 * turned to.
 */
export function JournalPagePreview({ dream, folio }: { dream: DreamAnalysis; folio?: number }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { formatDreamDate, formatDreamTime } = useLocaleFormatting();
  const artwork = dream.imageUrl?.trim() || dream.thumbnailUrl?.trim();

  return (
    <View className="flex-1 overflow-hidden bg-ink" accessible={false} importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      <JournalPaper />
      <View style={{ paddingTop: insets.top + 12 }}>
        <View style={{ marginBottom: RUNNING_HEAD_GAP }}>
          <JournalRunningHead folio={folio} />
        </View>
        <View className="px-6">
          <Text numberOfLines={3} className="mb-2 font-display-semibold text-[26px] leading-8 text-ivory">
            {dream.title || t('journal.detail.untitled_dream')}
          </Text>
          <Text className="mb-7 font-sans text-[12px] leading-5 text-ivory-muted">
            {formatDreamDate(dream.id)} · {formatDreamTime(dream.id)}
          </Text>
        </View>
        {artwork ? (
          <Image source={{ uri: artwork }} contentFit="cover" style={{ width: '100%', height: height * 0.46, marginBottom: 28 }} />
        ) : null}
        <View className="px-6">
          <Text className="mb-3 font-sans-medium text-[12px] uppercase tracking-[2px] text-champagne-on">
            {t('journal.original_transcript')}
          </Text>
          <Text numberOfLines={12}
            style={{ fontFamily: Fonts.lora.regularItalic, fontSize: 17, lineHeight: 28, color: noctalia.accent.text }}>
            {dream.transcript}
          </Text>
        </View>
      </View>
      <JournalPageEdges />
    </View>
  );
}
