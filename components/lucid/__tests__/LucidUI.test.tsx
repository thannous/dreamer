/* @jest-environment jsdom */

import { fireEvent, render } from '@testing-library/react';
import React from 'react';

const mockUseLucidReducedMotion = jest.fn(() => false);

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span />,
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('react-native', () => {
  const React = require('react');
  const actual = jest.requireActual('../../../tests/react-native-stub');
  return {
    ...actual,
    Pressable: ({
      children,
      onPress,
      disabled,
      testID,
      accessibilityHint,
      accessibilityLabel,
      style,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      disabled?: boolean;
      testID?: string;
      accessibilityHint?: string;
      accessibilityLabel?: string;
      style?: unknown | ((state: { pressed: boolean }) => unknown);
    }) => {
      const resolve = (pressed: boolean) =>
        typeof style === 'function' ? style({ pressed }) : style;
      return React.createElement(
        'button',
        {
          'data-testid': testID,
          disabled,
          'data-accessibility-hint': accessibilityHint,
          'data-accessibility-label': accessibilityLabel,
          'data-pressed-style': JSON.stringify(resolve(true)),
          onClick: disabled ? undefined : onPress,
        },
        children
      );
    },
  };
});

jest.mock('@/components/ScreenContainer', () => ({
  ScreenContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/constants/lucidTheme', () => ({
  getLucidPalette: () => ({
    accent: '#7654d4',
    accentSoft: '#eee8ff',
    accentStrong: '#4f2fa8',
    amber: '#9a6200',
    amberSoft: '#fff2ce',
    background: '#fff',
    backgroundDeep: '#111',
    border: '#ccc',
    cyan: '#087f8c',
    cyanSoft: '#e4f7f7',
    danger: '#b42318',
    surface: '#fff',
    surfaceRaised: '#f4f4f4',
    text: '#111',
    textMuted: '#777',
    textSecondary: '#555',
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'light' }),
}));

jest.mock('@/hooks/useLucidReducedMotion', () => ({
  useLucidReducedMotion: () => mockUseLucidReducedMotion(),
}));

const { LucidButton, LucidCard } = require('../LucidUI');

const flatten = (style: unknown): Record<string, unknown> => {
  if (!style) return {};
  if (typeof style === 'string') {
    try {
      return flatten(JSON.parse(style));
    } catch {
      return {};
    }
  }
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, item) => ({ ...acc, ...flatten(item) }), {});
  }
  return style as Record<string, unknown>;
};

describe('LucidCard press feedback', () => {
  beforeEach(() => {
    mockUseLucidReducedMotion.mockReturnValue(false);
  });

  it('keeps a light scale when motion is allowed', () => {
    const { getByTestId } = render(
      <LucidCard onPress={() => {}} testID="lucid-card">
        Card
      </LucidCard>
    );

    const pressed = flatten(getByTestId('lucid-card').getAttribute('data-pressed-style'));
    expect(pressed.opacity).toBe(0.82);
    expect(pressed.transform).toEqual([{ scale: 0.992 }]);
  });

  it('drops scale and keeps opacity when motion is reduced', () => {
    mockUseLucidReducedMotion.mockReturnValue(true);
    const onPress = jest.fn();
    const { getByTestId } = render(
      <LucidCard accessibilityLabel="Open program" onPress={onPress} testID="lucid-card">
        Card
      </LucidCard>
    );

    const card = getByTestId('lucid-card');
    const pressed = flatten(card.getAttribute('data-pressed-style'));
    expect(card.getAttribute('data-accessibility-label')).toBe('Open program');
    expect(pressed.opacity).toBe(0.82);
    expect(pressed.transform).toBeUndefined();
    fireEvent.click(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('LucidButton disabledReason', () => {
  it('uses disabledReason as the accessibility hint and inline copy when none is provided', () => {
    const { getByTestId, getByText } = render(
      <LucidButton
        disabled
        disabledReason="Finish onboarding first"
        label="Continue"
        onPress={() => {}}
        testID="lucid-button"
      />
    );

    expect(getByTestId('lucid-button').getAttribute('data-accessibility-hint')).toBe(
      'Finish onboarding first'
    );
    expect(getByText('Finish onboarding first')).toBeTruthy();
  });

  it('does not duplicate an explicit accessibilityHint as inline copy', () => {
    const { getByTestId, queryByText } = render(
      <LucidButton
        accessibilityHint="Opens the weekly review"
        disabled
        disabledReason="Finish onboarding first"
        label="Continue"
        onPress={() => {}}
        testID="lucid-button"
      />
    );

    expect(getByTestId('lucid-button').getAttribute('data-accessibility-hint')).toBe(
      'Opens the weekly review'
    );
    expect(queryByText('Finish onboarding first')).toBeNull();
  });

  it('hides disabledReason when the button is enabled', () => {
    const { getByTestId, queryByText } = render(
      <LucidButton
        disabledReason="Finish onboarding first"
        label="Continue"
        onPress={() => {}}
        testID="lucid-button"
      />
    );

    expect(getByTestId('lucid-button').getAttribute('data-accessibility-hint')).toBeNull();
    expect(queryByText('Finish onboarding first')).toBeNull();
  });
});
