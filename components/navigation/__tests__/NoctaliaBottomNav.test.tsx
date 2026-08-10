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
      children,
      testID,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      testID?: string;
    }) => (
      <button aria-label={accessibilityLabel} data-testid={testID}>
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
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
    View: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: unknown;
    }) => <div data-native-style={JSON.stringify(flattenStyle(style))}>{children}</div>,
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

  it.each([1, 1.3, 2])(
    'constrains every label and reduces the center action at 320 dp with font scale %s',
    (fontScale) => {
      mockPlatformOS = 'android';
      mockWindowWidth = 320;
      mockWindowHeight = 640;
      mockFontScale = fontScale;

      render(<NoctaliaBottomNav activeKey="addDream" />);

      const captureTab = screen.getByTestId(TID.Tab.AddDream);
      const barStyle = captureTab.parentElement?.getAttribute('data-native-style');
      const centerStyle = captureTab.querySelector('div')?.getAttribute('data-native-style');
      const labels = captureTab.parentElement?.querySelectorAll(
        '[data-max-font-size-multiplier="1.3"]'
      );

      expect(barStyle).toContain('"paddingHorizontal":4');
      expect(barStyle).toContain('"start":8');
      expect(barStyle).toContain('"end":8');
      expect(centerStyle).toContain('"width":64');
      expect(centerStyle).toContain('"height":68');
      expect(labels).toHaveLength(5);
      labels?.forEach((label) => {
        expect(label.getAttribute('data-native-style')).toContain('"fontSize":11');
        expect(label.getAttribute('data-native-style')).toContain('"width":"100%"');
        expect(label.getAttribute('data-native-style')).toContain('"flexShrink":1');
      });
    }
  );

  it('preserves the current center action and margins above the narrow breakpoint', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 390;

    render(<NoctaliaBottomNav activeKey="addDream" />);

    const captureTab = screen.getByTestId(TID.Tab.AddDream);
    const barStyle = captureTab.parentElement?.getAttribute('data-native-style');
    const centerStyle = captureTab.querySelector('div')?.getAttribute('data-native-style');
    const centerLabel = Array.from(captureTab.querySelectorAll('span')).find(
      (element) => element.textContent === 'nav.capture_dream'
    );

    expect(barStyle).toContain('"paddingHorizontal":8');
    expect(barStyle).toContain('"start":22');
    expect(barStyle).toContain('"end":22');
    expect(centerStyle).toContain('"width":72');
    expect(centerStyle).toContain('"height":76');
    expect(centerLabel?.getAttribute('data-native-style')).toContain('"fontSize":12');
    expect(centerLabel?.getAttribute('data-max-font-size-multiplier')).toBeNull();
  });
});
