/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type KeyboardListener = (event: { duration: number }) => void;

const { mockListeners, mockConfigureNext } = ((factory: any) => factory())(() => ({
  mockListeners: new Map<string, KeyboardListener>(),
  mockConfigureNext: jest.fn(),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Keyboard: {
    isVisible: () => false,
    addListener: (name: string, listener: KeyboardListener) => {
      mockListeners.set(name, listener);
      return { remove: () => mockListeners.delete(name) };
    },
  },
  LayoutAnimation: {
    configureNext: mockConfigureNext,
    Types: { keyboard: 'keyboard' },
    Properties: { opacity: 'opacity' },
  },
}));

const { useKeyboardVisible } = require('../useKeyboardVisible');

describe('useKeyboardVisible on iOS', () => {
  beforeEach(() => {
    mockListeners.clear();
    mockConfigureNext.mockClear();
  });

  it('follows the keyboard without deferring the removals it causes', () => {
    const { result } = renderHook(() => useKeyboardVisible());

    act(() => mockListeners.get('keyboardWillShow')?.({ duration: 250 }));
    expect(result.current).toBe(true);

    act(() => mockListeners.get('keyboardWillHide')?.({ duration: 250 }));
    expect(result.current).toBe(false);

    // An animated removal reaches Reanimated's layout animations proxy out of
    // order (react-native-reanimated#10882), which aborts a debug build.
    expect(mockConfigureNext).toHaveBeenCalledTimes(2);
    for (const [config] of mockConfigureNext.mock.calls as [Record<string, unknown>][]) {
      expect(config).toMatchObject({ duration: 250, update: { type: 'keyboard' } });
      expect(config).not.toHaveProperty('delete');
    }
  });
});
