import React from 'react';
import { act, render } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { LoadingIndicator } from '../LoadingIndicator';

const mockRepeat = jest.fn((value: unknown) => value);
const mockCancel = jest.fn();
let mockReducedMotion = false;
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  const React = require('react');
  return { ...actual, __esModule: true, default: actual.default, withRepeat: (value: unknown) => mockRepeat(value),
    cancelAnimation: (value: unknown) => mockCancel(value),
    useReducedMotion: () => mockReducedMotion,
    useSharedValue: (value: unknown) => React.useRef(actual.useSharedValue(value)).current };
});
jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('@/constants/journalTheme').DarkTheme, mode: 'dark' }),
}));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));

const originalAppState = AppState.currentState;
beforeEach(() => { jest.clearAllMocks(); mockReducedMotion = false; AppState.currentState = 'active'; });
afterEach(() => { jest.restoreAllMocks(); AppState.currentState = originalAppState; });

it('keeps its native container mounted while stopping hidden, unfocused and background loops', async () => {
  let onState!: (state: AppStateStatus) => void;
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    onState = listener;
    return { remove };
  });
  const view = render(<LoadingIndicator visible={false} />);
  expect(mockRepeat).not.toHaveBeenCalled();
  expect(view.getByTestId('chat.loading', { includeHiddenElements: true })).toBeTruthy();
  view.rerender(<LoadingIndicator visible />);
  expect(mockRepeat).toHaveBeenCalledTimes(3);
  mockCancel.mockClear();
  view.rerender(<LoadingIndicator visible={false} />);
  expect(mockCancel).toHaveBeenCalled();
  expect(mockRepeat).toHaveBeenCalledTimes(3);
  view.rerender(<LoadingIndicator visible focused={false} />);
  expect(mockRepeat).toHaveBeenCalledTimes(3);
  view.rerender(<LoadingIndicator visible focused />);
  expect(mockRepeat).toHaveBeenCalledTimes(6);
  await act(async () => onState('background'));
  const stopped = mockCancel.mock.calls.length;
  await act(async () => onState('active'));
  expect(mockRepeat).toHaveBeenCalledTimes(9);
  view.unmount();
  expect(mockCancel.mock.calls.length).toBeGreaterThan(stopped);
  expect(remove).toHaveBeenCalled();
});

it('shows a static indicator when reduced motion is enabled', () => {
  mockReducedMotion = true;
  const view = render(<LoadingIndicator visible />);
  expect(view.getByTestId('chat.loading', { includeHiddenElements: true })).toBeTruthy();
  expect(mockRepeat).not.toHaveBeenCalled();
});
