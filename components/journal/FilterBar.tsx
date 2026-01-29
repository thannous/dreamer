import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamThemeLabel, getDreamTypeLabel } from '@/lib/dreamLabels';
import type { DreamTheme, DreamType } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { memo, useCallback, useEffect } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

type FilterItemId = 'theme' | 'date' | 'favorites' | 'analyzed' | 'explored';

export type FilterBarItem = {
  id: FilterItemId;
  active: boolean;
  onPress: () => void;
  label?: string;
  testID?: string;
};

interface FilterBarProps {
  items: FilterBarItem[];
  onClear: () => void;
  clearTestID?: string;
  dateRange?: {
    start: Date | null;
    end: Date | null;
  };
  selectedTheme?: DreamTheme | null;
  selectedDreamType?: DreamType | null;
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

function ActiveCheck({ visible, color }: { visible: boolean; color: string }) {
  if (!visible) return null;
  return <Ionicons name="checkmark" size={12} color={color} />;
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

const renderIcon = (id: FilterItemId, color: string) => {
  switch (id) {
    case 'theme':
      return <CategoryIcon size={16} color={color} />;
    case 'date':
      return <CalendarIcon size={16} color={color} />;
    case 'favorites':
      return <FavoriteIcon size={16} color={color} />;
    case 'analyzed':
      return <AnalyzedIcon size={16} color={color} />;
    case 'explored':
      return <ExploredIcon size={16} color={color} />;
  }
};

const getAccessibilityLabel = (id: FilterItemId, t: (key: string) => string) => {
  switch (id) {
    case 'theme':
      return t('journal.filter.accessibility.theme');
    case 'date':
      return t('journal.filter.accessibility.date');
    case 'favorites':
      return t('journal.filter.accessibility.favorites');
    case 'analyzed':
      return t('journal.filter.accessibility.analyzed');
    case 'explored':
      return t('journal.filter.accessibility.explored');
  }
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Animated filter pill with scale bounce on toggle and background color transition.
 */
function FilterPill({
  isActive,
  activeColor,
  inactiveColor,
  onPress,
  accessibilityLabel,
  testID,
  children,
}: {
  isActive: boolean;
  activeColor: string;
  inactiveColor: string;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);

  // Bounce on active state change
  useEffect(() => {
    scale.value = withSpring(1.05, { damping: 12, stiffness: 200 }, () => {
      scale.value = withSpring(1, { damping: 15, stiffness: 150 });
    });
  }, [isActive, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: withTiming(isActive ? activeColor : inactiveColor, { duration: 200 }),
  }));

  const handlePress = useCallback(() => {
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }, [onPress]);

  return (
    <AnimatedPressable
      style={[styles.filterButton, animatedStyle]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {children}
    </AnimatedPressable>
  );
}

export const FilterBar = memo(function FilterBar({
  items,
  onClear,
  clearTestID,
  dateRange,
  selectedTheme,
  selectedDreamType,
}: FilterBarProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const hasActiveFilters = items.some((item) => item.active);
  const dateRangeBadge = getDateRangeBadge(dateRange, t);
  const iconColor = colors.textPrimary;
  const activeIconColor = colors.backgroundCard;

  const themeLabelParts: string[] = [];
  if (selectedTheme) themeLabelParts.push(getDreamThemeLabel(selectedTheme, t) ?? selectedTheme);
  if (selectedDreamType) themeLabelParts.push(getDreamTypeLabel(selectedDreamType, t) ?? selectedDreamType);
  const themeFilterSuffix = themeLabelParts.length ? ` • ${themeLabelParts.join(' • ')}` : '';

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {items.map((item) => {
        const isActive = item.active;
        const color = isActive ? activeIconColor : iconColor;
        const baseLabel = item.label ?? '';
        const label = item.id === 'theme'
          ? `${baseLabel}${themeFilterSuffix}`
          : item.id === 'date'
            ? `${baseLabel}${dateRangeBadge ? ` • ${dateRangeBadge}` : ''}`
            : baseLabel;

        return (
          <FilterPill
            key={item.id}
            isActive={isActive}
            activeColor={colors.accent}
            inactiveColor={colors.backgroundSecondary}
            onPress={item.onPress}
            accessibilityLabel={getAccessibilityLabel(item.id, t)}
            testID={item.testID}
          >
            {renderIcon(item.id, color)}
            {item.label ? (
              <Text style={[styles.filterButtonText, { color }]}>{label}</Text>
            ) : null}
            <ActiveCheck visible={isActive} color={activeIconColor} />
          </FilterPill>
        );
      })}

      {hasActiveFilters && (
        <Pressable
          style={[styles.filterButton, { backgroundColor: colors.backgroundSecondary }]}
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel={t('journal.filter.accessibility.clear')}
          testID={clearTestID}
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
    borderCurve: 'continuous',
  },
  filterButtonText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
});
