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

  it('wraps the three quick filters at 320dp instead of overflowing horizontally', () => {
    render(
      <div style={{ width: 320 }}>
        <FilterBar
          items={[
            { id: 'all', active: true, onPress: jest.fn(), label: 'All', testID: TID.Button.FilterAll },
            { id: 'favorites', active: false, onPress: jest.fn(), label: 'Favorites', testID: TID.Button.FilterFavorites },
            { id: 'to_deepen', active: false, onPress: jest.fn(), label: 'To deepen', testID: TID.Button.FilterToDeepen },
          ]}
          onClear={jest.fn()}
          clearTestID={TID.Button.ClearFilters}
        />
      </div>
    );

    const bar = screen.getByTestId('journal-filter-bar');
    expect(bar.className).toContain('flex-wrap');
    expect(bar.className).not.toContain('flex-nowrap');
    expect(bar.className).not.toContain('overflow-x');
    expect(screen.getByTestId(TID.Button.FilterAll)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.FilterFavorites)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.FilterToDeepen)).toBeTruthy();
  });

  it('keeps active advanced filters visible next to the three quick access chips', () => {
    const onClear = jest.fn();
    render(
      <FilterBar
        items={[
          { id: 'all', active: false, onPress: jest.fn(), label: 'All', testID: TID.Button.FilterAll },
          { id: 'favorites', active: true, onPress: jest.fn(), label: 'Favorites', testID: TID.Button.FilterFavorites },
          { id: 'to_deepen', active: false, onPress: jest.fn(), label: 'To deepen', testID: TID.Button.FilterToDeepen },
          { id: 'theme', active: true, onPress: jest.fn(), label: 'Theme', testID: TID.Button.FilterTheme },
          { id: 'remembered', active: true, onPress: jest.fn(), label: 'Remembered', testID: TID.Button.FilterRemembered },
        ]}
        onClear={onClear}
        selectedTheme={'mystical' as never}
        clearTestID={TID.Button.ClearFilters}
      />
    );

    expect(screen.getByTestId(TID.Button.FilterAll)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.FilterFavorites)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.FilterToDeepen)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.FilterTheme)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.FilterRemembered)).toBeTruthy();
    fireEvent.click(screen.getByTestId(TID.Button.ClearFilters));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('shows theme and type as separate chips without duplicating the type on the theme chip', () => {
    render(
      <FilterBar
        items={[
          { id: 'all', active: false, onPress: jest.fn(), label: 'All', testID: TID.Button.FilterAll },
          { id: 'favorites', active: false, onPress: jest.fn(), label: 'Favorites', testID: TID.Button.FilterFavorites },
          { id: 'to_deepen', active: false, onPress: jest.fn(), label: 'To deepen', testID: TID.Button.FilterToDeepen },
          { id: 'theme', active: true, onPress: jest.fn(), label: 'Theme', testID: TID.Button.FilterTheme },
          { id: 'type', active: true, onPress: jest.fn(), label: 'dream.type.symbolic' },
        ]}
        onClear={jest.fn()}
        selectedTheme={'mystical' as never}
        selectedDreamType={'Symbolic Dream' as never}
        clearTestID={TID.Button.ClearFilters}
      />
    );

    const themeChip = screen.getByTestId(TID.Button.FilterTheme);
    expect(themeChip.textContent).toContain('Theme');
    expect(themeChip.textContent).toContain('dream.theme.mystical');
    expect(themeChip.textContent).not.toContain('dream.type.symbolic');
    expect(themeChip.textContent).not.toContain('Symbolic Dream');
    expect(screen.getByText('dream.type.symbolic')).toBeTruthy();
  });
});
