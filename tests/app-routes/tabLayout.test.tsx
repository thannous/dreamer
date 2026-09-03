/* @jest-environment jsdom */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockUseAuth = jest.fn();
let capturedTabBarStyle: unknown = null;
type CapturedTabScreen = {
  name?: string;
  options?: {
    href?: unknown;
    title?: string;
    tabBarButton?: (props: Record<string, unknown>) => React.ReactNode;
    tabBarIcon?: (state: { focused: boolean }) => React.ReactNode;
  };
};
let capturedScreens: CapturedTabScreen[] = [];
let mockPlatformOS: 'android' | 'ios' | 'web' = 'ios';
let mockWindowWidth = 390;
let mockWindowHeight = 844;
let mockFontScale = 1;
let mockRouteCommitted = true;
let mockSegments: string[] = ['(tabs)', 'index'];
let mockActiveAnalysis: { dreamId: number } | null = null;

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
    name,
    options,
  }: {
    name?: string;
    options?: { tabBarIcon?: (state: { focused: boolean }) => React.ReactNode };
  }) => {
    capturedScreens.push({ name, options });
    return <div data-screen-name={name}>{options?.tabBarIcon?.({ focused: false })}</div>;
  };
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
    // `className` is resolved by Uniwind's Metro transformer, which Jest never runs, so
    // it arrives here as an inert string. Exposing it lets these tests keep asserting the
    // exact geometry — the pixel values now live in the class string instead of the
    // resolved style object, and are just as explicit there.
    Text: ({
      children,
      maxFontSizeMultiplier,
      numberOfLines,
      style,
      className,
      accessible,
    }: {
      children?: React.ReactNode;
      maxFontSizeMultiplier?: number;
      numberOfLines?: number;
      style?: unknown;
      className?: string;
      accessible?: boolean;
    }) => (
      <span
        data-max-font-size-multiplier={maxFontSizeMultiplier}
        data-number-of-lines={numberOfLines}
        data-accessible={accessible === false ? 'false' : undefined}
        data-native-style={JSON.stringify(flattenStyle(style))}
        data-native-class={className}
      >
        {children}
      </span>
    ),
    View: ({
      children,
      style,
      className,
      accessible,
      importantForAccessibility,
    }: {
      children?: React.ReactNode;
      style?: unknown;
      className?: string;
      accessible?: boolean;
      importantForAccessibility?: string;
    }) => (
      <div
        data-native-style={JSON.stringify(flattenStyle(style))}
        data-native-class={className}
        data-accessible={accessible === false ? 'false' : undefined}
        data-important-for-accessibility={importantForAccessibility}
      >
        {children}
      </div>
    ),
    useWindowDimensions: () => ({
      width: mockWindowWidth,
      height: mockWindowHeight,
      scale: 1,
      fontScale: mockFontScale,
    }),
    ActivityIndicator: () => <span data-testid="tab-analysis-busy" />,
  };
});

jest.doMock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
}));

