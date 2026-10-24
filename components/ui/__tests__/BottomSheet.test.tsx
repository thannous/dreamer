/* @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';


import { BottomSheet } from '@/components/ui/BottomSheet';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }) }));

jest.mock('react-native', () => require('../../../tests/react-native-stub'));
jest.mock('expo-asset', () => ({ Asset: { fromModule: (source: unknown) => ({ uri: String(source) }) } }));

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
    // The platform sheet sets the width (narrower than the window on the folded iPhone Duo);
    // the content sets the height.
    const host = screen.getByTestId('sheet.test').querySelector('[data-match-contents]');
    expect(host?.getAttribute('data-match-contents')).toBe('{"vertical":true}');

    rerender(
      <BottomSheet visible={false} onClose={() => {}} testID="sheet.test">
        Sheet content
      </BottomSheet>
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('forwards full-height snap points to the native sheet', () => {
    render(
      <BottomSheet
        visible
        onClose={() => {}}
        snapPoints={['full']}
        testID="sheet.full"
      >
        Full-height content
      </BottomSheet>
    );

    const sheet = screen.getByTestId('sheet.full');

    expect(sheet.getAttribute('data-snap-points')).toBe(
      '["full"]'
    );
    expect(sheet.querySelector('[data-match-contents]')?.getAttribute('data-match-contents'))
      .toBe('false');
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
