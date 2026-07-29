/* @jest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';

import { NoctaliaBottomNav } from '@/components/navigation/NoctaliaBottomNav';
import { TID } from '@/lib/testIDs';

let mockPlatformOS: 'android' | 'web' = 'web';
let mockWindowWidth = 390;

jest.mock('react-native', () => {
  const React = require('react');

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
    },
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    View: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: unknown;
    }) => <div data-native-style={JSON.stringify(style)}>{children}</div>,
    useWindowDimensions: () => ({
      width: mockWindowWidth,
      height: 844,
      scale: 1,
      fontScale: 1,
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
});
