/* @jest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';

import { DesktopShell } from '@/components/navigation/DesktopShell';
import { DarkTheme, LightTheme } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useContentWindow } from '@/context/ContentWindowContext';

let mockPathname = '/journal';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (options: Record<string, unknown>) => options.ios ?? options.default },
  View: ({ children, style }: { children?: React.ReactNode; style?: unknown }) => (
    <div data-testid={style ? 'shell' : undefined} data-style={style ? JSON.stringify(style) : undefined}>{children}</div>
  ),
  // The folded iPhone Duo, its status bar column on the right.
  useWindowDimensions: () => ({ width: 466, height: 678, scale: 3, fontScale: 1 }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 20, right: 54, bottom: 20, left: 0 }),
}));
jest.mock('expo-router', () => ({ usePathname: () => mockPathname }));
jest.mock('@/components/navigation/DesktopSidebar', () => ({ DesktopSidebar: () => null }));
jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('@/constants/journalTheme').LightTheme, mode: 'light' }),
}));

function ContentWidth() {
  return <span data-testid="content-width">{useContentWindow().width}</span>;
}

function shellStyle() {
  return JSON.parse(screen.getByTestId('shell').getAttribute('data-style') ?? '{}');
}

afterEach(() => {
  cleanup();
  mockPathname = '/journal';
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
