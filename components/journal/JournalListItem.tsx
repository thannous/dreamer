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
import { TimelineIndicator } from './TimelineIndicator';

interface JournalListItemProps {
  dream: DreamAnalysis;
  isLast: boolean;
  shouldLoadImage: boolean;
  onPress: (dreamId: number) => void;
}

export const JournalListItem = memo(function JournalListItem({
  dream,
  isLast,
  shouldLoadImage,
  onPress,
}: JournalListItemProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { formatShortDate } = useLocaleFormatting();

  const isAnalyzed = isDreamAnalyzed(dream);
  const isExplored = isDreamExplored(dream);
  const isFavorite = !!dream.isFavorite;
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

  // Format date using memoized formatShortDate from hook
  const formattedDate = formatShortDate(dream.id);

  return (
    <View style={styles.timelineItem}>
      {/* Timeline indicator column */}
      <View style={styles.timelineColumn}>
        <TimelineIndicator dreamType={dream.dreamType} />
        {/* Timeline line - don't show for last item */}
        {!isLast && <View style={[styles.timelineLine, { backgroundColor: colors.timeline }]} />}
      </View>

      {/* Content column */}
      <View style={styles.contentColumn}>
        <Text style={[styles.date, { color: colors.textSecondary }]}>
          {formattedDate}
          {dreamTypeLabel ? ` • ${dreamTypeLabel}` : ''}
        </Text>
        <DreamCard
          dream={dream}
          onPress={() => onPress(dream.id)}
          shouldLoadImage={shouldLoadImage}
          badges={badges}
          testID={TID.List.DreamItem(dream.id)}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  timelineItem: {
    flexDirection: 'row',
    marginBottom: ThemeLayout.spacing.lg,
  },
  timelineColumn: {
    width: 36,
    alignItems: 'center',
    marginRight: ThemeLayout.spacing.md,
  },
  timelineLine: {
    flex: 1,
    width: ThemeLayout.timelineLineWidth,
    marginTop: 4,
  },
  contentColumn: {
    flex: 1,
  },
  date: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    marginBottom: 8,
    marginLeft: 4,
  },
});
