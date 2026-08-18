/* @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  LUCID_NOW_REFRESH_INTERVAL_MS,
  useLucidNow,
} from '@/hooks/useLucidNow';

describe('useLucidNow', () => {
  const INITIAL_NOW = Date.parse('2026-08-13T08:00:00.000Z');
  let appStateListener: ((state: AppStateStatus) => void) | undefined;
  let removeSubscription: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(INITIAL_NOW);
    removeSubscription = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListener = listener;
      return { remove: removeSubscription };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    appStateListener = undefined;
  });

  it('refreshes periodically without a high-frequency timer', () => {
    const { result } = renderHook(() => useLucidNow());
    expect(result.current).toBe(INITIAL_NOW);

    act(() => {
      jest.advanceTimersByTime(LUCID_NOW_REFRESH_INTERVAL_MS - 1);
    });
    expect(result.current).toBe(INITIAL_NOW);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe(INITIAL_NOW + LUCID_NOW_REFRESH_INTERVAL_MS);
  });

  it('refreshes immediately when the app becomes active', () => {
    const { result } = renderHook(() => useLucidNow());
    jest.setSystemTime(INITIAL_NOW + 15_000);

    act(() => appStateListener?.('background'));
    expect(result.current).toBe(INITIAL_NOW);

    act(() => appStateListener?.('active'));
    expect(result.current).toBe(INITIAL_NOW + 15_000);
  });

  it('cleans up the timer and AppState subscription on unmount', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const { unmount } = renderHook(() => useLucidNow());

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(removeSubscription).toHaveBeenCalledTimes(1);
  });
});
