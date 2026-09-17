/* @jest-environment jsdom */

import React from 'react';
import { cleanup, render } from '@testing-library/react';

type NavigatorOptions = {
  animation?: string;
  sceneStyleInterpolator?: unknown;
  transitionSpec?: unknown;
  animationEnabled?: boolean;
};

type ScreenOptions = {
  tabBarIcon?: (args: { color: string; focused: boolean }) => React.ReactNode;
};

const mockScreenOptions = new Map<string, ScreenOptions>();
let mockNavigatorOptions: NavigatorOptions | undefined;
const mockUseTheme = jest.fn(() => ({ colors: {}, mode: 'light' }));

afterEach(() => {
  cleanup();
  mockScreenOptions.clear();
  mockNavigatorOptions = undefined;
  mockUseTheme.mockClear();
});

jest.mock('expo-router', () => {
  const Tabs = ({
    children,
    screenOptions,
  }: {
    children?: React.ReactNode;
    screenOptions?: NavigatorOptions;
  }) => {
    mockNavigatorOptions = screenOptions;
    return <nav>{children}</nav>;
  };
  const TabsScreen = ({ name, options }: { name: string; options: ScreenOptions }) => {
    mockScreenOptions.set(name, options);
    return <div data-testid={`screen-${name}`} />;
  };
  Tabs.Screen = TabsScreen;
  return { Tabs };
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span />,
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));

jest.mock('@/components/haptic-tab', () => ({
  HapticTab: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
}));

jest.mock('@/components/lucid/LucidGlass', () => ({
  LucidGlass: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/constants/lucidTheme', () => ({
  ...jest.requireActual('@/constants/lucidTheme'),
  getLucidPalette: () => ({
    accentStrong: '#4f2fa8',
    background: '#f6f3ff',
    border: '#d8cff3',
    overlay: '#fff',
    text: '#201a35',
    textMuted: '#736d82',
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('@/context/LucidTrainerContext', () => ({
  useLucidTrainer: () => ({
    content: {
      chrome: {
        tabs: {
          today: 'Today',
          journal: 'Journal',
          programs: 'Journeys',
          night: 'Night',
          progress: 'Insights',
          settings: 'Profile',
        },
      },
    },
  }),
}));

const { default: LucidTabsLayout } = require('@/app/lucid/(tabs)/_layout');

describe('Lucid tabs motion', () => {
  it('leaves tab animation to the navigator default so setOptions cannot loop on Android', () => {
    render(<LucidTabsLayout />);
    expect(mockNavigatorOptions).toBeDefined();
    expect(mockNavigatorOptions).not.toHaveProperty('animation');
    expect(mockNavigatorOptions).not.toHaveProperty('sceneStyleInterpolator');
    expect(mockNavigatorOptions).not.toHaveProperty('transitionSpec');
    expect(mockNavigatorOptions).not.toHaveProperty('animationEnabled');
  });

  it('does not read ThemeContext from tabBarIcon, matching the working main navigator', () => {
    render(<LucidTabsLayout />);
    const layoutThemeReads = mockUseTheme.mock.calls.length;
    expect(layoutThemeReads).toBeGreaterThan(0);

    const visibleOptions = [...mockScreenOptions.values()].filter(
      (options) => typeof options.tabBarIcon === 'function'
    );
    expect(visibleOptions).toHaveLength(4);
    for (const options of visibleOptions) {
      render(<>{options.tabBarIcon?.({ color: '#111', focused: true })}</>);
      render(<>{options.tabBarIcon?.({ color: '#777', focused: false })}</>);
    }

    expect(mockUseTheme.mock.calls.length).toBe(layoutThemeReads);
  });
});
