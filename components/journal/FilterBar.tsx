import { ThemeLayout } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface FilterBarProps {
  onThemePress: () => void;
  onDatePress: () => void;
  onFavoritesPress: () => void;
  onAnalyzedPress: () => void;
  onExploredPress: () => void;
  onClearPress: () => void;
  activeFilters: {
    theme: boolean;
    date: boolean;
    favorites: boolean;
    analyzed: boolean;
    explored: boolean;
  };
  dateRange?: {
    start: Date | null;
    end: Date | null;
  };
  selectedTheme?: string | null;
  themeButtonTestID?: string;
  dateButtonTestID?: string;
  favoritesButtonTestID?: string;
  analyzedButtonTestID?: string;
  exploredButtonTestID?: string;
  clearButtonTestID?: string;
}

function CategoryIcon({ size = 16, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 7c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z"
        fill={color}
      />
    </Svg>
  );
}

function AnalyzedIcon({ size = 16, color = '#FFFFFF' }) {
  return <Ionicons name="sparkles" size={size} color={color} />;
}

function ExploredIcon({ size = 16, color = '#FFFFFF' }) {
  return <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />;
}

function FavoriteIcon({ size = 16, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41.81 4.5 2.09C12.09 4.81 13.76 4 15.5 4 18 4 20 6 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={color}
      />
    </Svg>
  );
}

function CalendarIcon({ size = 16, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"
        fill={color}
      />
    </Svg>
  );
}

function CloseIcon({ size = 16, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"
        fill={color}
      />
    </Svg>
  );
}

function getDateRangeBadge(
  dateRange: { start: Date | null; end: Date | null } | undefined,
  t: (key: string) => string
): string | undefined {
  if (!dateRange?.start && !dateRange?.end) return undefined;

  const now = new Date();

  if (dateRange.start && dateRange.end) {
    const start = new Date(dateRange.start);
    start.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) return t('journal.filter.badge.today');
    if (daysDiff === 7) return t('journal.filter.badge.7days');
    if (daysDiff === 30) return t('journal.filter.badge.30days');
  }

  return t('journal.filter.badge.custom');
}

export const FilterBar = memo(function FilterBar({
  onThemePress,
  onDatePress,
  onFavoritesPress,
  onAnalyzedPress,
  onExploredPress,
  onClearPress,
  activeFilters,
  dateRange,
  selectedTheme,
  themeButtonTestID,
  dateButtonTestID,
  favoritesButtonTestID,
  analyzedButtonTestID,
  exploredButtonTestID,
  clearButtonTestID,
}: FilterBarProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const hasActiveFilters =
    activeFilters.theme ||
    activeFilters.date ||
    activeFilters.favorites ||
    activeFilters.analyzed ||
    activeFilters.explored;
  const dateRangeBadge = getDateRangeBadge(dateRange, t);
  const iconColor = colors.textPrimary;
  const activeIconColor = colors.backgroundCard;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <Pressable
        style={[
          styles.filterButton,
          { backgroundColor: activeFilters.theme ? colors.accent : colors.backgroundSecondary },
        ]}
        onPress={onThemePress}
        accessibilityRole="button"
        accessibilityLabel={t('journal.filter.accessibility.theme')}
        testID={themeButtonTestID}
      >
        <CategoryIcon size={16} color={activeFilters.theme ? activeIconColor : iconColor} />
        <Text style={[styles.filterButtonText, { color: activeFilters.theme ? activeIconColor : iconColor }]}>
          {t('journal.filter.theme')}
          {selectedTheme && ` • ${selectedTheme}`}
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.filterButton,
          { backgroundColor: activeFilters.date ? colors.accent : colors.backgroundSecondary },
        ]}
        onPress={onDatePress}
        accessibilityRole="button"
        accessibilityLabel={t('journal.filter.accessibility.date')}
        testID={dateButtonTestID}
      >
        <CalendarIcon size={16} color={activeFilters.date ? activeIconColor : iconColor} />
        <Text style={[styles.filterButtonText, { color: activeFilters.date ? activeIconColor : iconColor }]}>
          {t('journal.filter.date')}
          {dateRangeBadge && ` • ${dateRangeBadge}`}
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.filterButton,
          { backgroundColor: activeFilters.favorites ? colors.accent : colors.backgroundSecondary },
        ]}
        onPress={onFavoritesPress}
        accessibilityRole="button"
        accessibilityLabel={t('journal.filter.accessibility.favorites')}
        testID={favoritesButtonTestID}
      >
        <FavoriteIcon size={16} color={activeFilters.favorites ? activeIconColor : iconColor} />
        <Text style={[styles.filterButtonText, { color: activeFilters.favorites ? activeIconColor : iconColor }]}>
          {t('journal.filter.favorites')}
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.filterButton,
          { backgroundColor: activeFilters.analyzed ? colors.accent : colors.backgroundSecondary },
        ]}
        onPress={onAnalyzedPress}
        accessibilityRole="button"
        accessibilityLabel={t('journal.filter.accessibility.analyzed')}
        testID={analyzedButtonTestID}
      >
        <AnalyzedIcon size={16} color={activeFilters.analyzed ? activeIconColor : iconColor} />
      </Pressable>

      <Pressable
        style={[
          styles.filterButton,
          { backgroundColor: activeFilters.explored ? colors.accent : colors.backgroundSecondary },
        ]}
        onPress={onExploredPress}
        accessibilityRole="button"
        accessibilityLabel={t('journal.filter.accessibility.explored')}
        testID={exploredButtonTestID}
      >
        <ExploredIcon size={16} color={activeFilters.explored ? activeIconColor : iconColor} />
      </Pressable>

      {hasActiveFilters && (
        <Pressable
          style={[styles.filterButton, { backgroundColor: colors.backgroundSecondary }]}
          onPress={onClearPress}
          accessibilityRole="button"
          accessibilityLabel={t('journal.filter.accessibility.clear')}
          testID={clearButtonTestID}
        >
          <CloseIcon size={16} color={iconColor} />
          <Text style={[styles.filterButtonText, { color: iconColor }]}>{t('journal.filter.clear')}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: ThemeLayout.spacing.sm,
    paddingRight: ThemeLayout.spacing.md,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: ThemeLayout.borderRadius.full,
  },
  filterButtonText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
});
