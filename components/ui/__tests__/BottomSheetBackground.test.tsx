/* @jest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import React from 'react';

import { BottomSheet } from '@/components/ui/BottomSheet';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 84 }) }));
jest.mock('react-native', () => {
  const stub = require('../../../tests/react-native-stub');
  const React = require('react');
  const View = ({ children, className }: any) => React.createElement('div', { 'data-class': className }, children);
  return { ...stub, Platform: { ...stub.Platform, OS: 'ios' }, View, ScrollView: View };
});
jest.mock('expo-asset', () => ({ Asset: { fromModule: (source: unknown) => ({ uri: String(source) }) } }));

afterEach(cleanup);

// The iOS sheet paints its own background up to its edges; content that painted it again showed
// a seam where it stops short of the sheet.
it('on iOS leaves the background to the platform sheet', () => {
  const { container } = render(
    <BottomSheet visible onClose={() => {}} testID="sheet.ios">
      Sheet content
    </BottomSheet>
  );
  const classes = [...container.querySelectorAll('[data-class]')].map((node) => node.getAttribute('data-class'));
  expect(classes.some((value) => value?.includes('px-6'))).toBe(true);
  expect(classes.some((value) => value?.includes('bg-ink-solid'))).toBe(false);
});
