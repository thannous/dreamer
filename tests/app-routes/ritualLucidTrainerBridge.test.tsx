/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
let mockRitualId = 'lucid';

jest.mock('react-native', () => jest.requireActual('../react-native-stub'));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: mockPush },
  useLocalSearchParams: () => ({ id: mockRitualId }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    mode: 'dark',
    colors: {
      accent: '#d4a574',
      accentDark: '#9a6332',
      accentLight: '#ead4b4',
      backgroundCard: '#0d0b1c',
      backgroundSecondary: '#192344',
      backgroundDark: '#03040d',
      divider: '#514637',
      navbarBg: '#050510',
      navbarBorder: '#514637',
      navbarTextActive: '#fff9ef',
      navbarTextInactive: '#afa7bb',
      overlay: 'rgba(3,4,13,.88)',
      tags: { surreal: '#777', mystical: '#777', calm: '#777', noir: '#777' },
      textPrimary: '#fff9ef',
      textSecondary: '#b7aec9',
      textTertiary: '#8e84a7',
      textOnAccentSurface: '#3b2412',
      timeline: '#6b573d',
    },
    shadows: { lg: {} },
  }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ currentLang: 'en', t: (key: string) => key }),
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
  GlassCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

jest.mock('@/lib/sleepSoundsFeature', () => ({
  isSleepSoundsAvailable: () => false,
}));

jest.mock('@/services/storageService', () => ({
  getRitualStepProgress: jest.fn().mockResolvedValue(null),
  saveRitualPreference: jest.fn().mockResolvedValue(undefined),
  saveRitualStepProgress: jest.fn().mockResolvedValue(undefined),
}));

const { default: RitualDetailScreen } = require('@/app/ritual/[id]');

describe('Noctalia lucid ritual bridge', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
    mockRitualId = 'lucid';
  });

  it('opens Lucid Trainer from the lucid ritual and explains the data boundary', async () => {
    render(<RitualDetailScreen />);

    const bridge = await screen.findByTestId('ritual-lucid-trainer-bridge');
    expect(screen.getByText('Continue with Lucid Trainer')).toBeTruthy();
    expect(screen.getByText(/dream text is never transferred automatically/i)).toBeTruthy();

    fireEvent.click(bridge);

    expect(mockPush).toHaveBeenCalledWith('/lucid');
  });

  it('does not add the Trainer bridge to another Noctalia ritual', async () => {
    mockRitualId = 'starter';
    render(<RitualDetailScreen />);

    await waitFor(() => {
      expect(screen.queryByTestId('ritual-lucid-trainer-bridge')).toBeNull();
    });
  });
});
