/* @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { BottomSheet } from '@/components/ui/BottomSheet';

afterEach(cleanup);

describe('BottomSheet Expo UI adapter', () => {
  it('hosts the existing React Native content in the presented sheet', () => {
    const { rerender } = render(
      <BottomSheet visible onClose={() => {}} testID="sheet.test">
        Sheet content
      </BottomSheet>
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByTestId('sheet.test')).toBeTruthy();
    expect(screen.getByText('Sheet content')).toBeTruthy();

    rerender(
      <BottomSheet visible={false} onClose={() => {}} testID="sheet.test">
        Sheet content
      </BottomSheet>
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('preserves dismiss behavior for dismissible and non-dismissible sheets', () => {
    const onClose = jest.fn();
    const { rerender } = render(
      <BottomSheet visible onClose={onClose} testID="sheet.dismissible">
        Sheet content
      </BottomSheet>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss sheet.dismissible' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <BottomSheet
        visible
        dismissBehavior="none"
        onClose={onClose}
        testID="sheet.required"
      >
        Required content
      </BottomSheet>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss sheet.required' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
