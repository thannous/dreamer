import React, { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';

import { PressableScale } from '@/components/motion';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
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
  const { mode } = useTheme();
  const { t } = useTranslation();
  const { formatDate } = useLocaleFormatting();

  const handleStartDateChange = (_event: unknown, selectedDate: Date) => {
    if (Platform.OS === 'android') {
      setPickerMode('none');
    }

    // Set to start of day
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    setLocalStartDate(startOfDay);

    // If end date is before start date, clear it
    if (localEndDate && localEndDate < startOfDay) {
      setLocalEndDate(null);
    }
  };

  const handleEndDateChange = (_event: unknown, selectedDate: Date) => {
    if (Platform.OS === 'android') {
      setPickerMode('none');
    }

    // Set to end of day
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);
    setLocalEndDate(endOfDay);
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
    <View className="w-full max-w-[400px] rounded-lg border border-line bg-ink-raised p-6">
      <Text className="mb-6 text-center font-sans-bold text-[20px] text-ivory">
        {t('journal.date_picker.title')}
      </Text>

      {/* Quick select buttons */}
      <View className="mb-6">
        <Text className="mb-2 font-sans-medium text-[14px] text-ivory-muted">
          {t('journal.date_picker.quick_select')}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <PressableScale className="rounded-sm bg-ink-soft px-3 py-2" onPress={() => handleQuickSelect(0)}>
            <Text className="font-sans text-[14px] text-ivory">{t('journal.date_picker.quick.today')}</Text>
          </PressableScale>
          <PressableScale className="rounded-sm bg-ink-soft px-3 py-2" onPress={() => handleQuickSelect(7)}>
            <Text className="font-sans text-[14px] text-ivory">{t('journal.date_picker.quick.last7')}</Text>
          </PressableScale>
          <PressableScale className="rounded-sm bg-ink-soft px-3 py-2" onPress={() => handleQuickSelect(30)}>
            <Text className="font-sans text-[14px] text-ivory">{t('journal.date_picker.quick.last30')}</Text>
          </PressableScale>
        </View>
      </View>

      {/* Custom range */}
      <View className="mb-6">
        <Text className="mb-2 font-sans-medium text-[14px] text-ivory-muted">
          {t('journal.date_picker.custom_range')}
        </Text>

        {/* Start Date */}
        <View className="mb-2 flex-row items-center">
          <Text className="w-[60px] font-sans text-[16px] text-ivory-muted">
            {t('journal.date_picker.from')}
          </Text>
          <PressableScale
            testID="journal-date-range-start-button"
            className="flex-1 rounded-sm bg-ink-soft px-4 py-3"
            onPress={() => setPickerMode('start')}
          >
            <Text className="font-sans-medium text-[16px] text-ivory">{formatPickerDate(localStartDate)}</Text>
          </PressableScale>
        </View>

        {/* End Date */}
        <View className="mb-2 flex-row items-center">
          <Text className="w-[60px] font-sans text-[16px] text-ivory-muted">
            {t('journal.date_picker.to')}
          </Text>
          <PressableScale
            testID="journal-date-range-end-button"
            className="flex-1 rounded-sm bg-ink-soft px-4 py-3"
            onPress={() => setPickerMode('end')}
          >
            <Text className="font-sans-medium text-[16px] text-ivory">{formatPickerDate(localEndDate)}</Text>
          </PressableScale>
        </View>
      </View>

      {/* Date Pickers */}
      {pickerMode === 'start' && (
        <DateTimePicker
          value={localStartDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={handleStartDateChange}
          onDismiss={() => setPickerMode('none')}
          maximumDate={new Date()}
          themeVariant={mode}
          testID="journal-date-range-start-input"
        />
      )}

      {pickerMode === 'end' && (
        <DateTimePicker
          value={localEndDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={handleEndDateChange}
          onDismiss={() => setPickerMode('none')}
          minimumDate={localStartDate || undefined}
          maximumDate={new Date()}
          themeVariant={mode}
          testID="journal-date-range-end-input"
        />
      )}

      {/* Action buttons */}
      <View className="mb-4 flex-row gap-2">
        <PressableScale
          className="flex-1 items-center rounded-sm bg-ink-soft py-3"
          onPress={handleClear}
        >
          <Text className="font-sans-medium text-[16px] text-ivory">{t('common.clear')}</Text>
        </PressableScale>
        <PressableScale
          className="flex-1 items-center rounded-sm bg-champagne py-3"
          onPress={handleApply}
        >
          <Text className="font-sans-bold text-[16px] text-on-champagne">{t('common.apply')}</Text>
        </PressableScale>
      </View>

      <Pressable className="items-center py-3" onPress={onClose}>
        <Text className="font-sans-medium text-[16px] text-ivory-muted">{t('common.cancel')}</Text>
      </Pressable>
    </View>
  );
}
