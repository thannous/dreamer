import React, { type CSSProperties, type ChangeEvent } from 'react';
import type {
  DateTimePickerChangeEvent,
  DateTimePickerEvent,
  DateTimePickerProps as ExpoDateTimePickerProps,
} from '@expo/ui/community/datetime-picker';

export type { DateTimePickerChangeEvent, DateTimePickerEvent };

export type DateTimePickerProps = Omit<ExpoDateTimePickerProps, 'style'> & {
  style?: CSSProperties;
};

const pad = (value: number) => String(value).padStart(2, '0');

function formatInputValue(value: Date, mode: DateTimePickerProps['mode']) {
  const date = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  const time = `${pad(value.getHours())}:${pad(value.getMinutes())}`;

  if (mode === 'time') return time;
  if (mode === 'datetime') return `${date}T${time}`;
  return date;
}

function parseInputValue(
  inputValue: string,
  mode: DateTimePickerProps['mode'],
  currentValue: Date
) {
  if (mode === 'time') {
    const [hours, minutes] = inputValue.split(':').map(Number);
    const nextValue = new Date(currentValue);
    nextValue.setHours(hours, minutes, 0, 0);
    return nextValue;
  }

  const [datePart, timePart] = inputValue.split('T');
  const [year, month, day] = datePart.split('-').map(Number);

  if (mode === 'datetime' && timePart) {
    const [hours, minutes] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }

  return new Date(year, month - 1, day);
}

export function DateTimePicker({
  value,
  onChange,
  onValueChange,
  mode = 'date',
  minimumDate,
  maximumDate,
  testID,
  disabled,
  style,
}: DateTimePickerProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.currentTarget.value) return;

    const nextValue = parseInputValue(event.currentTarget.value, mode, value);
    const nativeEvent = {
      timestamp: nextValue.getTime(),
      utcOffset: -nextValue.getTimezoneOffset(),
    };

    if (onValueChange) {
      onValueChange({ nativeEvent }, nextValue);
      return;
    }

    onChange?.({ type: 'set', nativeEvent }, nextValue);
  };

  return (
    <input
      type={mode === 'datetime' ? 'datetime-local' : mode}
      value={formatInputValue(value, mode)}
      min={minimumDate ? formatInputValue(minimumDate, mode) : undefined}
      max={maximumDate ? formatInputValue(maximumDate, mode) : undefined}
      onChange={handleChange}
      disabled={disabled}
      data-testid={testID}
      style={style}
    />
  );
}

export default DateTimePicker;
