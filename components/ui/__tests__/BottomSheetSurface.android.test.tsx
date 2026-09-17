/* @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BottomSheetSurface } from '../BottomSheetSurface.android';

let mockFinishHide: () => void;
const mockHide = jest.fn(
  () =>
    new Promise<void>((resolve) => {
      mockFinishHide = resolve;
    }),
);
jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ mode: 'dark', colors: { backgroundCard: '#0d0b1c', textPrimary: '#fff' } }),
}));
jest.mock('@expo/ui/jetpack-compose/modifiers', () => ({
  fillMaxHeight: () => ({}),
  testID: () => ({}),
}));
jest.mock('@expo/ui/jetpack-compose', () => {
  const React = require('react');
  return {
    Host: ({ children }: any) => <div>{children}</div>,
    Column: ({ children }: any) => <div>{children}</div>,
    ModalBottomSheet: React.forwardRef(function Sheet(
      { children, onDismissRequest }: any,
      ref: any,
    ) {
      React.useImperativeHandle(ref, () => ({ hide: mockHide }));
      return (
        <div role="dialog">
          <button onClick={onDismissRequest}>Native dismiss</button>
          {children}
        </div>
      );
    }),
  };
});
afterEach(() => {
  cleanup();
  mockHide.mockClear();
});

it('keeps the content mounted until the native close animation completes', async () => {
  const onDismiss = jest.fn();
  const view = render(
    <BottomSheetSurface isPresented={false} dismissible onDismiss={onDismiss}>
      Content
    </BottomSheetSurface>,
  );
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(mockHide).not.toHaveBeenCalled();
  view.rerender(
    <BottomSheetSurface isPresented dismissible onDismiss={onDismiss}>
      Content
    </BottomSheetSurface>,
  );
  expect(screen.getByText('Content')).toBeTruthy();
  view.rerender(
    <BottomSheetSurface isPresented={false} dismissible onDismiss={onDismiss}>
      Content
    </BottomSheetSurface>,
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
  await act(async () => mockFinishHide());
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('does not let a stale close completion unmount a reopened sheet', async () => {
  const onDismiss = jest.fn();
  const view = render(
    <BottomSheetSurface isPresented dismissible onDismiss={onDismiss}>
      Content
    </BottomSheetSurface>,
  );
  view.rerender(
    <BottomSheetSurface isPresented={false} dismissible onDismiss={onDismiss}>
      Content
    </BottomSheetSurface>,
  );
  view.rerender(
    <BottomSheetSurface isPresented dismissible onDismiss={onDismiss}>
      Content
    </BottomSheetSurface>,
  );
  await act(async () => mockFinishHide());
  expect(screen.getByRole('dialog')).toBeTruthy();
});

it('rejects native dismissal during protected work and accepts it after unlocking', () => {
  const onDismiss = jest.fn();
  const view = render(
    <BottomSheetSurface isPresented dismissible={false} onDismiss={onDismiss}>
      Content
    </BottomSheetSurface>,
  );
  fireEvent.click(screen.getByText('Native dismiss'));
  expect(onDismiss).not.toHaveBeenCalled();
  view.rerender(
    <BottomSheetSurface isPresented dismissible onDismiss={onDismiss}>
      Content
    </BottomSheetSurface>,
  );
  fireEvent.click(screen.getByText('Native dismiss'));
  expect(onDismiss).toHaveBeenCalledTimes(1);
});
