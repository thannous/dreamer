import { PressableScale } from '@/components/motion';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamThemeLabel, getDreamTypeLabel } from '@/lib/dreamLabels';
import { TID } from '@/lib/testIDs';
import type { DreamTheme, DreamType } from '@/lib/types';
import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { DateRangePicker } from './DateRangePicker';

/**
 * `BottomSheet` styles its content through a `style` prop, so the sheet's own padding
 * cannot be a className. Everything inside it is Uniwind.
 */
const SHEET_STYLE = { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 } as const;

const OPTION_CLASS =
  'min-h-[40px] flex-row items-center gap-1.5 rounded-full border-continuous border-[length:hairlineWidth()] px-3.5 py-[9px]';

type AdvancedFilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  onClear: () => void;
  maxHeight: number;
  availableThemes: DreamTheme[];
  availableDreamTypes: DreamType[];
  selectedTheme: DreamTheme | null;
  selectedDreamType: DreamType | null;
  dateRange: { start: Date | null; end: Date | null };
  onThemeSelect: (theme: DreamTheme) => void;
  onDreamTypeSelect: (dreamType: DreamType) => void;
  onDateRangeChange: (start: Date | null, end: Date | null) => void;
  sortOrder?: JournalSortOrder;
  onSortOrderChange?: (order: JournalSortOrder) => void;
};

export type JournalSortOrder = 'newest' | 'oldest';
const SORT_ORDERS: JournalSortOrder[] = ['newest', 'oldest'];

export function AdvancedFilterSheet({
  visible,
  onClose,
  onClear,
  maxHeight,
  availableThemes,
  availableDreamTypes,
  selectedTheme,
  selectedDreamType,
  dateRange,
  onThemeSelect,
  onDreamTypeSelect,
  onDateRangeChange,
  sortOrder = 'newest',
  onSortOrderChange,
}: AdvancedFilterSheetProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();

  const renderOption = <T extends DreamTheme | DreamType | JournalSortOrder>({
    id,
    label,
    selected,
    onPress,
    showCheckmark = true,
  }: {
    id: T;
    label: string;
    selected: boolean;
    onPress: (id: T) => void;
    showCheckmark?: boolean;
  }) => (
    <PressableScale
      key={id}
      className={`${OPTION_CLASS} ${selected ? 'border-champagne-soft bg-champagne' : 'border-line bg-ink-soft'}`}
      onPress={() => onPress(id)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text
        className={`font-sans-medium text-[14px] ${selected ? 'text-on-champagne' : 'text-ivory'}`}
      >
        {label}
      </Text>
      {selected && showCheckmark ? (
        <IconSymbol
          name="checkmark"
          size={15}
          color={noctalia.action.primaryText}
        />
      ) : null}
    </PressableScale>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      style={[SHEET_STYLE, { backgroundColor: noctalia.surface.raised, maxHeight }]}
      testID={TID.Modal.AdvancedFilters}
    >
      <View className="mb-4 flex-row items-center justify-between gap-4">
        <View className="flex-1 gap-[3px]">
          <Text className="font-sans-bold text-[12px] uppercase text-champagne-on">
            {t('journal.filter_sheet.eyebrow')}
          </Text>
          <Text className="font-sans-bold text-[22px] text-ivory">
            {t('journal.filter_sheet.title')}
          </Text>
        </View>
        <PressableScale
          className="rounded-full border-continuous bg-ink-soft px-3.5 py-2"
          onPress={onClear}
          accessibilityRole="button"
          testID={TID.Button.AdvancedFiltersClear}
        >
          <Text className="font-sans-medium text-[13px] text-ivory">
            {t('journal.filter.clear')}
          </Text>
        </PressableScale>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-6 pb-4"
      >
        <View className="gap-2">
          <Text className="font-sans-bold text-[15px] text-ivory">
            {t('journal.filter_sheet.theme_section')}
          </Text>
          {availableThemes.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {availableThemes.map((theme) =>
                renderOption({
                  id: theme,
                  label: getDreamThemeLabel(theme, t) ?? theme,
                  selected: selectedTheme === theme,
                  onPress: onThemeSelect,
                })
              )}
            </View>
          ) : (
            <Text className="font-sans text-[14px] text-ivory-muted">
              {t('journal.filter_sheet.empty_themes')}
            </Text>
          )}
        </View>

        <View className="gap-2">
          <Text className="font-sans-bold text-[15px] text-ivory">
            {t('journal.filter_sheet.type_section')}
          </Text>
          {availableDreamTypes.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {availableDreamTypes.map((dreamType) =>
                renderOption({
                  id: dreamType,
                  label: getDreamTypeLabel(dreamType, t) ?? dreamType,
                  selected: selectedDreamType === dreamType,
                  onPress: onDreamTypeSelect,
                })
              )}
            </View>
          ) : (
            <Text className="font-sans text-[14px] text-ivory-muted">
              {t('journal.filter_sheet.empty_types')}
            </Text>
          )}
        </View>

        {onSortOrderChange ? (
          <View className="gap-2">
            <Text className="font-sans-bold text-[15px] text-ivory">
              {t('journal.filter_sheet.sort_section')}
            </Text>
            <View className="flex-row flex-wrap gap-2" testID={TID.Component.JournalSortOptions}>
              {SORT_ORDERS.map((order) =>
                renderOption({
                  id: order,
                  label: t(`journal.filter_sheet.sort.${order}`),
                  selected: sortOrder === order,
                  onPress: onSortOrderChange,
                  // A two-way toggle: the selected style is enough, and the
                  // theme/type checkmarks keep meaning "an active filter".
                  showCheckmark: false,
                })
              )}
            </View>
          </View>
        ) : null}

        <View className="gap-2">
          <DateRangePicker
            startDate={dateRange.start}
            endDate={dateRange.end}
            onRangeChange={onDateRangeChange}
            onClose={onClose}
          />
        </View>

        <PressableScale
          className="min-h-[46px] items-center justify-center rounded-full border-continuous bg-champagne"
          onPress={onClose}
          accessibilityRole="button"
        >
          <Text className="font-sans-bold text-[15px] text-on-champagne">
            {t('common.done')}
          </Text>
        </PressableScale>
      </ScrollView>
    </BottomSheet>
  );
}
