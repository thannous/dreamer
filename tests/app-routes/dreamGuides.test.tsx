/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: mockPush, back: mockBack },
  useLocalSearchParams: () => ({ id: 'most-common-dream-symbols' }),
}));

jest.mock('react-native', () => jest.requireActual('../react-native-stub'));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    mode: 'dark',
    colors: {
      accent: '#6f62b5',
      backgroundCard: '#221b3b',
      backgroundSecondary: '#2f274f',
      backgroundDark: '#0b0a12',
      divider: '#3a3357',
      textPrimary: '#fff',
      textSecondary: '#c7c2d7',
      textTertiary: '#8a8499',
      textOnAccentSurface: '#f0ecff',
    },
    shadows: { xl: {}, lg: {}, md: {}, sm: {} },
  }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ currentLang: 'en' }),
}));

jest.mock('@/hooks/useScrollIdle', () => ({
  useScrollIdle: () => ({
    isScrolling: false,
    onScrollBeginDrag: jest.fn(),
    onScrollEndDrag: jest.fn(),
    onMomentumScrollBegin: jest.fn(),
    onMomentumScrollEnd: jest.fn(),
  }),
}));

jest.mock('@/context/ScrollPerfContext', () => ({
  ScrollPerfProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/inspiration/AtmosphericBackground', () => ({
  AtmosphericBackground: () => null,
}));

jest.mock('@/components/inspiration/GlassCard', () => ({
  FlatGlassCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const { default: DreamGuidesScreen } = require('@/app/dream-guides');
const { default: DreamGuideDetailScreen } = require('@/app/dream-guide/[id]');

describe('dream guide routes', () => {
  it('lists the important website guides and opens a guide', () => {
    render(<DreamGuidesScreen />);

    expect(screen.getByText('Dream guides')).toBeTruthy();
    expect(screen.getByText('Essential guides')).toBeTruthy();

    fireEvent.click(screen.getByTestId('dream-guide-most-common-dream-symbols'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/dream-guide/[id]',
      params: { id: 'most-common-dream-symbols' },
    });
  });

  it('opens the existing symbol detail from a guide with the guide analytics source', () => {
    render(<DreamGuideDetailScreen />);

    expect(screen.getByText('Most common dream symbols: 20 meanings with examples')).toBeTruthy();

    fireEvent.click(screen.getByText('Water'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/symbol-detail/[id]',
      params: { id: 'water', source: 'guide' },
    });
  });
});
