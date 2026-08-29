/* @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { DesktopSidebar } from '@/components/navigation/DesktopSidebar';
import { TID } from '@/lib/testIDs';

const mockPush = jest.fn();
let mockPathname = '/journal';
let mockReturningGuestBlocked = false;

jest.mock('react-native', () => {
  const React = require('react');
  return {
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
      testID,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button aria-label={accessibilityLabel} data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ),
    StyleSheet: { create: <T extends Record<string, unknown>>(styles: T) => styles },
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  };
});

jest.mock('expo-image', () => ({
  Image: () => <span />,
}));

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => <span />,
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    accent: { base: '#accent', text: '#accent'},
    screen: { background: '#bg' },
    surface: { active: '#active', border: '#border', soft: '#soft' },
    text: { primary: '#text', secondary: '#muted' },
  }),
}));

jest.mock('@/constants/theme', () => ({
  Fonts: { spaceGrotesk: { bold: 'SpaceGrotesk-Bold', medium: 'SpaceGrotesk-Medium', regular: 'SpaceGrotesk-Regular' } },
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ returningGuestBlocked: mockReturningGuestBlocked }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'light' }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/appVersion', () => ({
  getAppVersionString: () => 'v3.1.0',
}));

afterEach(() => {
  cleanup();
  mockPush.mockClear();
  mockPathname = '/journal';
  mockReturningGuestBlocked = false;
});

describe('DesktopSidebar', () => {
  it('keeps Home, Journal, Capture and Stats as primary items with a single Settings footer', () => {
    render(<DesktopSidebar />);

    expect(screen.getByTestId(TID.Tab.Home)).toBeTruthy();
    expect(screen.getByTestId(TID.Tab.Journal)).toBeTruthy();
    expect(screen.getByTestId(TID.Tab.AddDream)).toBeTruthy();
    expect(screen.getByTestId(TID.Tab.Stats)).toBeTruthy();
    expect(screen.getAllByTestId(TID.Tab.Settings)).toHaveLength(1);

    fireEvent.click(screen.getByTestId(TID.Tab.AddDream));
    expect(mockPush).toHaveBeenCalledWith('/recording');

    fireEvent.click(screen.getByTestId(TID.Tab.Settings));
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('shows only one Settings item and hides the primary tabs when a returning guest is blocked', () => {
    mockReturningGuestBlocked = true;
    render(<DesktopSidebar />);

    expect(screen.queryByTestId(TID.Tab.Home)).toBeNull();
    expect(screen.queryByTestId(TID.Tab.Journal)).toBeNull();
    expect(screen.queryByTestId(TID.Tab.AddDream)).toBeNull();
    expect(screen.queryByTestId(TID.Tab.Stats)).toBeNull();
    expect(screen.getAllByTestId(TID.Tab.Settings)).toHaveLength(1);

    fireEvent.click(screen.getByTestId(TID.Tab.Settings));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });
});
