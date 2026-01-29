import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ThemeLayout } from '@/constants/journalTheme';
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
    <View style={[styles.container, { backgroundColor: colors.backgroundCard }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('journal.date_picker.title')}</Text>

      {/* Quick select buttons */}
      <View style={styles.quickSelectContainer}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('journal.date_picker.quick_select')}</Text>
        <View style={styles.quickButtons}>
          <Pressable
            style={[styles.quickButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => handleQuickSelect(0)}
          >
            <Text style={[styles.quickButtonText, { color: colors.textPrimary }]}>{t('journal.date_picker.quick.today')}</Text>
          </Pressable>
          <Pressable
            style={[styles.quickButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => handleQuickSelect(7)}
          >
            <Text style={[styles.quickButtonText, { color: colors.textPrimary }]}>{t('journal.date_picker.quick.last7')}</Text>
          </Pressable>
          <Pressable
            style={[styles.quickButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => handleQuickSelect(30)}
          >
            <Text style={[styles.quickButtonText, { color: colors.textPrimary }]}>{t('journal.date_picker.quick.last30')}</Text>
          </Pressable>
        </View>
      </View>

      {/* Custom range */}
      <View style={styles.customRangeContainer}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('journal.date_picker.custom_range')}</Text>

        {/* Start Date */}
        <View style={styles.dateRow}>
          <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>{t('journal.date_picker.from')}</Text>
          <Pressable
            style={[styles.dateButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => setPickerMode('start')}
          >
            <Text style={[styles.dateButtonText, { color: colors.textPrimary }]}>{formatPickerDate(localStartDate)}</Text>
          </Pressable>
        </View>

        {/* End Date */}
        <View style={styles.dateRow}>
          <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>{t('journal.date_picker.to')}</Text>
          <Pressable
            style={[styles.dateButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => setPickerMode('end')}
          >
            <Text style={[styles.dateButtonText, { color: colors.textPrimary }]}>{formatPickerDate(localEndDate)}</Text>
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
          style={[styles.actionButton, styles.clearButton, { backgroundColor: colors.backgroundSecondary }]}
          onPress={handleClear}
        >
          <Text style={[styles.clearButtonText, { color: colors.textPrimary }]}>{t('common.clear')}</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.applyButton, { backgroundColor: colors.accent }]}
          onPress={handleApply}
        >
          <Text style={[styles.applyButtonText, { color: colors.backgroundCard }]}>{t('common.apply')}</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.cancelButton}
        onPress={onClose}
      >
        <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
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
