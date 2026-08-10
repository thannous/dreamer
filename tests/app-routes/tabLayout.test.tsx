/* @jest-environment jsdom */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockUseAuth = jest.fn();
let capturedTabBarStyle: unknown = null;
let mockPlatformOS: 'android' | 'ios' | 'web' = 'ios';
let mockWindowWidth = 390;
let mockWindowHeight = 844;
let mockFontScale = 1;
let mockRouteCommitted = true;
let mockSegments: string[] = ['(tabs)', 'index'];

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
  const TabsScreen = ({
    options,
  }: {
    options?: { tabBarIcon?: (state: { focused: boolean }) => React.ReactNode };
  }) => <div>{options?.tabBarIcon?.({ focused: false })}</div>;
  TabsScreen.displayName = 'MockTabsScreen';
  Tabs.Screen = TabsScreen;

  return {
    Tabs,
    router: { push: jest.fn() },
    useSegments: () => mockSegments,
  };
});

jest.doMock('react-native', () => {
  const flattenStyle = (style: unknown): Record<string, unknown> => {
    if (Array.isArray(style)) {
      return Object.assign({}, ...style.filter(Boolean).map(flattenStyle));
    }
    return style && typeof style === 'object' ? style as Record<string, unknown> : {};
  };

  return {
    Platform: {
      get OS() {
        return mockPlatformOS;
      },
    },
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
      flatten: flattenStyle,
    },
    Text: ({
      children,
      maxFontSizeMultiplier,
      style,
    }: {
      children?: React.ReactNode;
      maxFontSizeMultiplier?: number;
      style?: unknown;
    }) => (
      <span
        data-max-font-size-multiplier={maxFontSizeMultiplier}
        data-native-style={JSON.stringify(flattenStyle(style))}
      >
        {children}
      </span>
    ),
    View: ({ children, style }: { children?: React.ReactNode; style?: unknown }) => (
      <div data-native-style={JSON.stringify(flattenStyle(style))}>{children}</div>
    ),
    useWindowDimensions: () => ({
      width: mockWindowWidth,
      height: mockWindowHeight,
      scale: 1,
      fontScale: mockFontScale,
    }),
  };
});

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

jest.doMock('@/context/StartupRouteContext', () => ({
  useStartupRoute: () => ({ routeCommitted: mockRouteCommitted }),
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
    mockPlatformOS = 'ios';
    mockWindowWidth = 390;
    mockWindowHeight = 844;
    mockFontScale = 1;
    mockRouteCommitted = true;
    mockSegments = ['(tabs)', 'index'];
  });

  it('does not mount the animated tab navigator during the startup redirect', () => {
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });
    mockRouteCommitted = false;

    render(<TabLayout />);

    expect(capturedTabBarStyle).toBeNull();
  });

  it('keeps the transient tab route static after another root route is committed', () => {
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });
    mockSegments = ['onboarding'];

    render(<TabLayout />);

    expect(capturedTabBarStyle).toBeNull();
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
      end: 22,
      height: 86,
      position: 'absolute',
      start: 22,
    }));
    expect(capturedTabBarStyle).not.toEqual(expect.objectContaining({
      left: expect.anything(),
      width: expect.anything(),
    }));
  });

  it('centers and bounds the tab bar on a wide Android window', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 1280;
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });

    render(<TabLayout />);

    expect(capturedTabBarStyle).toEqual(expect.objectContaining({
      end: 160,
      start: 160,
    }));
    expect(capturedTabBarStyle).not.toEqual(expect.objectContaining({
      left: expect.anything(),
      width: expect.anything(),
    }));
  });

  it.each([1, 1.3, 2])(
    'uses constrained 11 sp labels and a 64 by 68 dp center action at 320 dp with font scale %s',
    (fontScale: number) => {
      mockPlatformOS = 'android';
      mockWindowWidth = 320;
      mockWindowHeight = 640;
      mockFontScale = fontScale;
      mockUseAuth.mockReturnValue({ returningGuestBlocked: false });

      render(<TabLayout />);

      expect(capturedTabBarStyle).toEqual(expect.objectContaining({
        end: 8,
        height: 86,
        paddingHorizontal: 4,
        start: 8,
      }));

      const labels = [
        'nav.home',
        'nav.journal',
        'nav.capture_dream',
        'nav.stats',
        'nav.settings',
      ].map((label) => screen.getByText(label));
      const centerStyle = screen.getByText('nav.capture_dream').parentElement?.getAttribute(
        'data-native-style'
      );

      expect(centerStyle).toContain('"width":64');
      expect(centerStyle).toContain('"height":68');
      labels.forEach((label) => {
        expect(label.getAttribute('data-max-font-size-multiplier')).toBe('1.3');
        expect(label.getAttribute('data-native-style')).toContain('"fontSize":11');
        expect(label.getAttribute('data-native-style')).toContain('"width":"100%"');
        expect(label.getAttribute('data-native-style')).toContain('"flexShrink":1');
      });
    }
  );

  it('preserves the existing tab geometry at 390 dp', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 390;
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });

    render(<TabLayout />);

    const centerLabel = screen.getByText('nav.capture_dream');
    const centerStyle = centerLabel.parentElement?.getAttribute('data-native-style');

    expect(capturedTabBarStyle).toEqual(expect.objectContaining({
      end: 22,
      paddingHorizontal: 8,
      start: 22,
    }));
    expect(centerStyle).toContain('"width":72');
    expect(centerStyle).toContain('"height":76');
    expect(centerLabel.getAttribute('data-native-style')).toContain('"fontSize":12');
    expect(centerLabel.getAttribute('data-max-font-size-multiplier')).toBeNull();
  });
});