jest.doMock('@/components/haptic-tab', () => ({
  HapticTab: ({
    children,
    testID,
    accessibilityLabel,
    accessibilityRole,
    accessibilityBusy,
    accessibilityState,
  }: {
    children?: React.ReactNode;
    testID?: string;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityBusy?: boolean;
    accessibilityState?: { selected?: boolean; busy?: boolean };
  }) => (
    <button
      data-testid={testID}
      aria-label={accessibilityLabel}
      role={accessibilityRole}
      aria-selected={accessibilityState?.selected ? 'true' : 'false'}
      aria-busy={accessibilityBusy || accessibilityState?.busy ? 'true' : undefined}
    >
      {children}
    </button>
  ),
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

jest.doMock('@/context/AnalysisActivityContext', () => ({
  useAnalysisActivity: () => ({
    activeAnalysis: mockActiveAnalysis,
    lastAnalysisOutcome: null,
  }),
}));

jest.doMock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { default: TabLayout } = require('@/app/(tabs)/_layout');

describe('TabLayout returning guest navigation', () => {
  beforeEach(() => {
    capturedTabBarStyle = null;
    capturedScreens = [];
    mockPlatformOS = 'ios';
    mockWindowWidth = 390;
    mockWindowHeight = 844;
    mockFontScale = 1;
    mockRouteCommitted = true;
    mockSegments = ['(tabs)', 'index'];
    mockActiveAnalysis = null;
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
    expect(capturedScreens.find((screen) => screen.name === 'settings')?.options).toEqual(
      expect.objectContaining({
        title: 'nav.settings',
        tabBarButton: expect.any(Function),
      })
    );
    expect(capturedScreens.find((screen) => screen.name === 'settings')?.options).not.toEqual(
      expect.objectContaining({
        href: null,
      })
    );
    ['index', 'journal', 'add-dream', 'statistics'].forEach((name) => {
      expect(capturedScreens.find((screen) => screen.name === name)?.options).toEqual(
        expect.objectContaining({
          href: null,
        })
      );
    });
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
    expect([
      screen.getByText('nav.home'),
      screen.getByText('nav.journal'),
      screen.getByText('nav.capture_dream'),
      screen.getByText('nav.stats'),
    ]).toHaveLength(4);
    expect(screen.queryByText('nav.settings')).toBeNull();
    expect(capturedScreens.find((tabScreen) => tabScreen.name === 'settings')?.options).toEqual(
      expect.objectContaining({
        href: null,
        title: 'nav.settings',
      })
    );
    expect(capturedScreens.find((tabScreen) => tabScreen.name === 'settings')?.options).not.toEqual(
      expect.objectContaining({
        tabBarButton: expect.anything(),
      })
    );
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

  it('keeps a 64 by 68 dp center action at 320 dp with default text scale', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 320;
    mockWindowHeight = 640;
    mockFontScale = 1;
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
    ].map((label) => screen.getByText(label));
    const centerStyle = screen.getByText('nav.capture_dream').parentElement?.getAttribute(
      'data-native-style'
    );

    expect(labels).toHaveLength(4);
    expect(screen.queryByText('nav.settings')).toBeNull();
    expect(centerStyle).toContain('"width":64');
    expect(centerStyle).toContain('"height":68');
    labels.forEach((label) => {
      expect(label.getAttribute('data-max-font-size-multiplier')).toBeNull();
      expect(label.getAttribute('data-number-of-lines')).toBe('1');
      expect(label.getAttribute('data-accessible')).toBe('false');
      expect(label.getAttribute('data-native-class')).toContain('text-[11px]');
      expect(label.getAttribute('data-native-class')).toContain('w-full');
      expect(label.getAttribute('data-native-class')).toContain('shrink');
    });
  });

  it('grows the narrow bar at fontScale 2 and lets labels wrap instead of capping them', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 320;
    mockWindowHeight = 640;
    mockFontScale = 2;
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });

    render(<TabLayout />);

    expect(capturedTabBarStyle).toEqual(expect.objectContaining({
      end: 8,
      height: 114,
      paddingHorizontal: 4,
      start: 8,
    }));

    const labels = [
      'nav.home',
      'nav.journal',
      'nav.capture_dream',
      'nav.stats',
    ].map((label) => screen.getByText(label));
    const centerStyle = screen.getByText('nav.capture_dream').parentElement?.getAttribute(
      'data-native-style'
    );

    expect(labels).toHaveLength(4);
    expect(screen.queryByText('nav.settings')).toBeNull();
    expect(centerStyle).toContain('"width":64');
    expect(centerStyle).toContain('"height":96');
    labels.forEach((label) => {
      expect(label.getAttribute('data-max-font-size-multiplier')).toBeNull();
      expect(label.getAttribute('data-number-of-lines')).toBe('2');
      expect(label.getAttribute('data-accessible')).toBe('false');
    });
  });

  it('keeps compact landscape labels readable at fontScale 2', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 915;
    mockWindowHeight = 412;
    mockFontScale = 2;
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });

    render(<TabLayout />);

    expect(capturedTabBarStyle).toEqual(expect.objectContaining({
      height: 82,
    }));
    const labels = [
      'nav.home',
      'nav.journal',
      'nav.capture_dream',
      'nav.stats',
    ].map((label) => screen.getByText(label));
    const centerStyle = screen.getByText('nav.capture_dream').parentElement?.getAttribute(
      'data-native-style'
    );
    expect(centerStyle).toContain('"width":60');
    expect(centerStyle).toContain('"height":74');
    labels.forEach((label) => {
      expect(label.getAttribute('data-max-font-size-multiplier')).toBeNull();
      expect(label.getAttribute('data-number-of-lines')).toBe('2');
    });
  });

  it('exposes a single TalkBack name, tab role and selected state on Expo tabs', () => {
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });

    render(<TabLayout />);

    const captureButton = capturedScreens
      .find((tabScreen) => tabScreen.name === 'add-dream')
      ?.options?.tabBarButton?.({
        accessibilityState: { selected: true },
        'aria-selected': true,
      });

    const view = render(<>{captureButton}</>);
    const tab = view.getByTestId('tab.addDream');
    expect(tab.getAttribute('role')).toBe('tab');
    expect(tab.getAttribute('aria-label')).toBe('nav.capture_dream_accessibility');
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(tab.getAttribute('aria-busy')).toBeNull();
    view.unmount();
  });

  it('attaches analysis busy state to the Capture tab button', () => {
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });
    mockActiveAnalysis = { dreamId: 42 };

    render(<TabLayout />);

    const captureButton = capturedScreens
      .find((tabScreen) => tabScreen.name === 'add-dream')
      ?.options?.tabBarButton?.({
        accessibilityState: { selected: false },
      });

    const view = render(<>{captureButton}</>);
    expect(view.getByTestId('tab.addDream').getAttribute('aria-busy')).toBe('true');
    view.unmount();
  });

  it('preserves the existing tab geometry at 390 dp', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 390;
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });

    render(<TabLayout />);

    const centerLabel = screen.getByText('nav.capture_dream');
    const centerClass = centerLabel.parentElement?.getAttribute('data-native-class');

    expect(capturedTabBarStyle).toEqual(expect.objectContaining({
      end: 22,
      paddingHorizontal: 8,
      start: 22,
    }));
    const centerStyle = centerLabel.parentElement?.getAttribute('data-native-style');
    expect(centerStyle).toContain('"width":72');
    expect(centerStyle).toContain('"height":76');
    expect(centerLabel.getAttribute('data-native-class')).toContain('text-[12px]');
    expect(centerLabel.getAttribute('data-max-font-size-multiplier')).toBeNull();
    expect(centerLabel.getAttribute('data-accessible')).toBe('false');
  });
});
