import React from 'react';
import { render } from '@testing-library/react-native-legacy';
import { DreamLengthCounter } from '../DreamLengthCounter';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'dark' }) }));
jest.mock('@/constants/noctaliaDesign', () => ({ getNoctaliaDesignTokens: () => ({ text: { secondary: '#aaa' } }) }));
jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    currentLang: 'en',
    t: (key: string, params: Record<string, string> = {}) =>
      `${key}|${Object.entries(params).map(([name, value]) => `${name}=${value}`).join(',')}`,
  }),
}));

it('stays out of an ordinary dream and appears near the maximum', () => {
  const view = render(<DreamLengthCounter length={17999} />);
  expect(view.queryByTestId('dream-length-counter')).toBeNull();

  view.rerender(<DreamLengthCounter length={18200} />);
  const near = view.getByTestId('dream-length-counter');
  expect(near.props.children).toBe('recording.length.near|count=18,200,max=20,000');
  expect(near.props.accessibilityLabel).toBe('recording.length.near_accessibility|count=18,200,max=20,000');

  view.rerender(<DreamLengthCounter length={20000} />);
  expect(view.getByTestId('dream-length-counter').props.children).toBe('recording.length.reached|count=20,000,max=20,000');

  // A longer text kept from a dictation or an older dream shows its real count.
  view.rerender(<DreamLengthCounter length={24000} />);
  expect(view.getByTestId('dream-length-counter').props.children).toBe('recording.length.near|count=24,000,max=20,000');
});
