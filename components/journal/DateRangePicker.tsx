import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onRangeChange: (start: Date | null, end: Date | null) => void;
  onClose: () => void;
}

type PickerMode = 'none' | 'start' | 'end';

export function DateRangePicker({ startDate, endDate, onRangeChange, onClose }: DateRangePickerProps) {
  const [localStartDate, setLocalStartDate] = useState<Date | null>(startDate);
  const [localEndDate, setLocalEndDate] = useState<Date | null>(endDate);
  const [pickerMode, setPickerMode] = useState<PickerMode>('none');
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const { formatDate } = useLocaleFormatting();

  const handleStartDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setPickerMode('none');
    }

    if (event.type === 'set' && selectedDate) {
      // Set to start of day
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      setLocalStartDate(startOfDay);

      // If end date is before start date, clear it
      if (localEndDate && localEndDate < startOfDay) {
        setLocalEndDate(null);
      }
    }
  };

  const handleEndDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setPickerMode('none');
    }

    if (event.type === 'set' && selectedDate) {
      // Set to end of day
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      setLocalEndDate(endOfDay);
    }
  };

  const handleQuickSelect = (days: number) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    setLocalStartDate(start);
    setLocalEndDate(end);
  };

  const handleApply = () => {
    onRangeChange(localStartDate, localEndDate);
    onClose();
  };

  const handleClear = () => {
    setLocalStartDate(null);
    setLocalEndDate(null);
    onRangeChange(null, null);
  };

  const formatPickerDate = (date: Date | null) => {
    if (!date) return t('journal.date_picker.not_set');
    return formatDate(date, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border }]}>
      <Text style={[styles.title, { color: noctalia.text.primary }]}>{t('journal.date_picker.title')}</Text>

      {/* Quick select buttons */}
      <View style={styles.quickSelectContainer}>
        <Text style={[styles.sectionLabel, { color: noctalia.text.secondary }]}>{t('journal.date_picker.quick_select')}</Text>
        <View style={styles.quickButtons}>
          <Pressable
            style={[styles.quickButton, { backgroundColor: noctalia.surface.soft }]}
            onPress={() => handleQuickSelect(0)}
          >
            <Text style={[styles.quickButtonText, { color: noctalia.text.primary }]}>{t('journal.date_picker.quick.today')}</Text>
          </Pressable>
          <Pressable
            style={[styles.quickButton, { backgroundColor: noctalia.surface.soft }]}
            onPress={() => handleQuickSelect(7)}
          >
            <Text style={[styles.quickButtonText, { color: noctalia.text.primary }]}>{t('journal.date_picker.quick.last7')}</Text>
          </Pressable>
          <Pressable
            style={[styles.quickButton, { backgroundColor: noctalia.surface.soft }]}
            onPress={() => handleQuickSelect(30)}
          >
            <Text style={[styles.quickButtonText, { color: noctalia.text.primary }]}>{t('journal.date_picker.quick.last30')}</Text>
          </Pressable>
        </View>
      </View>

      {/* Custom range */}
      <View style={styles.customRangeContainer}>
        <Text style={[styles.sectionLabel, { color: noctalia.text.secondary }]}>{t('journal.date_picker.custom_range')}</Text>

        {/* Start Date */}
        <View style={styles.dateRow}>
          <Text style={[styles.dateLabel, { color: noctalia.text.secondary }]}>{t('journal.date_picker.from')}</Text>
          <Pressable
            style={[styles.dateButton, { backgroundColor: noctalia.surface.soft }]}
            onPress={() => setPickerMode('start')}
          >
            <Text style={[styles.dateButtonText, { color: noctalia.text.primary }]}>{formatPickerDate(localStartDate)}</Text>
          </Pressable>
        </View>

        {/* End Date */}
        <View style={styles.dateRow}>
          <Text style={[styles.dateLabel, { color: noctalia.text.secondary }]}>{t('journal.date_picker.to')}</Text>
          <Pressable
            style={[styles.dateButton, { backgroundColor: noctalia.surface.soft }]}
            onPress={() => setPickerMode('end')}
          >
            <Text style={[styles.dateButtonText, { color: noctalia.text.primary }]}>{formatPickerDate(localEndDate)}</Text>
          </Pressable>
        </View>
      </View>

      {/* Date Pickers */}
      {pickerMode === 'start' && (
        <DateTimePicker
          value={localStartDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleStartDateChange}
          maximumDate={new Date()}
          themeVariant={mode}
        />
      )}

      {pickerMode === 'end' && (
        <DateTimePicker
          value={localEndDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleEndDateChange}
          minimumDate={localStartDate || undefined}
          maximumDate={new Date()}
          themeVariant={mode}
        />
      )}

      {/* Action buttons */}
      <View style={styles.actionButtons}>
        <Pressable
          style={[styles.actionButton, styles.clearButton, { backgroundColor: noctalia.surface.soft }]}
          onPress={handleClear}
        >
          <Text style={[styles.clearButtonText, { color: noctalia.text.primary }]}>{t('common.clear')}</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.applyButton, { backgroundColor: noctalia.action.primary }]}
          onPress={handleApply}
        >
          <Text style={[styles.applyButtonText, { color: noctalia.action.primaryText }]}>{t('common.apply')}</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.cancelButton}
        onPress={onClose}
      >
        <Text style={[styles.cancelButtonText, { color: noctalia.text.secondary }]}>{t('common.cancel')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: ThemeLayout.borderRadius.lg,
    padding: ThemeLayout.spacing.lg,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.spaceGrotesk.bold,
    marginBottom: ThemeLayout.spacing.lg,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
    marginBottom: ThemeLayout.spacing.sm,
  },
  quickSelectContainer: {
    marginBottom: ThemeLayout.spacing.lg,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  quickButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: ThemeLayout.borderRadius.sm,
  },
  quickButtonText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  customRangeContainer: {
    marginBottom: ThemeLayout.spacing.lg,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ThemeLayout.spacing.sm,
  },
  dateLabel: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.regular,
    width: 60,
  },
  dateButton: {
    flex: 1,
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingVertical: 12,
    borderRadius: ThemeLayout.borderRadius.sm,
  },
  dateButtonText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: ThemeLayout.spacing.sm,
    marginBottom: ThemeLayout.spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: ThemeLayout.borderRadius.sm,
    alignItems: 'center',
  },
  clearButton: {},
  clearButtonText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  applyButton: {},
  applyButtonText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
});
