import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { ThemeLayout } from '@/constants/journalTheme';
import { DreamAnalysis } from '@/lib/types';
import { getDreamTypeLabel } from '@/lib/dreamLabels';
import { isDreamAnalyzed, isDreamExplored } from '@/lib/dreamUsage';
import { TID } from '@/lib/testIDs';
import { DreamCard } from './DreamCard';

interface JournalDesktopItemProps {
  dream: DreamAnalysis;
  shouldLoadImage: boolean;
  onPress: (dreamId: number) => void;
  isHero: boolean;
}

export const JournalDesktopItem = memo(function JournalDesktopItem({
  dream,
  shouldLoadImage,
  onPress,
  isHero,
}: JournalDesktopItemProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { formatShortDate } = useLocaleFormatting();

  const isAnalyzed = isDreamAnalyzed(dream);
  const isExplored = isDreamExplored(dream);
  const isFavorite = !!dream.isFavorite;
  const hasImage = !!dream.imageUrl && !dream.imageGenerationFailed;
  const dreamTypeLabel = dream.dreamType ? getDreamTypeLabel(dream.dreamType, t) ?? dream.dreamType : null;

  const badges = useMemo(() => {
    const b: { label?: string; icon?: string; variant?: 'accent' | 'secondary' }[] = [];
    if (isExplored) {
      b.push({
        label: t('journal.badge.explored'),
        icon: 'chatbubble-ellipses-outline',
        variant: 'accent',
      });
    }
    if (!isExplored && isAnalyzed) {
      b.push({
        label: t('journal.badge.analyzed'),
        icon: 'sparkles',
        variant: 'secondary',
      });
    }
    if (isFavorite) {
      b.push({
        label: t('journal.badge.favorite'),
        icon: 'heart',
        variant: 'secondary',
      });
    }
    return b;
  }, [isExplored, isAnalyzed, isFavorite, t]);

  const formattedDate = formatShortDate(dream.id);

  return (
    <View
      style={[
        styles.desktopCardWrapper,
        isHero && styles.desktopCardHero,
        !isHero && isFavorite && styles.desktopCardFavorite,
        !isHero && !isFavorite && isAnalyzed && styles.desktopCardAnalyzed,
        !isHero && !isFavorite && !isAnalyzed && hasImage && styles.desktopCardWithImage,
      ]}
    >
      <View style={styles.desktopMetaRow}>
        <Text style={[styles.desktopDate, { color: colors.textSecondary }] }>
          {formattedDate}
          {dreamTypeLabel ? ` • ${dreamTypeLabel}` : ''}
        </Text>
      </View>
      <DreamCard
        dream={dream}
        onPress={() => onPress(dream.id)}
        shouldLoadImage={shouldLoadImage}
        badges={badges}
        testID={TID.List.DreamItem(dream.id)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  desktopCardWrapper: {
    flex: 1,
    marginBottom: ThemeLayout.spacing.xl,
    paddingHorizontal: ThemeLayout.spacing.xs,
    minWidth: 0,
  },
  desktopCardHero: {
    flex: 2,
  },
  desktopCardFavorite: {
    flex: 1.5,
  },
  desktopCardAnalyzed: {
    flex: 1.3,
  },
  desktopCardWithImage: {
    flex: 1.2,
  },
  desktopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: ThemeLayout.spacing.xs,
  },
  desktopDate: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
});
