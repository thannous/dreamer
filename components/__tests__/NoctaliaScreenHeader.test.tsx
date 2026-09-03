/* @jest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';

import { NoctaliaScreenHeader } from '@/components/NoctaliaScreenHeader';

jest.mock('react-native', () => {
  const React = require('react');
  const toDomProps = (props: Record<string, unknown>) => {
    const {
      testID,
      onPress,
      accessibilityRole,
      accessibilityLabel,
      numberOfLines,
      style,
      ...rest
    } = props;
    return {
      ...rest,
      ...(testID ? { 'data-testid': testID } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}),
      ...(typeof numberOfLines === 'number' ? { 'data-number-of-lines': String(numberOfLines) } : {}),
      ...(style ? {
        'data-flex-shrink': JSON.stringify(
          typeof style === 'function' ? style({ pressed: false }) : style
        ),
      } : {}),
    };
  };
  const createElement = (tag: string) => {
    const MockNativeElement = ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => React.createElement(tag, toDomProps(props), children);
    MockNativeElement.displayName = `MockNative${tag}`;
    return MockNativeElement;
  };

  return {
    Platform: {
      OS: 'web',
      select: (options: Record<string, unknown>) => options.web ?? options.default,
    },
    Pressable: createElement('button'),
    ScrollView: createElement('div'),
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
    },
    Text: createElement('span'),
    View: createElement('div'),
    useWindowDimensions: () => ({ width: 375, height: 812, scale: 1, fontScale: 1 }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => null,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {},
    mode: 'light',
  }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    action: {
      primary: '#d4a574',
      primaryBorder: '#ead4b4',
      primaryText: '#4a2f1b',
    },
    surface: {
      border: '#ddd',
      soft: '#fff8ef',
    },
    text: {
      primary: '#21180f',
      secondary: '#6b6880',
    },
  }),
}));

afterEach(() => {
  cleanup();
});

describe('NoctaliaScreenHeader chips', () => {
  it('keeps atlas filter labels intact instead of ellipsizing them', () => {
    render(
      <NoctaliaScreenHeader
        titleKey="nav.journal"
        chips={[
          {
            id: 'to-explore',
            label: 'To explore',
            icon: 'sparkles',
            active: false,
            onPress: jest.fn(),
          },
          {
            id: 'nightmares',
            label: 'Nightmares',
            icon: 'moon.stars.fill',
            active: false,
            onPress: jest.fn(),
          },
        ]}
      />
    );

    const toExplore = screen.getByText('To explore');
    const nightmares = screen.getByText('Nightmares');

    expect(toExplore.getAttribute('data-number-of-lines')).toBeNull();
    expect(nightmares.getAttribute('data-number-of-lines')).toBeNull();
    expect(toExplore.getAttribute('data-flex-shrink')).toContain('"flexShrink":0');
  });

  it('keeps filter chips at least 44 dp tall', () => {
    render(
      <NoctaliaScreenHeader
        titleKey="nav.journal"
        chips={[
          {
            id: 'to-explore',
            label: 'To explore',
            icon: 'sparkles',
            active: false,
            onPress: jest.fn(),
          },
        ]}
      />
    );

    const chip = screen.getByRole('button', { name: 'To explore' });
    expect(chip.getAttribute('data-flex-shrink') ?? '').toContain('"minHeight":44');
  });
});
