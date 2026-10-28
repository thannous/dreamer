/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type KeyboardEvent = { duration: number; endCoordinates: { screenX: number; screenY: number; width: number; height: number } };
type KeyboardListener = (event: KeyboardEvent) => void;

const { mockListeners, mockConfigureNext, mockShown, mockSubscription } = ((factory: any) => factory())(() => ({
  mockListeners: new Map<string, KeyboardListener>(),
  mockConfigureNext: jest.fn(),
  mockShown: { current: null as KeyboardEvent['endCoordinates'] | null },
  mockSubscription: { before: null as (() => void) | null },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Keyboard: {
    isVisible: () => mockShown.current !== null,
    metrics: () => mockShown.current ?? undefined,
    addListener: (name: string, listener: KeyboardListener) => {
      const before = mockSubscription.before;
      mockSubscription.before = null;
      before?.();
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

// The folded iPhone Duo (466 x 678): a keyboard 300 pt tall, and the one a fold reports.
const keyboard = (height: number, duration = 250): KeyboardEvent => ({
  duration,
  endCoordinates: { screenX: 0, screenY: 678 - height, width: 466, height },
});

describe('useKeyboardVisible on iOS', () => {
  beforeEach(() => {
    mockListeners.clear();
    mockConfigureNext.mockClear();
    mockShown.current = null;
    mockSubscription.before = null;
  });

  it('follows the keyboard without deferring the removals it causes', () => {
    const { result } = renderHook(() => useKeyboardVisible());

    act(() => mockListeners.get('keyboardWillShow')?.(keyboard(300)));
    expect(result.current).toBe(true);
    act(() => mockListeners.get('keyboardDidShow')?.(keyboard(300)));

    act(() => mockListeners.get('keyboardWillHide')?.(keyboard(300)));
    expect(result.current).toBe(false);
    act(() => mockListeners.get('keyboardDidHide')?.(keyboard(300)));

    // An animated removal reaches Reanimated's layout animations proxy out of
    // order (react-native-reanimated#10882), which aborts a debug build.
    expect(mockConfigureNext).toHaveBeenCalledTimes(2);
    for (const [config] of mockConfigureNext.mock.calls as [Record<string, unknown>][]) {
      expect(config).toMatchObject({ duration: 250, update: { type: 'keyboard' } });
      expect(config).not.toHaveProperty('delete');
    }
  });

  it('sees no keyboard in the one of no height a fold of the iPhone Duo reports', () => {
    const { result } = renderHook(() => useKeyboardVisible());
    const show = (event: KeyboardEvent) => act(() => mockListeners.get('keyboardWillShow')?.(event));
    const hide = (event: KeyboardEvent) => act(() => mockListeners.get('keyboardWillHide')?.(event));

    // Folding reports a keyboard shown with no height, twice, and no hide.
    show(keyboard(0, 0));
    show(keyboard(0, 0));
    expect(result.current).toBe(false);
    expect(mockConfigureNext).not.toHaveBeenCalled();

    // A real keyboard comes and goes as before.
    show(keyboard(300));
    expect(result.current).toBe(true);
    hide(keyboard(300));
    expect(result.current).toBe(false);
    expect(mockConfigureNext).toHaveBeenCalledTimes(2);

    // Unfolding reports two more of no height, then two hides (measured: 383 ms): nothing
    // changes, so no animation is left for another layout to take.
    show(keyboard(0, 0));
    show(keyboard(0, 0));
    hide(keyboard(0, 383));
    hide(keyboard(0, 383));
    expect(result.current).toBe(false);
    expect(mockConfigureNext).toHaveBeenCalledTimes(2);

    // Folding with a keyboard up leaves nothing covering the window.
    show(keyboard(300));
    show(keyboard(0, 0));
    expect(result.current).toBe(false);
  });

  it('starts without a keyboard React Native still holds from a fold', () => {
    mockShown.current = keyboard(0, 0).endCoordinates;
    expect(renderHook(() => useKeyboardVisible()).result.current).toBe(false);

    mockShown.current = keyboard(300).endCoordinates;
    expect(renderHook(() => useKeyboardVisible()).result.current).toBe(true);
  });

  it('reconciles a hide that began before this screen mounted without animating it again', () => {
    // RN updates isVisible/metrics only on DidHide. WillHide was already emitted
    // by the previous screen, so the initial snapshot still reports a keyboard.
    mockShown.current = keyboard(300).endCoordinates;
    const { result } = renderHook(() => useKeyboardVisible());
    expect(result.current).toBe(true);

    act(() => {
      mockShown.current = null;
      mockListeners.get('keyboardDidHide')?.(keyboard(300));
    });
    expect(result.current).toBe(false);
    expect(mockConfigureNext).not.toHaveBeenCalled();
  });

  it('ignores the DidShow of a show cut short by a hide', () => {
    const { result } = renderHook(() => useKeyboardVisible());
    act(() => mockListeners.get('keyboardWillShow')?.(keyboard(300)));
    act(() => mockListeners.get('keyboardWillHide')?.(keyboard(300)));
    expect(result.current).toBe(false);

    act(() => mockListeners.get('keyboardDidShow')?.(keyboard(300)));
    expect(result.current).toBe(false);
    act(() => mockListeners.get('keyboardDidHide')?.(keyboard(300)));
    expect(result.current).toBe(false);
    expect(mockConfigureNext).toHaveBeenCalledTimes(2);
  });

  it('reconciles a keyboard that finished hiding between render and subscription', () => {
    mockShown.current = keyboard(300).endCoordinates;
    mockSubscription.before = () => { mockShown.current = null; };
    const { result } = renderHook(() => useKeyboardVisible());
    expect(result.current).toBe(false);
    expect(mockConfigureNext).not.toHaveBeenCalled();
  });

  it('reconciles a missed show while preserving the folded Duo zero-height rule', () => {
    const { result, unmount } = renderHook(() => useKeyboardVisible());
    act(() => mockListeners.get('keyboardDidShow')?.(keyboard(0)));
    expect(result.current).toBe(false);
    act(() => mockListeners.get('keyboardDidShow')?.(keyboard(300)));
    expect(result.current).toBe(true);
    act(() => mockListeners.get('keyboardDidShow')?.(keyboard(0)));
    expect(result.current).toBe(false);
    expect(mockConfigureNext).not.toHaveBeenCalled();
    unmount();
    expect(mockListeners.size).toBe(0);
  });
});
