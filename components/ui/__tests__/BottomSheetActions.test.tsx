import React from 'react';
import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import { BottomSheetPrimaryAction } from '@/components/ui/BottomSheetActions';

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
    action: {
      primary: '#d6a86f',
      primaryBorder: '#b27a42',
      primaryText: '#21180f',
    },
    status: {
      danger: {
        background: '#fee',
        border: '#c00',
        text: '#900',
      },
    },
  }),
}));

describe('BottomSheetPrimaryAction', () => {
  it('keeps its accessible name and exposes busy state while loading', () => {
    const view = render(
      <BottomSheetPrimaryAction
        label="Start analysis"
        onPress={jest.fn()}
        state="loading"
        testID="analysis-action"
      />
    );

    const action = view.getByTestId('analysis-action');
    expect(action.props.accessibilityLabel).toBe('Start analysis');
    expect(action.props.accessibilityState).toEqual({
      busy: true,
      disabled: true,
    });
  });
});
