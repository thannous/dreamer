/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { TID } from '@/lib/testIDs';

jest.mock('react-native', () => {
  const React = require('react');
  const toDomProps = (props: Record<string, unknown>) => {
    const {
      testID,
      onPress,
      accessibilityRole,
      accessibilityLabel,
      style,
      ...rest
    } = props;
    return {
      ...rest,
      ...(testID ? { 'data-testid': testID } : {}),
      ...(onPress ? { onClick: onPress } : {}),
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
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
      hairlineWidth: 1,
    },
    Text: createElement('span'),
    View: createElement('div'),
  };
});

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: ({ children, ...props }: { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

jest.mock('react-native-svg', () => {
  const React = require('react');
  const Svg = ({ children }: { children?: React.ReactNode }) => <svg>{children}</svg>;
  return {
    __esModule: true,
    default: Svg,
    Circle: () => <circle />,
    Path: () => <path />,
  };
});

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      accent: '#6f62b5',
      textOnAccentSurface: '#fff',
      textPrimary: '#121022',
      textSecondary: '#57516f',
      textTertiary: '#8f88a6',
    },
  }),
}));

jest.mock('@/hooks/useJournalAnimations', () => ({
  useFadeInUp: () => ({}),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('EmptyState', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows a remembered dream CTA for a truly empty journal', () => {
    const onStartRememberedDream = jest.fn();
    const { EmptyState } = require('../EmptyState');

    render(
      <EmptyState
        hasActiveFilter={false}
        onStartRememberedDream={onStartRememberedDream}
      />
    );

    expect(screen.getByText('journal.empty.default')).toBeTruthy();
    expect(screen.getByText('journal.empty.remembered_hint')).toBeTruthy();

    fireEvent.click(screen.getByTestId(TID.Button.EmptyStartRememberedDream));

    expect(onStartRememberedDream).toHaveBeenCalledTimes(1);
  });

  it('does not show the remembered dream CTA when filters are hiding dreams', () => {
    const onClearFilters = jest.fn();
    const onStartRememberedDream = jest.fn();
    const { EmptyState } = require('../EmptyState');

    render(
      <EmptyState
        hasActiveFilter
        onClearFilters={onClearFilters}
        onStartRememberedDream={onStartRememberedDream}
      />
    );

    expect(screen.getByText('journal.empty.filtered')).toBeTruthy();
    expect(screen.queryByTestId(TID.Button.EmptyStartRememberedDream)).toBeNull();

    fireEvent.click(screen.getByTestId(TID.Button.EmptyClearFilters));

    expect(onClearFilters).toHaveBeenCalledTimes(1);
    expect(onStartRememberedDream).not.toHaveBeenCalled();
  });
});
