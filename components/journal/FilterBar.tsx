import { PressableScale } from '@/components/motion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamThemeLabel } from '@/lib/dreamLabels';
import type { DreamTheme, DreamType } from '@/lib/types';
import React, { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { IconSymbol } from '@/components/ui/icon-symbol';

type FilterItemId =
  | 'all'
  | 'favorites'
  | 'to_deepen'
  | 'theme'
  | 'type'
  | 'date'
  | 'remembered'
  | 'recurring'
  | 'search'
  | 'sort'
  | 'unanalyzed'
  | 'analyzed'
  | 'explored'
  | 'more';

export type FilterBarItem = {
  id: FilterItemId;
  active: boolean;
  onPress: () => void;
  label?: string;
  accessibilityLabel?: string;
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

function AllIcon({ size = 16, color = '#FFFFFF' }) {
  return <IconSymbol name="rectangle.stack.fill" size={size} color={color} />;
}

function ToDeepenIcon({ size = 16, color = '#FFFFFF' }) {
  return <IconSymbol name="sparkles" size={size} color={color} />;
}

function AnalyzedIcon({ size = 16, color = '#FFFFFF' }) {
  return <IconSymbol name="sparkles" size={size} color={color} />;
}

function ExploredIcon({ size = 16, color = '#FFFFFF' }) {
  return <IconSymbol name="bubble.left.and.bubble.right" size={size} color={color} />;
}

function MoreIcon({ size = 16, color = '#FFFFFF' }) {
  return <IconSymbol name="slider.horizontal.3" size={size} color={color} />;
}

function RecurringIcon({ size = 16, color = '#FFFFFF' }) {
  return <IconSymbol name="arrow.triangle.2.circlepath" size={size} color={color} />;
}

function SearchFilterIcon({ size = 16, color = '#FFFFFF' }) {
  return <IconSymbol name="magnifyingglass" size={size} color={color} />;
}

function SortIcon({ size = 16, color = '#FFFFFF' }) {
  return <IconSymbol name="arrow.up.circle" size={size} color={color} />;
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
  return <IconSymbol name="checkmark" size={12} color={color} />;
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
    case 'all':
      return <AllIcon size={16} color={color} />;
    case 'theme':
      return <CategoryIcon size={16} color={color} />;
    case 'type':
      return <CategoryIcon size={16} color={color} />;
    case 'date':
      return <CalendarIcon size={16} color={color} />;
    case 'favorites':
      return <FavoriteIcon size={16} color={color} />;
    case 'to_deepen':
      return <ToDeepenIcon size={16} color={color} />;
    case 'remembered':
      return <CalendarIcon size={16} color={color} />;
    case 'recurring':
      return <RecurringIcon size={16} color={color} />;
    case 'search':
      return <SearchFilterIcon size={16} color={color} />;
    case 'sort':
      return <SortIcon size={16} color={color} />;
    case 'unanalyzed':
      return <AnalyzedIcon size={16} color={color} />;
    case 'analyzed':
      return <AnalyzedIcon size={16} color={color} />;
    case 'explored':
      return <ExploredIcon size={16} color={color} />;
    case 'more':
      return <MoreIcon size={16} color={color} />;
  }
};

const getAccessibilityLabel = (id: FilterItemId, t: (key: string) => string, explicitLabel?: string) => {
  if (explicitLabel) return explicitLabel;
  switch (id) {
    case 'all':
      return t('journal.filter.accessibility.all');
    case 'theme':
      return t('journal.filter.accessibility.theme');
    case 'type':
      return t('journal.filter.accessibility.theme');
    case 'date':
      return t('journal.filter.accessibility.date');
    case 'favorites':
      return t('journal.filter.accessibility.favorites');
    case 'to_deepen':
      return t('journal.filter.accessibility.to_deepen');
    case 'remembered':
      return t('journal.filter.accessibility.remembered');
    case 'recurring':
      return t('journal.filter.accessibility.recurring');
    case 'search':
      return t('journal.search_placeholder');
    case 'sort':
      return t('journal.filter_sheet.sort_section');
    case 'unanalyzed':
      return t('journal.filter_sheet.status.unanalyzed');
    case 'analyzed':
      return t('journal.filter.accessibility.analyzed');
    case 'explored':
      return t('journal.filter.accessibility.explored');
    case 'more':
      return t('journal.filter.accessibility.more');
  }
};

const PILL_CLASSNAME =
  'min-h-[44px] min-w-[44px] flex-row shrink-0 grow-0 items-center gap-1.5 self-start rounded-full border-continuous px-3 py-2';

/**
 * Filter pill.
 *
 * Toggling a filter happens dozens of times a session, so it gets press feedback and
 * nothing else: the previous version bounced every pill on mount and cross-faded its
 * background on every toggle, which is animation the user pays for on every tap. The
 * fill and the checkmark already say "active".
 */
function FilterPill({
  isActive,
  onPress,
  accessibilityLabel,
  testID,
  children,
}: {
  isActive: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
  children: React.ReactNode;
}) {
  return (
    <PressableScale
      className={`${PILL_CLASSNAME} ${isActive ? 'bg-champagne' : 'bg-ink-soft'}`}
      haptic="selection"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {children}
    </PressableScale>
  );
}

export const FilterBar = memo(function FilterBar({
  items,
  onClear,
  clearTestID,
  dateRange,
  selectedTheme,
}: FilterBarProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const hasActiveFilters = items.some((item) => item.id !== 'all' && item.active);
  const dateRangeBadge = getDateRangeBadge(dateRange, t);
  const iconColor = noctalia.text.primary;
  const activeIconColor = noctalia.action.primaryText;
  const themeFilterSuffix = selectedTheme
    ? ` • ${getDreamThemeLabel(selectedTheme, t) ?? selectedTheme}`
    : '';

  return (
    <View className="w-full flex-row flex-wrap items-center gap-2" testID="journal-filter-bar">
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
              onPress={item.onPress}
              accessibilityLabel={getAccessibilityLabel(item.id, t, item.accessibilityLabel)}
              testID={item.testID}
            >
              {renderIcon(item.id, color)}
              {item.label ? (
                <Text
                  className={`web:whitespace-nowrap shrink-0 grow-0 font-sans-medium text-[14px] ${
                    isActive ? 'text-on-champagne' : 'text-ivory'
                  }`}
                >
                  {label}
                </Text>
              ) : null}
              <ActiveCheck visible={isActive} color={activeIconColor} />
            </FilterPill>
          );
        })}

        {hasActiveFilters && (
          <PressableScale
            className={`${PILL_CLASSNAME} bg-ink-soft`}
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel={t('journal.filter.accessibility.clear')}
            testID={clearTestID}
          >
            <CloseIcon size={16} color={iconColor} />
            <Text className="shrink-0 grow-0 font-sans-medium text-[14px] text-ivory">
              {t('journal.filter.clear')}
            </Text>
          </PressableScale>
        )}
    </View>
  );
});
