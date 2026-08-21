import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import HomeTab from '@/app/(drawer)/(tabs)/index';
import { LibraryProvider } from '@/context/LibraryContext';
import { WorldProvider } from '@/context/WorldContext';
import { TID } from '@/lib/testIDs';
import { INITIAL_LIBRARY } from '@/lib/types';
import { StorageKey } from '@/services/storageService';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useIsFocused: () => true,
}));

jest.mock('@/hooks/useTabBarInset', () => ({
  useTabBarInset: () => 96,
}));

jest.mock('uniwind', () => {
  return {
    ScopedTheme: ({ children }: React.PropsWithChildren<{ theme: string }>) => children,
    Uniwind: { setTheme: jest.fn() },
    useUniwind: () => ({ theme: 'dark' }),
    withUniwind: (Component: React.ComponentType<object>) => Component,
  };
});

describe('immersive home journey', () => {
  it('preserves the Maestro screen anchor and opens the single recommended ritual', async () => {
    render(
      <WorldProvider>
        <HomeTab />
      </WorldProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId(TID.Screen.Home)).toBeTruthy();

    const primaryAction = screen.getByRole('button', { name: /Begin the journey/i });
    fireEvent.press(primaryAction);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/session\//));
  });

  it('lets the listener change world without losing the home journey', async () => {
    render(
      <WorldProvider>
        <HomeTab />
      </WorldProvider>
    );

    const constellation = screen.getByRole('radio', { name: 'Constellation' });
    const dawn = screen.getByRole('radio', { name: 'Inner dawn' });

    expect(constellation.props.accessibilityState).toMatchObject({ checked: true });
    expect(dawn.props.accessibilityState).toMatchObject({ checked: false });

    fireEvent.press(dawn);

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Inner dawn' }).props.accessibilityState).toMatchObject(
        { checked: true }
      )
    );
    expect(screen.getByTestId(TID.Screen.Home)).toBeTruthy();
    expect(await AsyncStorage.getItem(StorageKey.world)).toBe(JSON.stringify('dawn'));
  });

  it('routes the most recent unfinished session through the gated detail screen', async () => {
    await AsyncStorage.setItem(
      StorageKey.favorites,
      JSON.stringify({
        ...INITIAL_LIBRARY,
        progress: {
          'sleep-descent': {
            positionSec: 180,
            completedCount: 0,
            lastPlayedISO: '2026-08-20T20:00:00.000Z',
          },
        },
      })
    );

    render(
      <WorldProvider>
        <LibraryProvider>
          <HomeTab />
        </LibraryProvider>
      </WorldProvider>
    );

    const resume = await screen.findByRole('button', { name: /Continue the journey/i });
    fireEvent.press(resume);

    expect(mockPush).toHaveBeenCalledWith('/session/sleep-descent');
    expect(mockPush).not.toHaveBeenCalledWith('/player/sleep-descent');
  });
});
