/* @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { MockNavigationRail } from '@/components/dev/MockNavigationRail';
import { TID } from '@/lib/testIDs';

const mockPush = jest.fn();
let mockPathname = '/settings';

jest.mock('react-native', () => {
  const React = require('react');

  return {
    Platform: { OS: 'android' },
    Pressable: ({
      accessibilityLabel,
      accessibilityState,
      children,
      onPress,
      testID,
    }: {
      accessibilityLabel?: string;
      accessibilityState?: { selected?: boolean };
      children?: React.ReactNode;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button
        aria-label={accessibilityLabel}
        aria-pressed={accessibilityState?.selected ? 'true' : 'false'}
        data-testid={testID}
        onClick={onPress}
      >
        {children}
      </button>
    ),
    StyleSheet: { create: <T extends Record<string, unknown>>(styles: T) => styles },
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  };
});

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  usePathname: () => mockPathname,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 24 }),
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    accent: { base: '#accent' },
    surface: { active: '#active', border: '#border', raised: '#raised' },
    text: { secondary: '#secondary' },
  }),
}));

jest.mock('@/constants/theme', () => ({
  Fonts: { spaceGrotesk: { bold: 'SpaceGrotesk-Bold' } },
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'dark' }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'nav.home': 'Accueil',
      'nav.journal': 'Journal',
      'nav.settings': 'Paramètres',
      'nav.stats': 'Statistiques',
    })[key] ?? key,
  }),
}));

jest.mock('@/lib/env', () => ({ isMockModeEnabled: () => true }));

describe('MockNavigationRail', () => {
  beforeEach(() => {
    mockPathname = '/settings';
    mockPush.mockClear();
  });

  it('exposes localized human labels and the current destination', () => {
    render(<MockNavigationRail />);

    expect(screen.getByRole('button', { name: 'Accueil' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Journal' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Statistiques' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Paramètres' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps the mock navigation test IDs and destinations stable', () => {
    render(<MockNavigationRail />);

    fireEvent.click(screen.getByTestId(TID.Button.MockNavJournal));

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/journal');
  });
});
