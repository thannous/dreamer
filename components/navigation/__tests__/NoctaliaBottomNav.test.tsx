/* @jest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';

import { NoctaliaBottomNav } from '@/components/navigation/NoctaliaBottomNav';
import { TID } from '@/lib/testIDs';

let mockPlatformOS: 'android' | 'web' = 'web';
let mockWindowWidth = 390;
let mockWindowHeight = 844;
let mockFontScale = 1;

jest.mock('react-native', () => {
  const React = require('react');
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
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      className,
      testID,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { selected?: boolean; busy?: boolean };
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      className?: string;
      testID?: string;
    }) => (
      <button
        aria-label={accessibilityLabel}
        aria-selected={accessibilityState?.selected ? 'true' : 'false'}
        aria-busy={accessibilityState?.busy ? 'true' : undefined}
        data-native-class={className}
        data-testid={testID}
        role={accessibilityRole}
      >
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
      flatten: flattenStyle,
    },
    Text: ({
      children,
      className,
      maxFontSizeMultiplier,
      numberOfLines,
      accessible,
      style,
    }: {
      children?: React.ReactNode;
      className?: string;
      maxFontSizeMultiplier?: number;
      numberOfLines?: number;
      accessible?: boolean;
      style?: unknown;
    }) => (
      <span
        data-max-font-size-multiplier={maxFontSizeMultiplier}
        data-number-of-lines={numberOfLines}
        data-accessible={accessible === false ? 'false' : undefined}
        data-native-class={className}
        data-native-style={JSON.stringify(flattenStyle(style))}
      >
        {children}
      </span>
    ),
    View: ({
      children,
      className,
      style,
      accessible,
    }: {
      children?: React.ReactNode;
      className?: string;
      style?: unknown;
      accessible?: boolean;
    }) => (
      <div
        data-native-class={className}
        data-native-style={JSON.stringify(flattenStyle(style))}
        data-accessible={accessible === false ? 'false' : undefined}
      >
        {children}
      </div>
    ),
    ActivityIndicator: () => <span data-testid="nav-analysis-busy" />,
    useWindowDimensions: () => ({
      width: mockWindowWidth,
      height: mockWindowHeight,
      scale: 1,
      fontScale: mockFontScale,
    }),
  };
});

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => <span />,
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    action: {
      primary: '#primary',
      primaryBorder: '#primary-border',
      primaryText: '#primary-text',
    },
    nav: {
      active: '#active',
      background: '#background',
      border: '#border',
      inactive: '#inactive',
    },
  }),
}));

jest.mock('@/constants/theme', () => ({
  Fonts: { spaceGrotesk: { medium: 'SpaceGrotesk-Medium' } },
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'dark' }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  mockPlatformOS = 'web';
  mockWindowWidth = 390;
  mockWindowHeight = 844;
  mockFontScale = 1;
});

describe('NoctaliaBottomNav', () => {
  it('stays available on a wide Android window', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 1280;

    render(<NoctaliaBottomNav activeKey="addDream" />);

    const addDreamTab = screen.getByTestId(TID.Tab.AddDream);
    expect(addDreamTab).toBeTruthy();
    expect(addDreamTab.parentElement?.getAttribute('data-native-style')).toContain('"start":160');
    expect(addDreamTab.parentElement?.getAttribute('data-native-style')).toContain('"end":160');
  });

  it('remains hidden on desktop Web', () => {
    mockPlatformOS = 'web';
    mockWindowWidth = 1280;

    render(<NoctaliaBottomNav activeKey="addDream" />);

    expect(screen.queryByTestId(TID.Tab.AddDream)).toBeNull();
  });

  it('remains available on narrow Web windows', () => {
    mockPlatformOS = 'web';
    mockWindowWidth = 390;

    render(<NoctaliaBottomNav activeKey="addDream" />);

    expect(screen.getByTestId(TID.Tab.AddDream)).toBeTruthy();
  });

  it('keeps the capture label stable when another tab is active', () => {
    render(<NoctaliaBottomNav activeKey="home" />);

    const captureTab = screen.getByTestId(TID.Tab.AddDream);
    expect(captureTab.textContent).toBe('nav.capture_dream');
    expect(captureTab.getAttribute('aria-label')).toBe('nav.capture_dream_accessibility');
  });

  it('renders four tabs and keeps settings out of the bar', () => {
    render(<NoctaliaBottomNav activeKey="home" />);

    expect(screen.getByTestId(TID.Tab.Home)).toBeTruthy();
    expect(screen.getByTestId(TID.Tab.Journal)).toBeTruthy();
    expect(screen.getByTestId(TID.Tab.AddDream)).toBeTruthy();
    expect(screen.getByTestId(TID.Tab.Stats)).toBeTruthy();
    expect(screen.queryByTestId(TID.Tab.Settings)).toBeNull();
    expect([
      screen.getByText('nav.home'),
      screen.getByText('nav.journal'),
      screen.getByText('nav.capture_dream'),
      screen.getByText('nav.stats'),
    ]).toHaveLength(4);
    expect(screen.queryByText('nav.settings')).toBeNull();
  });

  it('keeps a 64 by 68 dp center action at 320 dp with default text scale', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 320;
    mockWindowHeight = 640;
    mockFontScale = 1;

    render(<NoctaliaBottomNav activeKey="addDream" />);

    const captureTab = screen.getByTestId(TID.Tab.AddDream);
    const barStyle = captureTab.parentElement?.getAttribute('data-native-style');
    const barClass = captureTab.parentElement?.getAttribute('data-native-class');
    const centerStyle = captureTab.querySelector('div')?.getAttribute('data-native-style');
    const labels = Array.from(captureTab.parentElement?.querySelectorAll('span') ?? []).filter(
      (node) => node.textContent
    );

    expect(barStyle).toContain('"start":8');
    expect(barStyle).toContain('"end":8');
    expect(barStyle).toContain('"height":86');
    expect(barClass).toContain('px-1');
    expect(centerStyle).toContain('"width":64');
    expect(centerStyle).toContain('"height":68');
    expect(screen.queryByTestId(TID.Tab.Settings)).toBeNull();
    expect(labels).toHaveLength(4);
    labels.forEach((label) => {
      expect(label.getAttribute('data-max-font-size-multiplier')).toBeNull();
      expect(label.getAttribute('data-number-of-lines')).toBe('1');
      expect(label.getAttribute('data-accessible')).toBe('false');
      expect(label.getAttribute('data-native-class')).toContain('text-[11px]');
    });
  });

  it('grows the overlay bar at fontScale 2 and lets labels wrap instead of capping them', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 320;
    mockWindowHeight = 640;
    mockFontScale = 2;

    render(<NoctaliaBottomNav activeKey="addDream" />);

    const captureTab = screen.getByTestId(TID.Tab.AddDream);
    const barStyle = captureTab.parentElement?.getAttribute('data-native-style');
    const centerStyle = captureTab.querySelector('div')?.getAttribute('data-native-style');
    const labels = Array.from(captureTab.parentElement?.querySelectorAll('span') ?? []).filter(
      (node) => node.textContent
    );

    expect(barStyle).toContain('"height":114');
    expect(centerStyle).toContain('"width":64');
    expect(centerStyle).toContain('"height":96');
    expect(labels).toHaveLength(4);
    labels.forEach((label) => {
      expect(label.getAttribute('data-max-font-size-multiplier')).toBeNull();
      expect(label.getAttribute('data-number-of-lines')).toBe('2');
      expect(label.getAttribute('data-accessible')).toBe('false');
    });
    expect(captureTab.getAttribute('role')).toBe('tab');
    expect(captureTab.getAttribute('aria-label')).toBe('nav.capture_dream_accessibility');
    expect(captureTab.getAttribute('aria-selected')).toBe('true');
  });

  it('keeps compact landscape labels readable at fontScale 2', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 915;
    mockWindowHeight = 412;
    mockFontScale = 2;

    render(<NoctaliaBottomNav activeKey="addDream" />);

    const captureTab = screen.getByTestId(TID.Tab.AddDream);
    const barStyle = captureTab.parentElement?.getAttribute('data-native-style');
    const centerStyle = captureTab.querySelector('div')?.getAttribute('data-native-style');
    const labels = Array.from(captureTab.parentElement?.querySelectorAll('span') ?? []).filter(
      (node) => node.textContent
    );

    expect(barStyle).toContain('"height":82');
    expect(centerStyle).toContain('"width":60');
    expect(centerStyle).toContain('"height":74');
    labels.forEach((label) => {
      expect(label.getAttribute('data-max-font-size-multiplier')).toBeNull();
      expect(label.getAttribute('data-number-of-lines')).toBe('2');
    });
  });

  it('preserves the current center action and margins above the narrow breakpoint', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 390;

    render(<NoctaliaBottomNav activeKey="addDream" />);

    const captureTab = screen.getByTestId(TID.Tab.AddDream);
    const barStyle = captureTab.parentElement?.getAttribute('data-native-style');
    const barClass = captureTab.parentElement?.getAttribute('data-native-class');
    const centerLabel = Array.from(captureTab.querySelectorAll('span')).find(
      (element) => element.textContent === 'nav.capture_dream'
    );

    expect(barStyle).toContain('"start":22');
    expect(barStyle).toContain('"end":22');
    expect(barClass).toContain('px-2');
    const centerStyle = captureTab.querySelector('div')?.getAttribute('data-native-style');
    expect(centerStyle).toContain('"width":72');
    expect(centerStyle).toContain('"height":76');
    expect(centerLabel?.getAttribute('data-native-class')).toContain('text-[12px]');
    expect(centerLabel?.getAttribute('data-max-font-size-multiplier')).toBeNull();
    expect(centerLabel?.getAttribute('data-accessible')).toBe('false');
    expect(barStyle).toContain('"height":86');
  });
});
