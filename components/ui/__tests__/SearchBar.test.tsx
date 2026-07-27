import React from 'react';
import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import { SearchBar } from '@/components/ui/SearchBar';

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => null,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {},
    mode: 'light',
  }),
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    accent: { base: '#b27a42' },
    surface: {
      active: '#fff8ef',
      border: '#ddd',
      raised: '#fff',
    },
    text: {
      primary: '#21180f',
      tertiary: '#766',
    },
  }),
}));

describe('SearchBar', () => {
  it('forwards autofocus to the native text input', () => {
    const view = render(
      <SearchBar
        autoFocus
        inputTestID="journal-search-input"
        onChangeText={jest.fn()}
        placeholder="Search dreams"
        value=""
      />
    );

    expect(view.getByTestId('journal-search-input').props.autoFocus).toBe(true);
  });
});
