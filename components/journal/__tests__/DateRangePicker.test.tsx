/** @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { DateRangePicker } from '../DateRangePicker';

jest.mock('react-native', () => {
  const React = require('react');

  return {
    Platform: {
      OS: 'web',
      select: (options: Record<string, unknown>) => options.web ?? options.default,
    },
    Pressable: ({ children, onPress, testID }: any) =>
      React.createElement('button', { type: 'button', onClick: onPress, 'data-testid': testID }, children),
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children }: { children?: React.ReactNode }) => React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
  };
});

jest.mock('@/components/ui/DateTimePicker', () => {
  const React = require('react');
  const MockDateTimePicker = ({ value, minimumDate, maximumDate, onValueChange, testID }: any) =>
    React.createElement('input', {
      type: 'date',
      value: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`,
      min: minimumDate?.toISOString().slice(0, 10),
      max: maximumDate?.toISOString().slice(0, 10),
      'data-testid': testID,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        const [year, month, day] = event.currentTarget.value.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day);
        onValueChange({ nativeEvent: { timestamp: selectedDate.getTime(), utcOffset: 0 } }, selectedDate);
      },
    });

  return {
    __esModule: true,
    default: MockDateTimePicker,
    DateTimePicker: MockDateTimePicker,
  };
});

jest.mock('@/context/ThemeContext', () => {
  const { LightTheme } = require('@/constants/journalTheme');
  return {
    useTheme: () => ({ colors: LightTheme, mode: 'light' }),
  };
});

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/hooks/useLocaleFormatting', () => ({
  useLocaleFormatting: () => ({
    formatDate: (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
  }),
}));

describe('DateRangePicker', () => {
  afterEach(cleanup);

  it('normalizes custom start and end dates before applying the range', () => {
    const onRangeChange = jest.fn();
    const onClose = jest.fn();

    render(
      <DateRangePicker
        startDate={null}
        endDate={null}
        onRangeChange={onRangeChange}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByTestId('journal-date-range-start-button'));
    fireEvent.change(screen.getByTestId('journal-date-range-start-input'), {
      target: { value: '2026-07-10' },
    });

    fireEvent.click(screen.getByTestId('journal-date-range-end-button'));
    fireEvent.change(screen.getByTestId('journal-date-range-end-input'), {
      target: { value: '2026-07-12' },
    });

    fireEvent.click(screen.getByText('common.apply'));

    const [start, end] = onRangeChange.mock.calls[0] as [Date, Date];
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clears an end date that is earlier than the newly selected start date', () => {
    const onRangeChange = jest.fn();

    render(
      <DateRangePicker
        startDate={new Date(2026, 6, 1)}
        endDate={new Date(2026, 6, 5, 23, 59, 59, 999)}
        onRangeChange={onRangeChange}
        onClose={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('journal-date-range-start-button'));
    fireEvent.change(screen.getByTestId('journal-date-range-start-input'), {
      target: { value: '2026-07-10' },
    });
    fireEvent.click(screen.getByText('common.apply'));

    expect(onRangeChange.mock.calls[0]?.[1]).toBeNull();
  });
});
