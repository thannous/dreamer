import { BottomSheet } from '@/components/ui/BottomSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamThemeLabel, getDreamTypeLabel } from '@/lib/dreamLabels';
import { TID } from '@/lib/testIDs';
import type { DreamTheme, DreamType } from '@/lib/types';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DateRangePicker } from './DateRangePicker';

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
};

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
}: AdvancedFilterSheetProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();

  const renderOption = <T extends DreamTheme | DreamType>({
    id,
    label,
    selected,
    onPress,
  }: {
    id: T;
    label: string;
    selected: boolean;
    onPress: (id: T) => void;
  }) => {
    const optionColor = selected ? noctalia.action.primaryText : noctalia.text.primary;

    return (
      <Pressable
        key={id}
        style={[
          styles.option,
          {
            backgroundColor: selected ? noctalia.action.primary : noctalia.surface.soft,
            borderColor: selected ? noctalia.action.primaryBorder : noctalia.surface.border,
          },
        ]}
        onPress={() => onPress(id)}
        accessibilityRole="button"
      >
        <Text style={[styles.optionText, { color: optionColor }]}>{label}</Text>
        {selected ? (
          <IconSymbol name="checkmark" size={15} color={optionColor} />
        ) : null}
      </Pressable>
    );
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      style={[styles.sheet, { backgroundColor: noctalia.surface.raised, maxHeight }]}
      testID={TID.Modal.AdvancedFilters}
    >
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={[styles.eyebrow, { color: noctalia.accent.base }]}>
            {t('journal.filter_sheet.eyebrow')}
          </Text>
          <Text style={[styles.title, { color: noctalia.text.primary }]}>
            {t('journal.filter_sheet.title')}
          </Text>
        </View>
        <Pressable
          style={[styles.headerButton, { backgroundColor: noctalia.surface.soft }]}
          onPress={onClear}
          accessibilityRole="button"
          testID={TID.Button.AdvancedFiltersClear}
        >
          <Text style={[styles.headerButtonText, { color: noctalia.text.primary }]}>
            {t('journal.filter.clear')}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: noctalia.text.primary }]}>
            {t('journal.filter_sheet.theme_section')}
          </Text>
          {availableThemes.length > 0 ? (
            <View style={styles.optionGrid}>
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
            <Text style={[styles.emptyText, { color: noctalia.text.secondary }]}>
              {t('journal.filter_sheet.empty_themes')}
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: noctalia.text.primary }]}>
            {t('journal.filter_sheet.type_section')}
          </Text>
          {availableDreamTypes.length > 0 ? (
            <View style={styles.optionGrid}>
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
            <Text style={[styles.emptyText, { color: noctalia.text.secondary }]}>
              {t('journal.filter_sheet.empty_types')}
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <DateRangePicker
            startDate={dateRange.start}
            endDate={dateRange.end}
            onRangeChange={onDateRangeChange}
            onClose={onClose}
          />
        </View>

        <Pressable
          style={[styles.doneButton, { backgroundColor: noctalia.action.primary }]}
          onPress={onClose}
          accessibilityRole="button"
        >
          <Text style={[styles.doneButtonText, { color: noctalia.action.primaryText }]}>
            {t('common.done')}
          </Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: ThemeLayout.spacing.lg,
    paddingTop: ThemeLayout.spacing.lg,
    paddingBottom: ThemeLayout.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: 3,
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.bold,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  headerButton: {
    borderRadius: ThemeLayout.borderRadius.full,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  headerButtonText: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  content: {
    gap: ThemeLayout.spacing.lg,
    paddingBottom: ThemeLayout.spacing.md,
  },
  section: {
    gap: ThemeLayout.spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ThemeLayout.spacing.sm,
  },
  option: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: ThemeLayout.borderRadius.full,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  optionText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  doneButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ThemeLayout.borderRadius.full,
    borderCurve: 'continuous',
  },
  doneButtonText: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
});
