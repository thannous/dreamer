/* @jest-environment jsdom */

import React from 'react';
import { render } from '@testing-library/react';

let mockNavigatorOptions: { animation?: string } | undefined;

jest.mock('expo-router', () => {
  const Tabs = ({
    children,
    screenOptions,
  }: {
    children?: React.ReactNode;
    screenOptions?: { animation?: string };
  }) => {
    mockNavigatorOptions = screenOptions;
    return <nav>{children}</nav>;
  };
  const TabsScreen = ({ name }: { name: string }) => <div data-testid={`screen-${name}`} />;
  TabsScreen.displayName = 'MockLucidTabsScreen';
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

jest.mock('@/constants/lucidTheme', () => ({
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
  useTheme: () => ({ colors: {}, mode: 'light' }),
}));

jest.mock('@/context/LucidTrainerContext', () => ({
  useLucidTrainer: () => ({
    content: {
      chrome: {
        tabs: {
          today: 'Today',
          programs: 'Programs',
          night: 'Night',
          progress: 'Progress',
          settings: 'Settings',
        },
      },
    },
  }),
}));

const { default: LucidTabsLayout } = require('@/app/lucid/(tabs)/_layout');

describe('Lucid tabs motion', () => {
  it('does not pin an explicit tab animation', () => {
    render(<LucidTabsLayout />);
    expect(mockNavigatorOptions?.animation).toBeUndefined();
    expect('animation' in (mockNavigatorOptions ?? {})).toBe(false);
  });
});
