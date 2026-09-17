import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import BreatheTab from '@/app/(drawer)/(tabs)/breathe';
import type { BreathingPatternId } from '@/content/breathing';
import { ArtworkGlass } from '@/constants/theme';
import { WORLD_BY_ID, type WorldId } from '@/constants/worlds';
import { WorldProvider } from '@/context/WorldContext';
import { StorageKey } from '@/services/storageService';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useIsFocused: () => true,
}));

jest.mock('@/context/SubscriptionContext', () => ({
  useSubscription: () => ({
    gateForPattern: () => ({ allowed: true }),
    openPaywall: jest.fn(),
  }),
}));

jest.mock('@/hooks/useCompactLayout', () => ({
  useCompactLayout: () => false,
}));

jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

jest.mock('@/hooks/useTabBarInset', () => ({
  useTabBarInset: () => 96,
}));

jest.mock('uniwind', () => ({
  ScopedTheme: ({ children }: React.PropsWithChildren<{ theme: string }>) => children,
  Uniwind: { setTheme: jest.fn() },
  useUniwind: () => ({ theme: 'dark' }),
  withUniwind: (Component: React.ComponentType<object>) => Component,
}));

describe('world-aware breathing options', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockPush.mockClear();
  });

  it.each([
    ['constellation', 'calm', 'Constellation'],
    ['dawn', 'coherent', 'Inner dawn'],
    ['forest', 'box', 'Inner forest'],
  ] as const)(
    'puts the %s signature first over one glass surface per option',
    async (worldId: WorldId, signaturePatternId: BreathingPatternId, worldName: string) => {
      await AsyncStorage.setItem(StorageKey.world, JSON.stringify(worldId));

      const view = render(<BreatheTab />, {
        wrapper: ({ children }) => <WorldProvider>{children}</WorldProvider>,
      });

      await waitFor(() =>
        expect(screen.getAllByRole('button')[0]).toHaveTextContent(new RegExp(worldName))
      );

      const options = screen.getAllByRole('button');
      const signatureGlass = screen.getByTestId(`breathe.option-glass.${signaturePatternId}`);
      const glassStyle = StyleSheet.flatten(signatureGlass.props.style);
      expect(options).toHaveLength(4);
      expect(screen.getAllByTestId(/^breathe\.option-glass\.[^.]+$/)).toHaveLength(4);
      expect(glassStyle.backgroundColor).toBe(ArtworkGlass[WORLD_BY_ID[worldId].appearance].fill);
      expect(glassStyle.borderColor).toBe(ArtworkGlass[WORLD_BY_ID[worldId].appearance].border);
      expect(
        view.root.findByProps({ testID: `world-scene-motion.${WORLD_BY_ID[worldId].motion}` })
      ).toBeTruthy();
      expect(screen.queryAllByTestId(/^breathe\.option-artwork\./)).toHaveLength(0);
    }
  );
});
