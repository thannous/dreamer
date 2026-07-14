/* @jest-environment jsdom */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockUseAuth = jest.fn();
let capturedTabBarStyle: unknown = null;

afterEach(cleanup);

jest.doMock('expo-router', () => {
  const Tabs = ({
    children,
    screenOptions,
  }: {
    children?: React.ReactNode;
    screenOptions?: { tabBarStyle?: unknown };
  }) => {
    capturedTabBarStyle = screenOptions?.tabBarStyle ?? null;
    return <div>{children}</div>;
  };
  const TabsScreen = () => null;
  TabsScreen.displayName = 'MockTabsScreen';
  Tabs.Screen = TabsScreen;

  return {
    Tabs,
    router: { push: jest.fn() },
  };
});

jest.doMock('react-native', () => ({
  Platform: { OS: 'ios' },
  StyleSheet: { create: <T extends Record<string, unknown>>(styles: T) => styles },
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
}));

jest.doMock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
}));

jest.doMock('@/components/haptic-tab', () => ({
  HapticTab: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
}));

jest.doMock('@/components/navigation/DesktopSidebar', () => ({
  DesktopSidebar: () => <aside />,
}));

jest.doMock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => <span />,
}));

jest.doMock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    action: {
      primary: '#9a6332',
      primaryBorder: '#b98a60',
      primaryText: '#fff',
    },
    nav: {
      active: '#231f2d',
      background: '#fff',
      border: '#ddd',
      inactive: '#777',
    },
    screen: { background: '#faf8f3' },
  }),
}));

jest.doMock('@/constants/theme', () => ({
  Fonts: {
    spaceGrotesk: { bold: 'SpaceGrotesk-Bold', medium: 'SpaceGrotesk-Medium' },
  },
}));

jest.doMock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.doMock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'light' }),
}));

jest.doMock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { default: TabLayout } = require('@/app/(tabs)/_layout');

describe('TabLayout returning guest navigation', () => {
  beforeEach(() => {
    capturedTabBarStyle = null;
  });

  it('hides the entire bottom navigation while authentication is required', () => {
    mockUseAuth.mockReturnValue({ returningGuestBlocked: true });

    render(<TabLayout />);

    expect(capturedTabBarStyle).toEqual({ display: 'none' });
  });

  it('keeps the floating bottom navigation for an active session', () => {
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });

    render(<TabLayout />);

    expect(capturedTabBarStyle).toEqual(expect.objectContaining({
      bottom: 34,
      height: 86,
      position: 'absolute',
    }));
  });
});
