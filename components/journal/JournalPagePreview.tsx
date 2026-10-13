import React, { useMemo } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JournalPageEdges } from '@/components/journal/JournalPageEdges';
import { JournalPaper } from '@/components/journal/JournalPaper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useTranslation } from '@/hooks/useTranslation';
import type { DreamAnalysis } from '@/lib/types';

/**
 * Another dream's page as it lies in the journal, drawn lightly so it can be turned to:
 * its paper and edges, its illustration if it has one, its title, date and the start of
 * its story in the journal's ink, where the dream page itself sets them. It runs none of
 * the page's work; the real page takes its place once it has been turned to.
 */
export function JournalPagePreview({ dream }: { dream: DreamAnalysis }) {
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
      {artwork ? (
        <Image source={{ uri: artwork }} contentFit="cover" style={{ width: '100%', height: height * 0.46 }} />
      ) : null}
      <View className="absolute left-0 right-0 top-0 flex-row items-center gap-2 px-6" style={{ paddingTop: insets.top + 22 }}>
        <IconSymbol name="chevron.left" size={22} color={noctalia.text.primary} />
        <Text className="font-sans-medium text-[13px] text-ivory">{t('nav.journal')}</Text>
      </View>
      <View className="px-6" style={{ paddingTop: artwork ? 20 : insets.top + 76 }}>
        <Text numberOfLines={3} className="mb-2 font-display-semibold text-[26px] leading-8 text-ivory">
          {dream.title || t('journal.detail.untitled_dream')}
        </Text>
        <Text className="mb-6 font-sans text-[12px] leading-5 text-ivory-muted">
          {formatDreamDate(dream.id)} · {formatDreamTime(dream.id)}
        </Text>
        <Text className="mb-3 font-sans-medium text-[12px] uppercase tracking-[2px] text-champagne-on">
          {t('journal.original_transcript')}
        </Text>
        <Text numberOfLines={12}
          style={{ fontFamily: Fonts.lora.regularItalic, fontSize: 17, lineHeight: 28, color: noctalia.accent.text }}>
          {dream.transcript}
        </Text>
      </View>
      <JournalPageEdges />
    </View>
  );
}
