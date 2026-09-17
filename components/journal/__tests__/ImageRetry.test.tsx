/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { TID } from '@/lib/testIDs';

jest.mock('react-native', () => {
  const React = require('react');
  const toDomProps = (props: Record<string, unknown>) => {
    const { testID, onPress, accessibilityRole, accessibilityLabel, disabled, style, ...rest } = props;
    return {
      ...rest,
      ...(testID ? { 'data-testid': testID } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}),
      ...(disabled ? { disabled: true } : {}),
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
    ActivityIndicator: () => <span data-testid="activity-indicator" />,
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
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    text: { secondary: '#aaa' },
    status: { danger: { icon: '#f66' } },
    action: { primaryText: '#111' },
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      textPrimary: '#fff',
      textSecondary: '#aaa',
      textOnAccentSurface: '#111',
    },
    mode: 'dark',
    shadows: { lg: {} },
  }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('ImageRetry', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps retry available after a failed image job', () => {
    const onRetry = jest.fn();
    const { ImageRetry } = require('../ImageRetry');

    render(<ImageRetry onRetry={onRetry} />);

    expect(screen.getByText('image_retry.generation_failed')).toBeTruthy();
    fireEvent.click(screen.getByTestId(TID.Button.JournalImageRetry));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('disables retry while a new illustration request is in flight', () => {
    const onRetry = jest.fn();
    const { ImageRetry } = require('../ImageRetry');

    render(<ImageRetry onRetry={onRetry} isRetrying />);

    expect(screen.getByText('image_retry.generating')).toBeTruthy();
    expect((screen.getByTestId(TID.Button.JournalImageRetry) as HTMLButtonElement).disabled).toBe(true);
  });
});
