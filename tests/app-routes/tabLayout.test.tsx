/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
let tabHostMounts = 0;
let tabHostUnmounts = 0;
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
    const React = require('react');
    const [note, setNote] = React.useState('initial');
    React.useEffect(() => {
      tabHostMounts += 1;
      return () => {
        tabHostUnmounts += 1;
      };
    }, []);
    capturedTabBarStyle = screenOptions?.tabBarStyle ?? null;
    return (
      <div>
        <span data-testid="mock-tabs-note">{note}</span>
        <button data-testid="mock-tabs-edit" onClick={() => setNote('edited')} />
        <div>{children}</div>
      </div>
    );
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

const uniqueScreenNames = () => Array.from(new Set(capturedScreens.map((s) => s.name)));
const centerBox = (labelKey: string) => {
  const raw = screen.getByText(labelKey).parentElement?.getAttribute('data-native-style') ?? '{}';
  return JSON.parse(raw) as { width?: number; height?: number };
};

describe('TabLayout returning guest navigation', () => {
  beforeEach(() => {
    capturedTabBarStyle = null;
    capturedScreens = [];
    tabHostMounts = 0;
    tabHostUnmounts = 0;
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
    expect(capturedScreens.find((s) => s.name === 'settings')?.options).toEqual(
      expect.objectContaining({
        title: 'nav.settings',
        tabBarButton: expect.any(Function),
      })
    );
    expect(capturedScreens.find((s) => s.name === 'settings')?.options).not.toEqual(
      expect.objectContaining({
        href: null,
      })
    );
    ['index', 'journal', 'add-dream', 'statistics', 'explore'].forEach((name) => {
      expect(capturedScreens.find((s) => s.name === name)?.options).toEqual(
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
      screen.getByText('nav.explore'),
    ]).toHaveLength(5);
    // The startup latch effect re-renders once; dedupe instead of freezing mount count.
    expect(uniqueScreenNames()).toEqual([
      'index',
      'journal',
      'add-dream',
      'statistics',
      'explore',
      'settings',
    ]);
    expect(screen.queryByText('nav.settings')).toBeNull();
    expect(capturedScreens.find((s) => s.name === 'settings')?.options).toEqual(
      expect.objectContaining({
        href: null,
        title: 'nav.settings',
      })
    );
    expect(capturedScreens.find((s) => s.name === 'settings')?.options).not.toEqual(
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

  it('keeps words visible on two lines at 320 dp with default text scale', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 320;
    mockWindowHeight = 640;
    mockFontScale = 1;
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });

    render(<TabLayout />);

    expect(capturedTabBarStyle).toEqual(expect.objectContaining({
      end: 8,
      height: 102,
      paddingHorizontal: 4,
      start: 8,
    }));

    const labels = [
      'nav.home',
      'nav.journal',
      'nav.capture_dream',
      'nav.stats',
      'nav.explore',
    ].map((label) => screen.getByText(label));
    const box = centerBox('nav.capture_dream');

    expect(labels).toHaveLength(5);
    expect(screen.queryByText('nav.settings')).toBeNull();
    expect(box.width).toBeCloseTo(54.8, 1);
    expect(box.height).toBe(92);
    labels.forEach((label) => {
      expect(label.getAttribute('data-max-font-size-multiplier')).toBeNull();
      expect(label.getAttribute('data-number-of-lines')).toBe('2');
      expect(label.getAttribute('data-accessible')).toBe('false');
      expect(label.getAttribute('data-native-class')).toContain('w-full');
      expect(label.getAttribute('data-native-class')).toContain('shrink');
    });
  });

  it('keeps five visible labels at fontScale 2 while the narrow bar grows', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 320;
    mockWindowHeight = 640;
    mockFontScale = 2;
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });

    render(<TabLayout />);

    expect(capturedTabBarStyle).toEqual(expect.objectContaining({
      end: 8,
      height: 198,
      paddingHorizontal: 4,
      start: 8,
    }));

    expect([
      screen.getByText('nav.home'),
      screen.getByText('nav.journal'),
      screen.getByText('nav.capture_dream'),
      screen.getByText('nav.stats'),
      screen.getByText('nav.explore'),
    ]).toHaveLength(5);
    const box = centerBox('nav.capture_dream');
    expect(box.width).toBeCloseTo(54.8, 1);
    expect(box.height).toBe(188);
    expect(screen.getByText('nav.capture_dream').getAttribute('data-number-of-lines')).toBe('4');
    expect(capturedScreens.find((s) => s.name === 'explore')?.options).toEqual(
      expect.objectContaining({ title: 'nav.explore' }),
    );
  });

  it('keeps compact landscape words visible at fontScale 2 while the bar grows', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 915;
    mockWindowHeight = 412;
    mockFontScale = 2;
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });

    render(<TabLayout />);

    expect(capturedTabBarStyle).toEqual(expect.objectContaining({
      height: 134,
    }));
    expect(screen.getByText('nav.capture_dream')).toBeTruthy();
    expect(screen.getByText('nav.capture_dream').getAttribute('data-number-of-lines')).toBe('2');
    const box = centerBox('nav.capture_dream');
    expect(box.width).toBe(60);
    expect(box.height).toBe(124);
  });

  it('exposes a single TalkBack name, tab role and selected state on Expo tabs', () => {
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });

    render(<TabLayout />);

    const captureButton = capturedScreens
      .find((s) => s.name === 'add-dream')
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
      .find((s) => s.name === 'add-dream')
      ?.options?.tabBarButton?.({
        accessibilityState: { selected: false },
      });

    const view = render(<>{captureButton}</>);
    expect(view.getByTestId('tab.addDream').getAttribute('aria-busy')).toBe('true');
    view.unmount();
  });

  it('preserves the tab geometry at 390 dp without capping labels', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 390;
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });

    render(<TabLayout />);

    const centerLabel = screen.getByText('nav.capture_dream');
    expect(capturedTabBarStyle).toEqual(expect.objectContaining({
      end: 22,
      paddingHorizontal: 8,
      start: 22,
    }));
    const box = centerBox('nav.capture_dream');
    expect(box.width).toBeCloseTo(61.6, 1);
    expect(box.height).toBe(76);
    expect(centerLabel.getAttribute('data-number-of-lines')).toBe('1');
    expect(centerLabel.getAttribute('data-max-font-size-multiplier')).toBeNull();
    expect(centerLabel.getAttribute('data-accessible')).toBe('false');
  });
});

