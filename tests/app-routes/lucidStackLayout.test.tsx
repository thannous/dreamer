/* @jest-environment jsdom */

import React from 'react';
import { cleanup, render } from '@testing-library/react';

let mockOnboardingStatus: 'not_started' | 'completed' = 'not_started';
let mockReduceMotion = false;
let mockStackProps: {
  initialRouteName?: string;
  screenOptions?: { animation?: string };
} = {};
let mockProtectedGuards: boolean[] = [];

jest.mock('expo-router', () => {
  const Stack = ({
    children,
    initialRouteName,
    screenOptions,
  }: {
    children?: React.ReactNode;
    initialRouteName?: string;
    screenOptions?: { animation?: string };
  }) => {
    mockStackProps = { initialRouteName, screenOptions };
    return <nav>{children}</nav>;
  };
  const StackScreen = ({ name }: { name: string }) => <div data-testid={`screen-${name}`} />;
  StackScreen.displayName = 'MockLucidStackScreen';
  const StackProtected = ({
    children,
    guard,
  }: {
    children?: React.ReactNode;
    guard: boolean;
  }) => {
    mockProtectedGuards.push(guard);
    return <>{children}</>;
  };
  StackProtected.displayName = 'MockLucidStackProtected';
  Stack.Screen = StackScreen;
  Stack.Protected = StackProtected;
  return { Stack };
});

jest.mock('react-native', () => ({
  ActivityIndicator: () => <span />,
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  LucidButton: ({ label }: { label: string }) => <button>{label}</button>,
}));

jest.mock('@/constants/lucidTheme', () => ({
  getLucidPalette: () => ({
    accent: '#7654d4',
    background: '#f6f3ff',
    danger: '#b42318',
    textSecondary: '#555',
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'light' }),
}));

jest.mock('@/context/LucidTrainerContext', () => ({
  LucidTrainerProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useLucidTrainer: () => ({
    state: { onboarding: { status: mockOnboardingStatus } },
    content: { chrome: { common: { retry: 'Retry' } } },
    loading: false,
    error: null,
    reload: jest.fn(),
  }),
}));

jest.mock('@/hooks/useLucidReducedMotion', () => ({
  useLucidReducedMotion: () => mockReduceMotion,
}));

const { default: LucidLayout } = require('@/app/lucid/_layout');

describe('Lucid stack layout', () => {
  beforeEach(() => {
    mockOnboardingStatus = 'not_started';
    mockReduceMotion = false;
    mockStackProps = {};
    mockProtectedGuards = [];
  });

  afterEach(cleanup);

  it('guards onboarding and trainer routes declaratively', () => {
    const view = render(<LucidLayout />);

    expect(mockStackProps.initialRouteName).toBe('onboarding');
    expect(mockProtectedGuards).toEqual([true, false]);

    mockOnboardingStatus = 'completed';
    mockProtectedGuards = [];
    view.rerender(<LucidLayout />);

    expect(mockStackProps.initialRouteName).toBe('(tabs)');
    expect(mockProtectedGuards).toEqual([false, true]);
  });

  it('uses only the native-stack fade when motion is reduced', () => {
    mockReduceMotion = true;
    render(<LucidLayout />);

    expect(mockStackProps.screenOptions?.animation).toBe('fade');
  });
});
