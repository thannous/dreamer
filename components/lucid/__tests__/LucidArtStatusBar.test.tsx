/* @jest-environment jsdom */
import React, { createRef } from 'react';
import { act, render } from '@testing-library/react';
import { LucidArtStatusBar, type LucidArtStatusBarController } from '../LucidArtStatusBar';

let mockFocused = true;
let mockPlatform = 'ios';
const mockPush = jest.fn((props: object) => ({ ...props }));
const mockPop = jest.fn();
const mockSetStyle = jest.fn();
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));
jest.mock('react-native', () => ({
  Platform: { get OS() { return mockPlatform; } },
  StatusBar: {
    pushStackEntry: (props: object) => mockPush(props),
    popStackEntry: (entry: object) => mockPop(entry),
    setBarStyle: (...args: unknown[]) => mockSetStyle(...args),
  },
}));

beforeEach(() => { jest.clearAllMocks(); mockFocused = true; mockPlatform = 'ios'; });

test('scroll switches icons immediately without animation and restores the page style', () => {
  const overArt = { current: false };
  const controller = createRef<LucidArtStatusBarController['current']>();
  const view = render(<LucidArtStatusBar overArtRef={overArt} controllerRef={controller} pageBar="dark" />);
  act(() => controller.current?.(true));
  expect(mockPush).toHaveBeenCalledWith({ barStyle: 'light-content', animated: false });
  expect(mockSetStyle).toHaveBeenLastCalledWith('light-content', false);
  act(() => controller.current?.(true));
  expect(mockPush).toHaveBeenCalledTimes(1);
  act(() => controller.current?.(false));
  expect(mockPop).toHaveBeenCalledWith(mockPush.mock.results[0].value);
  expect(mockSetStyle).toHaveBeenLastCalledWith('dark-content', false);
  view.unmount();
  expect(controller.current).toBeNull();
});

test('a blurred tab cannot override icons and focus cleanup releases its art entry', () => {
  mockFocused = false;
  const overArt = { current: true };
  const controller = createRef<LucidArtStatusBarController['current']>();
  const view = render(<LucidArtStatusBar overArtRef={overArt} controllerRef={controller} pageBar="dark" />);
  expect(controller.current).toBeNull();
  expect(mockPush).not.toHaveBeenCalled();
  mockFocused = true;
  view.rerender(<LucidArtStatusBar overArtRef={overArt} controllerRef={controller} pageBar="dark" />);
  expect(mockPush).toHaveBeenCalledTimes(1);
  mockFocused = false;
  view.rerender(<LucidArtStatusBar overArtRef={overArt} controllerRef={controller} pageBar="dark" />);
  expect(mockPop).toHaveBeenCalledWith(mockPush.mock.results[0].value);
  expect(controller.current).toBeNull();
  view.unmount();
});

test('web does not call native stack APIs or attach a scroll controller', () => {
  mockPlatform = 'web';
  const controller = createRef<LucidArtStatusBarController['current']>();
  const view = render(<LucidArtStatusBar overArtRef={{ current: true }} controllerRef={controller} pageBar="dark" />);
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockSetStyle).not.toHaveBeenCalled();
  expect(controller.current).toBeNull();
  view.unmount();
});
