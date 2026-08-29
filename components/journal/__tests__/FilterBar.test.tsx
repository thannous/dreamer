/** @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { TID } from '@/lib/testIDs';

jest.mock('react-native', () => {
  const React = require('react');
  const toDomProps = (props: Record<string, unknown>) => {
    const { testID, onPress, accessibilityRole, accessibilityLabel, accessibilityState, children, ...rest } = props;
    return {
      ...rest,
      ...(testID ? { 'data-testid': testID } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}),
    };
  };
  const createElement = (tag: string) => {
    const MockNativeElement = ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
      React.createElement(tag, toDomProps(props), children);
    MockNativeElement.displayName = `MockNative${tag}`;
    return MockNativeElement;
  };

  return {
    Platform: { OS: 'web', select: (options: Record<string, unknown>) => options.web ?? options.default },
    Pressable: createElement('button'),
    ScrollView: createElement('div'),
    StyleSheet: { create: <T extends Record<string, unknown>>(styles: T) => styles, hairlineWidth: 1 },
    Text: createElement('span'),
    View: createElement('div'),
  };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) => React.createElement('svg', null, children),
    Path: () => React.createElement('path'),
  };
});

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

jest.mock('@/context/ThemeContext', () => {
  const { LightTheme } = require('@/constants/journalTheme');
  return { useTheme: () => ({ colors: LightTheme, mode: 'light' }) };
});

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { FilterBar } = require('../FilterBar');

describe('FilterBar', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('does not show Clear when only the All chip is active', () => {
    const onClear = jest.fn();
    render(
      <FilterBar
        items={[
          { id: 'all', active: true, onPress: jest.fn(), label: 'All', testID: TID.Button.FilterAll },
          { id: 'favorites', active: false, onPress: jest.fn(), label: 'Favorites', testID: TID.Button.FilterFavorites },
          { id: 'to_deepen', active: false, onPress: jest.fn(), label: 'To deepen', testID: TID.Button.FilterToDeepen },
        ]}
        onClear={onClear}
        clearTestID={TID.Button.ClearFilters}
      />
    );

    expect(screen.queryByTestId(TID.Button.ClearFilters)).toBeNull();
  });

  it('shows Clear when a non-All quick filter is active', () => {
    const onClear = jest.fn();
    render(
      <FilterBar
        items={[
          { id: 'all', active: false, onPress: jest.fn(), label: 'All', testID: TID.Button.FilterAll },
          { id: 'favorites', active: true, onPress: jest.fn(), label: 'Favorites', testID: TID.Button.FilterFavorites },
          { id: 'to_deepen', active: false, onPress: jest.fn(), label: 'To deepen', testID: TID.Button.FilterToDeepen },
        ]}
        onClear={onClear}
        clearTestID={TID.Button.ClearFilters}
      />
    );

    fireEvent.click(screen.getByTestId(TID.Button.ClearFilters));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
