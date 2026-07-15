/** @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { DateTimePicker } from '../DateTimePicker.web';

describe('DateTimePicker web adapter', () => {
  afterEach(cleanup);

  it('renders a controlled HTML date input without shifting the local date', () => {
    const onValueChange = jest.fn();

    render(
      <DateTimePicker
        value={new Date(2026, 6, 10, 15, 30)}
        minimumDate={new Date(2026, 6, 1)}
        maximumDate={new Date(2026, 6, 14)}
        onValueChange={onValueChange}
        testID="date-input"
      />
    );

    const input = screen.getByTestId('date-input') as HTMLInputElement;
    expect(input.type).toBe('date');
    expect(input.value).toBe('2026-07-10');
    expect(input.min).toBe('2026-07-01');
    expect(input.max).toBe('2026-07-14');

    fireEvent.change(input, { target: { value: '2026-07-12' } });

    const [, selectedDate] = onValueChange.mock.calls[0] as [unknown, Date];
    expect(selectedDate.getFullYear()).toBe(2026);
    expect(selectedDate.getMonth()).toBe(6);
    expect(selectedDate.getDate()).toBe(12);
    expect(selectedDate.getHours()).toBe(0);
  });

  it('supports time mode while preserving the current local day', () => {
    const onChange = jest.fn();

    render(
      <DateTimePicker
        value={new Date(2026, 6, 10, 15, 30)}
        mode="time"
        onChange={onChange}
        testID="time-input"
      />
    );

    const input = screen.getByTestId('time-input') as HTMLInputElement;
    expect(input.type).toBe('time');
    expect(input.value).toBe('15:30');

    fireEvent.change(input, { target: { value: '08:45' } });

    const [event, selectedDate] = onChange.mock.calls[0] as [
      { type: string; nativeEvent: { timestamp: number } },
      Date,
    ];
    expect(event.type).toBe('set');
    expect(event.nativeEvent.timestamp).toBe(selectedDate.getTime());
    expect(selectedDate.getDate()).toBe(10);
    expect(selectedDate.getHours()).toBe(8);
    expect(selectedDate.getMinutes()).toBe(45);
  });

  it('forwards dark-theme input colors to the native time control', () => {
    render(
      <DateTimePicker
        value={new Date(2026, 6, 10, 7, 0)}
        mode="time"
        style={{ color: '#FFF9EF', colorScheme: 'dark' }}
        testID="dark-time-input"
      />
    );

    const input = screen.getByTestId('dark-time-input') as HTMLInputElement;
    expect(input.style.color).toBe('rgb(255, 249, 239)');
    expect(input.style.colorScheme).toBe('dark');
  });
});