describe('TabLayout StatefulTabs', () => {
  beforeEach(() => {
    capturedTabBarStyle = null;
    capturedScreens = [];
    tabHostMounts = 0;
    tabHostUnmounts = 0;
    mockPlatformOS = 'ios';
    mockWindowWidth = 390;
    mockWindowHeight = 844;
    mockFontScale = 1;
    mockRouteCommitted = true;
    mockSegments = ['(tabs)', 'explore'];
    mockActiveAnalysis = null;
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });
  });

  it('keeps one Tabs instance and its interactive state across Explorer -> resource root -> Explorer', () => {
    const view = render(<TabLayout />);
    expect(tabHostMounts).toBe(1);
    expect(capturedTabBarStyle).not.toBeNull();
    expect(uniqueScreenNames()).toContain('explore');
    expect(screen.getByTestId('mock-tabs-note').textContent).toBe('initial');
    fireEvent.click(screen.getByTestId('mock-tabs-edit'));
    expect(screen.getByTestId('mock-tabs-note').textContent).toBe('edited');

    mockSegments = ['symbol-dictionary'];
    view.rerender(<TabLayout />);
    expect(tabHostMounts).toBe(1);
    expect(tabHostUnmounts).toBe(0);
    expect(capturedTabBarStyle).not.toBeNull();
    expect(capturedTabBarStyle).not.toEqual({ display: 'none' });
    expect(screen.getByTestId('mock-tabs-note').textContent).toBe('edited');

    mockSegments = ['(tabs)', 'explore'];
    view.rerender(<TabLayout />);
    expect(tabHostMounts).toBe(1);
    expect(tabHostUnmounts).toBe(0);
    expect(uniqueScreenNames()).toContain('explore');
    expect(screen.getByTestId('mock-tabs-note').textContent).toBe('edited');
    expect(screen.getByText('nav.explore')).toBeTruthy();
    view.unmount();
  });

  it('keeps one Tabs instance and its interactive state across the 320 <-> 1024 breakpoint round-trip', () => {
    mockPlatformOS = 'web';
    mockWindowWidth = 320;
    mockWindowHeight = 640;
    mockSegments = ['(tabs)', 'explore'];
    const view = render(<TabLayout />);
    expect(tabHostMounts).toBe(1);
    expect(screen.getByText('nav.explore')).toBeTruthy();
    fireEvent.click(screen.getByTestId('mock-tabs-edit'));
    expect(screen.getByTestId('mock-tabs-note').textContent).toBe('edited');

    mockWindowWidth = 1024;
    mockWindowHeight = 800;
    view.rerender(<TabLayout />);
    expect(tabHostMounts).toBe(1);
    expect(tabHostUnmounts).toBe(0);
    expect(screen.getByTestId('mock-tabs-note').textContent).toBe('edited');

    mockWindowWidth = 320;
    mockWindowHeight = 640;
    view.rerender(<TabLayout />);
    expect(tabHostMounts).toBe(1);
    expect(tabHostUnmounts).toBe(0);
    expect(uniqueScreenNames()).toContain('explore');
    expect(screen.getByTestId('mock-tabs-note').textContent).toBe('edited');
    expect(screen.getByText('nav.explore')).toBeTruthy();
    view.unmount();
  });
});
