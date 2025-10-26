import React, { memo } from 'react';
import { Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { JournalTheme } from '@/constants/journalTheme';

interface FilterBarProps {
  onThemePress: () => void;
  onDatePress: () => void;
  onClearPress: () => void;
  activeFilters: {
    theme: boolean;
    date: boolean;
  };
  dateRange?: {
    start: Date | null;
    end: Date | null;
  };
  selectedTheme?: string | null;
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

interface FilterButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  isActive?: boolean;
  badge?: string;
}

function FilterButton({ icon, label, onPress, isActive, badge }: FilterButtonProps) {
  return (
    <Pressable
      style={[styles.filterButton, isActive && styles.filterButtonActive]}
      onPress={onPress}
    >
      {icon}
      <Text style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}>
        {label}
        {badge && ` • ${badge}`}
      </Text>
    </Pressable>
  );
}

function getDateRangeBadge(dateRange?: { start: Date | null; end: Date | null }): string | undefined {
  if (!dateRange?.start && !dateRange?.end) return undefined;

  const now = new Date();

  if (dateRange.start && dateRange.end) {
    const start = new Date(dateRange.start);
    start.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) return 'Today';
    if (daysDiff === 7) return '7 days';
    if (daysDiff === 30) return '30 days';
  }

  return 'Custom';
}

export const FilterBar = memo(function FilterBar({
  onThemePress,
  onDatePress,
  onClearPress,
  activeFilters,
  dateRange,
  selectedTheme,
}: FilterBarProps) {
  const hasActiveFilters = activeFilters.theme || activeFilters.date;
  const dateRangeBadge = getDateRangeBadge(dateRange);
  const iconColor = JournalTheme.textPrimary;
  const activeIconColor = JournalTheme.backgroundCard;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <FilterButton
        icon={<CategoryIcon size={16} color={activeFilters.theme ? activeIconColor : iconColor} />}
        label="Theme"
        onPress={onThemePress}
        isActive={activeFilters.theme}
        badge={selectedTheme || undefined}
      />
      <FilterButton
        icon={<CalendarIcon size={16} color={activeFilters.date ? activeIconColor : iconColor} />}
        label="Date"
        onPress={onDatePress}
        isActive={activeFilters.date}
        badge={dateRangeBadge}
      />
      {hasActiveFilters && (
        <FilterButton
          icon={<CloseIcon size={16} color={iconColor} />}
          label="Clear"
          onPress={onClearPress}
        />
      )}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: JournalTheme.spacing.sm,
    paddingRight: JournalTheme.spacing.md,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: JournalTheme.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: JournalTheme.borderRadius.full,
  },
  filterButtonActive: {
    backgroundColor: JournalTheme.accent,
  },
  filterButtonText: {
    color: JournalTheme.textPrimary,
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  filterButtonTextActive: {
    color: JournalTheme.backgroundCard,
  },
});
