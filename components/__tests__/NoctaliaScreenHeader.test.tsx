/* @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';

import { NoctaliaScreenHeader } from '@/components/NoctaliaScreenHeader';

let mockWidth = 375;
let mockFontScale = 1;

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
    useWindowDimensions: () => ({ width: mockWidth, height: 812, scale: 1, fontScale: mockFontScale }),
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
  mockWidth = 375;
  mockFontScale = 1;
});

const nativeStyle = (element: Element | null) => {
  const styles = JSON.parse(element?.getAttribute('data-flex-shrink') ?? '{}');
  return Array.isArray(styles) ? Object.assign({}, ...styles.filter(Boolean)) : styles;
};

describe('NoctaliaScreenHeader responsive actions', () => {
  it.each([
    [320, 1, 3, true],
    [375, 1, 3, true],
    [375, 1, 2, false],
    [390, 1, 3, false],
    [430, 1, 3, false],
    [480, 1, 3, false],
    [1024, 1, 3, false],
    [320, 1.3, 1, true],
    [390, 1.3, 3, true],
    [430, 2, 3, true],
    [1024, 2, 3, true],
    [390, 2, 0, false],
  ])('adapts width %i, font scale %s and %i actions (stacked=%s)', (width: number, fontScale: number, actionCount: number, stacked: boolean) => {
    mockWidth = width;
    mockFontScale = fontScale;
    const actions = Array.from({ length: actionCount }, (_, index) => ({
      icon: 'sparkles' as const,
      accessibilityLabel: `Action ${index + 1}`,
      onPress: jest.fn(),
    }));
    render(<NoctaliaScreenHeader titleKey="nav.home" actions={actions} />);

    const brand = screen.getByText('Noctalia');
    const subtitle = screen.getByText('nav.home');
    const titleBlock = brand.parentElement;
    const titleRow = titleBlock?.parentElement ?? null;
    expect(nativeStyle(titleRow).flexDirection).toBe(stacked ? 'column' : 'row');
    expect(nativeStyle(titleRow).paddingHorizontal).toBe(width < 480 ? 16 : 24);
    expect(nativeStyle(titleBlock).flex).toBe(stacked ? 0 : 1);
    if (stacked) expect(nativeStyle(titleBlock).width).toBe('100%');
    [brand, subtitle].forEach((text) => {
      expect(text.getAttribute('data-number-of-lines')).toBe(stacked ? null : '1');
    });
    actions.forEach((action) => {
      const button = screen.getByRole('button', { name: action.accessibilityLabel });
      expect(nativeStyle(button).width).toBe(width < 480 ? 52 : 60);
      expect(nativeStyle(button).height).toBe(width < 480 ? 52 : 60);
      expect(nativeStyle(button.parentElement).gap).toBe(width < 480 ? 8 : 16);
      expect(nativeStyle(button.parentElement).flexWrap).toBe(stacked ? 'wrap' : undefined);
      fireEvent.click(button);
      expect(action.onPress).toHaveBeenCalledTimes(1);
    });
  });
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
