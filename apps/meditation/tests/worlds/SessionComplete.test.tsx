import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import SessionCompleteScreen from '@/app/session-complete';
import { WORLD_BY_ID } from '@/constants/worlds';
import { WorldProvider } from '@/context/WorldContext';
import { TID } from '@/lib/testIDs';
import { StorageKey } from '@/services/storageService';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useLocalSearchParams: () => ({ id: 'sleep-descent' }),
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/context/WorldPurchaseContext', () => ({
  useWorldPurchases: () => ({
    loaded: true,
    isWorldOwned: (worldId: string) =>
      ['constellation', 'dawn', 'forest'].includes(worldId),
  }),
}));

jest.mock('uniwind', () => ({
  ScopedTheme: ({ children }: React.PropsWithChildren<{ theme: string }>) => children,
  Uniwind: { setTheme: jest.fn() },
  useUniwind: () => ({ theme: 'dark' }),
  withUniwind: (Component: React.ComponentType<object>) => Component,
}));

describe('immersive session completion', () => {
  it('renders the selected world completion artwork and preserves the exit CTA', async () => {
    await AsyncStorage.setItem(StorageKey.world, JSON.stringify('dawn'));

    const view = render(
      <WorldProvider>
        <SessionCompleteScreen />
      </WorldProvider>
    );

    await waitFor(() =>
      expect(view.UNSAFE_getByType(Image).props.source).toBe(WORLD_BY_ID.dawn.artwork.completion)
    );

    expect(screen.getByTestId(TID.Screen.SessionComplete)).toBeTruthy();
    expect(screen.getByTestId('complete.saved')).toHaveTextContent(
      'This practice is saved on this device.'
    );
    expect(screen.getByTestId('complete.rest')).toHaveTextContent(
      'That is enough for tonight. Come back when you want to.'
    );
    expect(screen.queryByText(/days in a row/i)).toBeNull();
    expect(screen.queryByText('world.dawn.progress.discovery')).toBeNull();
    const finish = screen.getByTestId('btn.complete.home');
    expect(finish.props.accessibilityRole).toBe('button');
    expect(finish.props.accessibilityLabel ?? 'Back to home').toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to home' })).toBeTruthy();
    fireEvent.press(finish);

    expect(mockReplace).toHaveBeenCalledWith('/(drawer)/(tabs)');
  });
});
