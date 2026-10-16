import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Appearance } from 'react-native';

import { ThemeProvider, useTheme } from '../ThemeContext';

let mockSystemScheme: 'light' | 'dark' = 'light';
let mockNativeOverride: 'light' | 'dark' | 'auto' = 'auto';

jest.mock('react-native', () => ({
  ...jest.requireActual('../../tests/react-native-stub'),
  Platform: { OS: 'ios' },
  Appearance: {
    getColorScheme: () => mockNativeOverride === 'auto' ? mockSystemScheme : mockNativeOverride,
    setColorScheme: (scheme: 'light' | 'dark' | 'auto') => { mockNativeOverride = scheme; },
  },
}));

// The installed Uniwind 1.12 custom themes reset native appearance to the system.
// Web journeys cannot observe that native boundary, and StoreKit needs a purchase.
jest.mock('uniwind', () => ({
  Uniwind: {
    setTheme: (theme: string) => {
      mockNativeOverride = theme === 'light' || theme === 'dark' ? theme : 'auto';
    },
  },
}));

jest.mock('../../hooks/use-color-scheme', () => ({
  useColorScheme: () => mockNativeOverride === 'auto' ? mockSystemScheme : mockNativeOverride,
}));

jest.mock('../../services/storageService', () => ({
  getThemePreference: async () => 'dynamic',
  saveThemePreference: async () => {},
}));

const wrapper = ({ children }: React.PropsWithChildren) => <ThemeProvider>{children}</ThemeProvider>;

beforeEach(() => {
  mockSystemScheme = 'light';
  mockNativeOverride = 'auto';
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 16, 18));
});

afterEach(() => jest.useRealTimers());

it('keeps native appearance with the evening and morning palettes across the clock change', async () => {
  const { result } = await renderHook(() => useTheme(), { wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.ambience).toBe('afterglow');
  expect(result.current.mode).toBe('dark');
  expect(Appearance.getColorScheme()).toBe('dark');
  expect(result.current.systemMode).toBeNull();

  mockSystemScheme = 'dark';
  await act(() => {
    jest.setSystemTime(new Date(2026, 9, 17, 7));
    jest.advanceTimersByTime(60_000);
  });
  expect(result.current.ambience).toBe('morning');
  expect(result.current.mode).toBe('light');
  expect(Appearance.getColorScheme()).toBe('light');
});

it('releases the evening override when switching back to automatic', async () => {
  const { result, rerender } = await renderHook(() => useTheme(), { wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(Appearance.getColorScheme()).toBe('dark');
  expect(result.current.systemMode).toBeNull();

  await act(async () => { await result.current.setPreference('auto'); });
  await rerender({});
  expect(result.current.mode).toBe('light');
  expect(Appearance.getColorScheme()).toBe('light');
  expect(mockNativeOverride).toBe('auto');
  expect(result.current.systemMode).toBe('light');
});
