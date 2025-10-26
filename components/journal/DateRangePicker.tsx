import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { JournalTheme } from '@/constants/journalTheme';

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

  const formatDate = (date: Date | null) => {
    if (!date) return 'Not set';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Date Range</Text>

      {/* Quick select buttons */}
      <View style={styles.quickSelectContainer}>
        <Text style={styles.sectionLabel}>Quick Select</Text>
        <View style={styles.quickButtons}>
          <Pressable
            style={styles.quickButton}
            onPress={() => handleQuickSelect(0)}
          >
            <Text style={styles.quickButtonText}>Today</Text>
          </Pressable>
          <Pressable
            style={styles.quickButton}
            onPress={() => handleQuickSelect(7)}
          >
            <Text style={styles.quickButtonText}>Last 7 days</Text>
          </Pressable>
          <Pressable
            style={styles.quickButton}
            onPress={() => handleQuickSelect(30)}
          >
            <Text style={styles.quickButtonText}>Last 30 days</Text>
          </Pressable>
        </View>
      </View>

      {/* Custom range */}
      <View style={styles.customRangeContainer}>
        <Text style={styles.sectionLabel}>Custom Range</Text>

        {/* Start Date */}
        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>From:</Text>
          <Pressable
            style={styles.dateButton}
            onPress={() => setPickerMode('start')}
          >
            <Text style={styles.dateButtonText}>{formatDate(localStartDate)}</Text>
          </Pressable>
        </View>

        {/* End Date */}
        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>To:</Text>
          <Pressable
            style={styles.dateButton}
            onPress={() => setPickerMode('end')}
          >
            <Text style={styles.dateButtonText}>{formatDate(localEndDate)}</Text>
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
          themeVariant="dark"
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
          themeVariant="dark"
        />
      )}

      {/* Action buttons */}
      <View style={styles.actionButtons}>
        <Pressable
          style={[styles.actionButton, styles.clearButton]}
          onPress={handleClear}
        >
          <Text style={styles.clearButtonText}>Clear</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.applyButton]}
          onPress={handleApply}
        >
          <Text style={styles.applyButtonText}>Apply</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.cancelButton}
        onPress={onClose}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: JournalTheme.backgroundCard,
    borderRadius: JournalTheme.borderRadius.lg,
    padding: JournalTheme.spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: JournalTheme.textPrimary,
    marginBottom: JournalTheme.spacing.lg,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: JournalTheme.textSecondary,
    marginBottom: JournalTheme.spacing.sm,
  },
  quickSelectContainer: {
    marginBottom: JournalTheme.spacing.lg,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  quickButton: {
    backgroundColor: JournalTheme.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: JournalTheme.borderRadius.sm,
  },
  quickButtonText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textPrimary,
  },
  customRangeContainer: {
    marginBottom: JournalTheme.spacing.lg,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: JournalTheme.spacing.sm,
  },
  dateLabel: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textSecondary,
    width: 60,
  },
  dateButton: {
    flex: 1,
    backgroundColor: JournalTheme.backgroundSecondary,
    paddingHorizontal: JournalTheme.spacing.md,
    paddingVertical: 12,
    borderRadius: JournalTheme.borderRadius.sm,
  },
  dateButtonText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: JournalTheme.textPrimary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: JournalTheme.spacing.sm,
    marginBottom: JournalTheme.spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: JournalTheme.borderRadius.sm,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: JournalTheme.backgroundSecondary,
  },
  clearButtonText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: JournalTheme.textPrimary,
  },
  applyButton: {
    backgroundColor: JournalTheme.accent,
  },
  applyButtonText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: JournalTheme.backgroundCard,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: JournalTheme.textSecondary,
  },
});
