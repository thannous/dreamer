import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { processColor, StyleSheet } from 'react-native';

import ProfileTab from '@/app/(drawer)/(tabs)/profile';
import SearchTab from '@/app/(drawer)/(tabs)/search';
import CategoryScreen from '@/app/category/[slug]';
import {
  CATEGORY_ARTWORK_BY_APPEARANCE,
  SESSION_ARTWORK_BY_APPEARANCE,
} from '@/constants/catalogArtwork';
import { ArtworkGlass } from '@/constants/theme';
import { CATEGORIES } from '@/content/categories';
import { WORLD_BY_ID, type WorldId } from '@/constants/worlds';
import { WorldProvider } from '@/context/WorldContext';
import { TID } from '@/lib/testIDs';
import type { PracticeEntry } from '@/lib/types';
import { StorageKey } from '@/services/storageService';

const mockPush = jest.fn();
let mockLibraryState: { favorites: string[]; practiceLog: PracticeEntry[] } = {
  favorites: [],
  practiceLog: [],
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useIsFocused: () => true,
  useLocalSearchParams: () => ({ slug: 'sleep' }),
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

jest.mock('@/context/LibraryContext', () => ({
  useLibrary: () => mockLibraryState,
}));

jest.mock('uniwind', () => ({
  ScopedTheme: ({ children }: React.PropsWithChildren<{ theme: string }>) => children,
  Uniwind: { setTheme: jest.fn() },
  useUniwind: () => ({ theme: 'dark' }),
  withUniwind: (Component: React.ComponentType<object>) => Component,
}));

const renderInWorld = async (
  screenName: 'search' | 'profile' | 'category',
  worldId: WorldId
) => {
  await AsyncStorage.setItem(StorageKey.world, JSON.stringify(worldId));
  const view = render(
    screenName === 'search' ? (
      <SearchTab />
    ) : screenName === 'profile' ? (
      <ProfileTab />
    ) : (
      <CategoryScreen />
    ),
    { wrapper: WorldProvider }
  );

  await waitFor(() =>
    expect(
      view.root.findByProps({ testID: `world-scene-motion.${WORLD_BY_ID[worldId].motion}` })
    ).toBeTruthy()
  );

  return view;
};

describe('Search and Profile world surfaces', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockPush.mockClear();
    mockLibraryState = { favorites: [], practiceLog: [] };
  });

  it.each([
    ['dawn', 'light'],
    ['constellation', 'dark'],
  ] as const)('renders Search with the %s world and %s glass', async (worldId, appearance) => {
    await renderInWorld('search', worldId);

    const categoryGlass = screen.getByTestId(`search.category-glass.${CATEGORIES[0].slug}`);
    const sessionGlass = screen.getByTestId(`${TID.Option.SearchSleepDescent}.glass`);

    expect(screen.getByTestId(TID.Screen.Search)).toBeTruthy();
    const categoryArtwork = screen.getByTestId(
      `search.category-glass.${CATEGORIES[0].slug}.artwork`
    );
    expect(categoryArtwork.props.source).toEqual([
      CATEGORY_ARTWORK_BY_APPEARANCE[appearance][CATEGORIES[0].slug],
    ]);
    expect(StyleSheet.flatten(categoryArtwork.props.style).opacity).toBe(
      ArtworkGlass[appearance].artworkOpacity
    );
    const sessionArtwork = screen.getByTestId(
      `${TID.Option.SearchSleepDescent}.glass.artwork`
    );
    expect(sessionArtwork.props.source).toEqual([
      SESSION_ARTWORK_BY_APPEARANCE[appearance]['sleep-descent'],
    ]);
    expect(
      screen.getByTestId(`search.category-glass.${CATEGORIES[0].slug}.artwork-scrim`).props.colors
    ).toEqual(ArtworkGlass[appearance].artworkScrim.map(processColor));
    expect(
      screen.getByTestId(`${TID.Option.SearchSleepDescent}.glass.artwork-scrim`).props.colors
    ).toEqual(ArtworkGlass[appearance].artworkScrim.map(processColor));
    expect(StyleSheet.flatten(categoryGlass.props.style).backgroundColor).toBe(
      ArtworkGlass[appearance].artworkFill
    );
    expect(StyleSheet.flatten(sessionGlass.props.style).backgroundColor).toBe(
      ArtworkGlass[appearance].artworkFill
    );
  });

  it.each([
    ['dawn', 'light'],
    ['constellation', 'dark'],
  ] as const)('renders Profile with the %s world and %s glass', async (worldId, appearance) => {
    await renderInWorld('profile', worldId);

    const emptyGlass = screen.getByTestId('profile.empty-glass');
    const actionsGlass = screen.getByTestId('profile.actions-glass');

    expect(screen.getByTestId(TID.Screen.Profile)).toBeTruthy();
    expect(StyleSheet.flatten(emptyGlass.props.style).backgroundColor).toBe(
      ArtworkGlass[appearance].fill
    );
    expect(StyleSheet.flatten(actionsGlass.props.style).backgroundColor).toBe(
      ArtworkGlass[appearance].fill
    );
  });

  it.each([
    ['dawn', 'light'],
    ['constellation', 'dark'],
  ] as const)('renders Category with the %s world and %s glass', async (worldId, appearance) => {
    await renderInWorld('category', worldId);

    const heroArtwork = screen.getByTestId('category.hero.artwork');
    const heroScrim = screen.getByTestId('category.hero.artwork-scrim');
    const rowGlass = screen.getByTestId('category.session.sleep-descent.glass');
    const rowArtwork = screen.getByTestId('category.session.sleep-descent.glass.artwork');

    expect(heroArtwork.props.source).toEqual([
      CATEGORY_ARTWORK_BY_APPEARANCE[appearance][CATEGORIES[0].slug],
    ]);
    expect(rowArtwork.props.source).toEqual([
      SESSION_ARTWORK_BY_APPEARANCE[appearance]['sleep-descent'],
    ]);
    expect(StyleSheet.flatten(rowGlass.props.style).backgroundColor).toBe(
      ArtworkGlass[appearance].artworkFill
    );

    if (appearance === 'light') {
      expect(heroScrim.props.colors).toEqual(
        ArtworkGlass.light.artworkScrim.map(processColor)
      );
      expect(heroScrim.props.locations).toEqual([...ArtworkGlass.light.artworkScrimLocations]);
      expect(heroScrim.props.startPoint).toEqual([0, 1]);
      expect(heroScrim.props.endPoint).toEqual([
        ArtworkGlass.light.artworkScrimEnd.x,
        ArtworkGlass.light.artworkScrimEnd.y,
      ]);
    } else {
      expect(heroScrim.props.colors).toEqual(
        ['rgba(13, 11, 28, 0.06)', 'rgba(13, 11, 28, 0.82)'].map(processColor)
      );
      expect(heroScrim.props.locations).toEqual([0.25, 1]);
    }
  });

  it('keeps populated Profile statistics and calendar on single light-glass surfaces', async () => {
    mockLibraryState = {
      favorites: ['sleep-descent'],
      practiceLog: [
        {
          dateISO: '2026-08-25',
          sessionId: 'sleep-descent',
          seconds: 600,
        },
      ],
    };

    await renderInWorld('profile', 'dawn');

    expect(screen.queryByTestId('profile.empty-glass')).toBeNull();
    expect(
      StyleSheet.flatten(screen.getByTestId(TID.Text.ProfileStreak).props.style).backgroundColor
    ).toBe(ArtworkGlass.light.fill);
    expect(
      StyleSheet.flatten(screen.getByTestId('profile.calendar-glass').props.style).backgroundColor
    ).toBe(ArtworkGlass.light.fill);
  });
});
