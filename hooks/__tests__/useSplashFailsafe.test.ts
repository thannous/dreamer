/* @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  SPLASH_FAILSAFE_TIMEOUT_MS,
  useSplashFailsafe,
} from '../useSplashFailsafe';

describe('useSplashFailsafe', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('times out only after the configured deadline', () => {
    const { result } = renderHook(() => useSplashFailsafe(true));

    act(() => {
      jest.advanceTimersByTime(SPLASH_FAILSAFE_TIMEOUT_MS - 1);
    });
    expect(result.current).toBe(false);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  it('cancels the deadline when the splash finishes normally', () => {
    const { result, rerender } = renderHook(
      ({ active }) => useSplashFailsafe(active),
      { initialProps: { active: true } }
    );

    rerender({ active: false });
    act(() => {
      jest.advanceTimersByTime(SPLASH_FAILSAFE_TIMEOUT_MS);
    });

    expect(result.current).toBe(false);
  });

  it('clears the deadline on unmount', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const { unmount } = renderHook(() => useSplashFailsafe(true));

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
