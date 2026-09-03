/* @jest-environment jsdom */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

const mockWindow = { width: 390, height: 844, scale: 2, fontScale: 1 };

jest.mock('react-native', () => {
  const React = require('react');
  const flattenStyle = (style: unknown): Record<string, unknown> => {
    if (!style) return {};
    if (Array.isArray(style)) {
      return style.reduce<Record<string, unknown>>((acc, item) => ({ ...acc, ...flattenStyle(item) }), {});
    }
    return style as Record<string, unknown>;
  };
  const toDomProps = (props: Record<string, any>) => {
    const {
      testID,
      onPress,
      accessibilityRole,
      accessibilityLabel,
      className,
      style,
      placeholder,
      value,
      onChangeText,
      allowFontScaling,
      textAlignVertical,
      underlineColorAndroid,
      autoFocus,
      ...rest
    } = props;
    const flattened = flattenStyle(style);
    return {
      ...rest,
      ...(className ? { className } : {}),
      ...(Object.keys(flattened).length ? { 'data-style': JSON.stringify(flattened) } : {}),
      ...(placeholder ? { placeholder } : {}),
      ...(value !== undefined ? { value } : {}),
      ...(autoFocus ? { 'data-autofocus': 'true' } : {}),
      ...(allowFontScaling === false ? { 'data-allow-font-scaling': 'false' } : {}),
      ...(textAlignVertical ? { 'data-text-align-vertical': textAlignVertical } : {}),
      ...(underlineColorAndroid ? { 'data-underline-color-android': underlineColorAndroid } : {}),
      ...(testID ? { 'data-testid': testID } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(onChangeText ? { onChange: (event: { target: { value: string } }) => onChangeText(event.target.value) } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}),
    };
  };
  const createElement = (tag: string) => {
    const MockNativeElement = ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: any;
    }) => React.createElement(tag, toDomProps(props), children);
    MockNativeElement.displayName = `MockNative${tag}`;
    return MockNativeElement;
  };

  return {
    __esModule: true,
    Platform: {
      OS: 'android',
      select: (values: Record<string, any>) => values?.android ?? values?.default,
    },
    Pressable: createElement('button'),
    Text: createElement('span'),
    TextInput: createElement('input'),
    View: createElement('div'),
    useWindowDimensions: () => mockWindow,
    StyleSheet: {
      create: <T extends Record<string, any>>(styles: T) => styles,
      flatten: flattenStyle,
      hairlineWidth: 1,
    },
  };
});

jest.mock('react-native-reanimated', () => {
  const entering: Record<string, unknown> = {};
  ['delay', 'duration', 'springify', 'withInitialValues', 'easing'].forEach((key) => {
    entering[key] = () => entering;
  });
  return {
    __esModule: true,
    default: {
      View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
      createAnimatedComponent: (Component: unknown) => Component,
    },
    createAnimatedComponent: (Component: unknown) => Component,
    cubicBezier: (...points: number[]) => `cubic-bezier(${points.join(', ')})`,
    Easing: { bezier: () => (value: unknown) => value },
    useReducedMotion: () => false,
    FadeIn: entering,
    FadeInDown: entering,
  };
});

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
    accent: { base: '#b27a42', text: '#b27a42'},
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

const { SearchBar } = require('@/components/ui/SearchBar') as {
  SearchBar: React.ComponentType<{
    autoFocus?: boolean;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    testID?: string;
    inputTestID?: string;
  }>;
};

afterEach(() => {
  cleanup();
  mockWindow.fontScale = 1;
});

describe('SearchBar', () => {
  it('forwards autofocus to the native text input', () => {
    render(
      <SearchBar
        autoFocus
        inputTestID="journal-search-input"
        onChangeText={jest.fn()}
        placeholder="Search dreams"
        value=""
      />,
    );

    expect(screen.getByTestId('journal-search-input').getAttribute('data-autofocus')).toBe('true');
  });

  it('keeps a 44dp row at default fontScale and lets the placeholder scale', () => {
    render(
      <SearchBar
        testID="journal.search"
        inputTestID="journal-search-input"
        onChangeText={jest.fn()}
        placeholder="Search your dream journey..."
        value=""
      />,
    );

    const row = screen.getByTestId('journal.search');
    const input = screen.getByTestId('journal-search-input');
    expect(row.getAttribute('class')).toContain('min-h-11');
    expect(row.getAttribute('class')?.split(/\s+/)).not.toContain('h-11');
    expect(JSON.parse(row.getAttribute('data-style') ?? '{}')).toEqual(
      expect.objectContaining({
        minHeight: 44,
        paddingVertical: 8,
        borderCurve: 'continuous',
      }),
    );
    expect(input.getAttribute('data-allow-font-scaling')).toBeNull();
    expect(input.getAttribute('data-text-align-vertical')).toBe('center');
    expect(input.getAttribute('placeholder')).toBe('Search your dream journey...');
    expect(JSON.parse(input.getAttribute('data-style') ?? '{}')).toEqual(
      expect.objectContaining({
        minHeight: 20,
        paddingVertical: 0,
      }),
    );
  });

  it('grows vertically at fontScale 2 so the placeholder is not clipped', () => {
    mockWindow.fontScale = 2;

    render(
      <SearchBar
        testID="journal.search"
        inputTestID="journal-search-input"
        onChangeText={jest.fn()}
        placeholder="Search your dream journey..."
        value=""
      />,
    );

    const row = screen.getByTestId('journal.search');
    const input = screen.getByTestId('journal-search-input');
    const rowStyle = JSON.parse(row.getAttribute('data-style') ?? '{}') as {
      minHeight: number;
      paddingVertical: number;
    };
    const inputStyle = JSON.parse(input.getAttribute('data-style') ?? '{}') as {
      minHeight: number;
    };

    expect(rowStyle.minHeight).toBe(72);
    expect(rowStyle.paddingVertical).toBe(16);
    expect(inputStyle.minHeight).toBe(40);
    expect(rowStyle.minHeight).toBeGreaterThan(inputStyle.minHeight);
    expect(input.getAttribute('data-allow-font-scaling')).toBeNull();
    expect(input.getAttribute('class')).toContain('min-w-0');
    expect(input.getAttribute('class')).toContain('flex-1');
    expect(row.getAttribute('class')).toContain('overflow-visible');
  });
});
