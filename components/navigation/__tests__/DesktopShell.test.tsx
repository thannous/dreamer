/* @jest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';

import { DesktopShell, getScreenInsets } from '@/components/navigation/DesktopShell';
import { DarkTheme, LightTheme } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useContentWindow } from '@/context/ContentWindowContext';

let mockPathname = '/journal';
let mockInsets = { top: 20, right: 54, bottom: 20, left: 0 };

jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (options: Record<string, unknown>) => options.ios ?? options.default },
  View: ({ children, style }: { children?: React.ReactNode; style?: unknown }) => (
    <div data-testid={style ? 'shell' : undefined} data-style={style ? JSON.stringify(style) : undefined}>{children}</div>
  ),
  // The folded iPhone Duo, its status bar column on the right.
  useWindowDimensions: () => ({ width: 466, height: 678, scale: 3, fontScale: 1 }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { createContext, useContext } = jest.requireActual<typeof import('react')>('react');
  const SafeAreaInsetsContext = createContext<unknown>(null);
  return {
    SafeAreaInsetsContext,
    // The system's insets outside the shell, what the shell gives its screens inside it.
    useSafeAreaInsets: () => useContext(SafeAreaInsetsContext) ?? mockInsets,
  };
});
jest.mock('expo-router', () => ({ usePathname: () => mockPathname }));
jest.mock('@/components/navigation/DesktopSidebar', () => ({ DesktopSidebar: () => null }));
jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('@/constants/journalTheme').LightTheme, mode: 'light' }),
}));

function ContentWidth() {
  return <span data-testid="content-width">{useContentWindow().width}</span>;
}

function TopInset() {
  const { useSafeAreaInsets } = jest.requireMock<typeof import('react-native-safe-area-context')>('react-native-safe-area-context');
  return <span data-testid="top-inset">{useSafeAreaInsets().top}</span>;
}

function shellStyle() {
  return JSON.parse(screen.getByTestId('shell').getAttribute('data-style') ?? '{}');
}

afterEach(() => {
  cleanup();
  mockPathname = '/journal';
  mockInsets = { top: 20, right: 54, bottom: 20, left: 0 };
});

it('keeps screens clear of the folded Duo status bar column, in the page ground', () => {
  render(<DesktopShell><ContentWidth /></DesktopShell>);
  expect(shellStyle()).toEqual({
    paddingLeft: 0,
    paddingRight: 54,
    backgroundColor: getNoctaliaDesignTokens(LightTheme, 'light').screen.background,
  });
  expect(screen.getByTestId('content-width').textContent).toBe('412');
});

it.each(['/onboarding', '/sleep-sounds'])('paints the gutter at night beside %s, which is always night', (pathname: string) => {
  mockPathname = pathname;
  render(<DesktopShell><ContentWidth /></DesktopShell>);
  expect(shellStyle().backgroundColor).toBe(getNoctaliaDesignTokens(DarkTheme, 'dark').screen.background);
  expect(getNoctaliaDesignTokens(DarkTheme, 'dark').screen.background)
    .not.toBe(getNoctaliaDesignTokens(LightTheme, 'light').screen.background);
});

it('keeps a margin above the screens when the folded Duo puts its status bar beside them', () => {
  // Measured in the iPhone Duo simulator (iOS 27.1): no top inset, an 84 pt column on the right.
  mockInsets = { top: 0, right: 84, bottom: 34, left: 0 };
  render(<DesktopShell><TopInset /><ContentWidth /></DesktopShell>);
  expect(screen.getByTestId('top-inset').textContent).toBe('16');
  expect(screen.getByTestId('content-width').textContent).toBe('382');
});

it('leaves the system insets alone wherever the status bar sits at the top or nothing takes a side', () => {
  const portrait = { top: 59, right: 0, bottom: 34, left: 0 };
  const browser = { top: 0, right: 0, bottom: 0, left: 0 };
  expect(getScreenInsets(portrait)).toBe(portrait);
  expect(getScreenInsets(browser)).toBe(browser);
  // A phone on its side: the camera on one side, no status bar.
  expect(getScreenInsets({ top: 0, right: 59, bottom: 21, left: 59 })).toEqual({ top: 16, right: 59, bottom: 21, left: 59 });
});
