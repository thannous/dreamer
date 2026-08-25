/* @jest-environment jsdom */

import { render, screen } from '@testing-library/react';
import React from 'react';

const mockReplace = jest.fn();
const layoutHarness = {
  reduceMotion: false,
  onboardingStatus: 'completed' as 'not_started' | 'in_progress' | 'completed',
};
let capturedScreenOptions: { animation?: string } | undefined;
const capturedGuards: { guard: boolean; names: string[] }[] = [];

jest.mock('expo-router', () => {
  const React = require('react');
  const Stack = ({
    children,
    screenOptions,
  }: {
    children?: React.ReactNode;
    screenOptions?: { animation?: string };
  }) => {
    capturedScreenOptions = screenOptions;
    return <div>{children}</div>;
  };
  function MockStackScreen({ name }: { name: string }) {
    return <div data-testid={`screen-${name}`} />;
  }
  function MockProtected({
    guard,
    children,
  }: {
    guard: boolean;
    children?: React.ReactNode;
  }) {
    const names = React.Children.toArray(children).flatMap((child: unknown) => {
      if (!React.isValidElement(child)) return [];
      const name = (child.props as { name?: string }).name;
      return name ? [name] : [];
    });
    capturedGuards.push({ guard, names });
    return guard ? <>{children}</> : null;
  }
  Stack.Screen = MockStackScreen;
  Stack.Protected = MockProtected;
  return {
    Stack,
    router: { replace: (...args: unknown[]) => mockReplace(...args) },
    useGlobalSearchParams: () => ({}),
  };
});

jest.mock('@/constants/lucidTheme', () => ({
  ...jest.requireActual('@/constants/lucidTheme'),
  getLucidPalette: () => ({
    accent: '#7654d4',
    background: '#0c1224',
    danger: '#b42318',
    textSecondary: '#889',
  }),
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  LucidButton: () => <button type="button">retry</button>,
}));

jest.mock('@/context/ThemeContext', () => ({
  ThemeAmbienceScope: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useTheme: () => ({ ambience: 'dark', colors: {}, mode: 'dark' }),
}));

jest.mock('@/lib/themeAmbience', () => ({
  isThemeAmbience: () => false,
}));

jest.mock('@/context/LucidTrainerContext', () => ({
  LucidTrainerProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useLucidTrainer: () => ({
    state: {
      onboarding: {
        get status() {
          return layoutHarness.onboardingStatus;
        },
        accessibility: { reduceMotion: false },
      },
    },
    content: { chrome: { common: { retry: 'Retry' } } },
    loading: false,
    error: null,
    reload: jest.fn(),
  }),
}));

jest.mock('@/hooks/useLucidReducedMotion', () => ({
  useLucidReducedMotion: () => layoutHarness.reduceMotion,
}));

const { default: LucidLayout } = require('@/app/lucid/_layout');

function resetHarness() {
  layoutHarness.reduceMotion = false;
  layoutHarness.onboardingStatus = 'completed';
  capturedScreenOptions = undefined;
  capturedGuards.length = 0;
  mockReplace.mockClear();
}

describe('Lucid stack layout motion', () => {
  beforeEach(() => {
    resetHarness();
  });

  it('keeps the native default push when motion is allowed', () => {
    render(<LucidLayout />);
    expect(capturedScreenOptions?.animation).toBe('default');
  });

  it('fades native stack transitions when motion is reduced', () => {
    layoutHarness.reduceMotion = true;
    render(<LucidLayout />);
    expect(capturedScreenOptions?.animation).toBe('fade');
  });
});

describe('Lucid stack onboarding protection', () => {
  beforeEach(() => {
    resetHarness();
  });

  it('never calls router.replace from the layout', () => {
    layoutHarness.onboardingStatus = 'not_started';
    render(<LucidLayout />);
    expect(mockReplace).not.toHaveBeenCalled();

    layoutHarness.onboardingStatus = 'completed';
    render(<LucidLayout />);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('exposes only onboarding while the trainer is incomplete', () => {
    layoutHarness.onboardingStatus = 'not_started';
    render(<LucidLayout />);
    expect(screen.getByTestId('screen-onboarding')).toBeTruthy();
    expect(screen.queryByTestId('screen-(tabs)')).toBeNull();
    expect(capturedGuards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ guard: true, names: ['onboarding'] }),
        expect.objectContaining({ guard: false, names: expect.arrayContaining(['(tabs)']) }),
      ])
    );
  });

  it('exposes tabs and deep links once onboarding is completed', () => {
    layoutHarness.onboardingStatus = 'completed';
    render(<LucidLayout />);
    expect(screen.queryByTestId('screen-onboarding')).toBeNull();
    expect(screen.getByTestId('screen-(tabs)')).toBeTruthy();
    expect(screen.getByTestId('screen-program/[id]')).toBeTruthy();
    expect(capturedGuards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ guard: false, names: ['onboarding'] }),
        expect.objectContaining({ guard: true, names: expect.arrayContaining(['(tabs)']) }),
      ])
    );
  });
});
