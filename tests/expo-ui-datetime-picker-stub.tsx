import React from 'react';

type Props = {
  disabled?: boolean;
  maximumDate?: Date;
  minimumDate?: Date;
  mode?: 'date' | 'time' | 'datetime';
  onDismiss?: () => void;
  onValueChange?: (event: { nativeEvent: { timestamp: number; utcOffset: number } }, date: Date) => void;
  testID?: string;
  value: Date;
};

function toInputValue(value: Date, mode: Props['mode']) {
  if (mode === 'time') return value.toTimeString().slice(0, 5);
  return value.toISOString().slice(0, 10);
}

export function DateTimePicker({
  disabled,
  maximumDate,
  minimumDate,
  mode = 'date',
  onValueChange,
  testID,
  value,
}: Props) {
  return React.createElement('input', {
    disabled,
    max: maximumDate ? toInputValue(maximumDate, mode) : undefined,
    min: minimumDate ? toInputValue(minimumDate, mode) : undefined,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = new Date(event.currentTarget.value);
      onValueChange?.(
        {
          nativeEvent: {
            timestamp: nextValue.getTime(),
            utcOffset: -nextValue.getTimezoneOffset(),
          },
        },
        nextValue
      );
    },
    'data-testid': testID,
    type: mode === 'time' ? 'time' : 'date',
    value: toInputValue(value, mode),
  });
}

export default DateTimePicker;
