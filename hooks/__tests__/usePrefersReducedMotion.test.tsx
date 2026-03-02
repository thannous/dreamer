/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
// Hoist mocks
const { mockIsReduceMotionEnabled, mockAddEventListener, mockRemove } = ((factory: any) => factory())(() => ({
  mockIsReduceMotionEnabled: jest.fn(),
  mockAddEventListener: jest.fn(),
  mockRemove: jest.fn(),
}));

// Mock AccessibilityInfo
jest.mock('react-native', () => ({
  AccessibilityInfo: {
    isReduceMotionEnabled: mockIsReduceMotionEnabled,
    addEventListener: mockAddEventListener,
  },
}));

const { usePrefersReducedMotion } = require('../usePrefersReducedMotion');


describe('usePrefersReducedMotion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsReduceMotionEnabled.mockResolvedValue(false);
    mockAddEventListener.mockReturnValue({ remove: mockRemove });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns false initially', () => {
    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(false);
  });

  it('given reduced motion enabled when loading then returns true', async () => {
    mockIsReduceMotionEnabled.mockResolvedValue(true);

    const { result } = renderHook(() => usePrefersReducedMotion());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('given reduced motion disabled when loading then returns false', async () => {
    mockIsReduceMotionEnabled.mockResolvedValue(false);

    const { result } = renderHook(() => usePrefersReducedMotion());

    await waitFor(() => {
      expect(mockIsReduceMotionEnabled).toHaveBeenCalled();
    });

    expect(result.current).toBe(false);
  });

  it('given AccessibilityInfo check fails when loading then returns false', async () => {
    mockIsReduceMotionEnabled.mockRejectedValue(new Error('Not supported'));

    const { result } = renderHook(() => usePrefersReducedMotion());

    // Should not throw, just return false
    await waitFor(() => {
      expect(mockIsReduceMotionEnabled).toHaveBeenCalled();
    });

    expect(result.current).toBe(false);
  });

  it('subscribes to reduceMotionChanged event', () => {
    renderHook(() => usePrefersReducedMotion());

    expect(mockAddEventListener).toHaveBeenCalledWith(
      'reduceMotionChanged',
      expect.any(Function)
    );
  });

  it('updates when reduce motion changes', async () => {
    let changeHandler: (enabled: boolean) => void;
    mockAddEventListener.mockImplementation((event, handler) => {
      changeHandler = handler;
      return { remove: mockRemove };
    });

    const { result } = renderHook(() => usePrefersReducedMotion());

    await waitFor(() => {
      expect(mockAddEventListener).toHaveBeenCalled();
    });

    // Simulate motion preference change
    act(() => {
      changeHandler(true);
    });

    expect(result.current).toBe(true);
  });

  it('removes listener on unmount', async () => {
    const { unmount } = renderHook(() => usePrefersReducedMotion());

    await waitFor(() => {
      expect(mockAddEventListener).toHaveBeenCalled();
    });

    unmount();

    expect(mockRemove).toHaveBeenCalled();
  });

  it('given no addEventListener when mounting then does not crash', () => {
    mockAddEventListener.mockReturnValue(undefined);

    expect(() => {
      const { unmount } = renderHook(() => usePrefersReducedMotion());
      unmount();
    }).not.toThrow();
  });
});
