/* eslint-disable @typescript-eslint/no-require-imports -- Jest hoists module factories above imports. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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
let mockIsPlus = false;

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
  DrawerButtonClearance: 56,
  accessibleTabBarHeight: (baseHeight: number, fontScale: number) =>
    Math.ceil(baseHeight + Math.max(0, fontScale - 1) * 44),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const SafeAreaView = ({ children, ...props }: React.PropsWithChildren<object>) =>
    React.createElement(View, props, children);
  return {
    SafeAreaView,
    SafeAreaProvider: ({ children }: React.PropsWithChildren) =>
      React.createElement(View, null, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
  };
});

jest.mock('@/context/LibraryContext', () => ({
  useLibrary: () => mockLibraryState,
}));

jest.mock('@/context/SubscriptionContext', () => ({
  useSubscription: () => ({ isPlus: mockIsPlus }),
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
    mockIsPlus = false;
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

  it('lets Search category titles wrap instead of truncating them', async () => {
    await renderInWorld('search', 'constellation');

    expect(screen.getByTestId('search.category-title.dream-prep').props.numberOfLines).toBeUndefined();
    expect(screen.getByTestId(TID.Screen.Search).props.contentContainerStyle).toEqual(
      expect.objectContaining({ paddingBottom: 96 })
    );
    expect(screen.getByTestId('search.title-row').props.style).toEqual(
      expect.objectContaining({ paddingRight: 56 })
    );
    expect(screen.getByTestId(TID.Option.CategoryDreamPrep).props.accessibilityHint).toBe(
      'Ask the night a question'
    );
  });

  it('distinguishes free Search cards from Plus category rows by all three benefits', async () => {
    await renderInWorld('search', 'constellation');

    const prefix = TID.Option.SearchSleepDescent;
    expect(screen.getByTestId(`${prefix}.title`).props.numberOfLines).toBeUndefined();
    expect(screen.getByTestId(`${prefix}.benefit.1`)).toHaveTextContent('Slows the heart rate');
    expect(screen.getByTestId(`${prefix}.benefit.1`).props.numberOfLines).toBeUndefined();
    expect(screen.getByTestId(`${prefix}.benefit.2`)).toHaveTextContent('Prepares for sleep');
    expect(screen.getByTestId(`${prefix}.benefit.3`)).toHaveTextContent('Done lying down');
    expect(screen.getByTestId(`${prefix}.access`)).toHaveTextContent('Free');
    expect(screen.getByTestId(`${prefix}.access`)).not.toHaveTextContent('Plus');
    expect(screen.getByTestId(prefix).props.accessibilityLabel).toEqual(
      expect.stringContaining('Slows the heart rate. Prepares for sleep. Done lying down. Free')
    );
  });

  it('marks a saved Plus category row as Plus and saved, with three readable benefits', async () => {
    mockLibraryState = { favorites: ['sleep-body-scan'], practiceLog: [] };

    await renderInWorld('category', 'constellation');

    expect(screen.getByTestId('category.session.sleep-body-scan.access')).toHaveTextContent('Plus');
    expect(screen.getByTestId('category.session.sleep-body-scan.access')).not.toHaveTextContent('Free');
    expect(screen.getByTestId('category.session.sleep-body-scan.saved')).toHaveTextContent(
      'Saved, but Plus is still required'
    );
    expect(screen.getByTestId('category.session.sleep-body-scan.benefit.1')).toHaveTextContent(
      'Releases tension'
    );
    expect(screen.getByTestId('category.session.sleep-body-scan.benefit.2')).toHaveTextContent(
      'Anchors attention'
    );
    expect(screen.getByTestId('category.session.sleep-body-scan.benefit.3')).toHaveTextContent(
      'A long practice'
    );
    expect(screen.getByTestId('category.session.sleep-body-scan.benefit.1').props.numberOfLines).toBeUndefined();
    expect(screen.getByTestId('category.session.sleep-body-scan').props.accessibilityLabel).toEqual(
      expect.stringContaining('Releases tension. Anchors attention. A long practice. Plus')
    );
  });

  it('offers a recent session before streak metrics and keeps saved Plus sessions as bookmarks', async () => {
    mockLibraryState = {
      favorites: ['sleep-body-scan'],
      practiceLog: [
        {
          dateISO: '2026-08-24',
          sessionId: 'sleep-descent',
          seconds: 600,
        },
      ],
    };

    await renderInWorld('profile', 'dawn');

    expect(screen.getByTestId('profile.return-glass')).toBeTruthy();
    expect(screen.getByTestId('profile.return.subtitle')).toHaveTextContent(
      'Return to Bringing the breath down · 10 min'
    );
    expect(screen.getByTestId('profile.return.cta')).toHaveTextContent('Open this session');
    expect(screen.getByText('Days this week')).toBeTruthy();
    expect(screen.queryByText('Best run')).toBeNull();
    expect(screen.queryByText('Not yet today')).toBeNull();
    expect(screen.getByTestId('profile.favorites.locked')).toHaveTextContent(
      'Saved sessions stay bookmarks. Plus is still required to play the locked ones.'
    );

    fireEvent.press(screen.getByTestId('profile.return.cta'));
    expect(mockPush).toHaveBeenCalledWith('/session/sleep-descent');
  });

  it('keeps the Profile title clear of the drawer button', async () => {
    await renderInWorld('profile', 'dawn');

    expect(screen.getByTestId('profile.title-row').props.style).toEqual(
      expect.objectContaining({ paddingRight: 56 })
    );
  });

  it('marks an unlocked Plus session as owned rather than locked', async () => {
    mockIsPlus = true;
    mockLibraryState = { favorites: ['sleep-body-scan'], practiceLog: [] };

    await renderInWorld('category', 'constellation');

    expect(screen.getByTestId('category.session.sleep-body-scan.access')).toHaveTextContent(
      'Noctalia Plus is active'
    );
    expect(screen.getByTestId('category.session.sleep-body-scan.saved')).toHaveTextContent('Saved');
    expect(screen.getByTestId('category.session.sleep-body-scan.saved')).not.toHaveTextContent(
      'Saved, but Plus is still required'
    );
    expect(screen.getByTestId('category.session.sleep-body-scan').props.accessibilityLabel).toEqual(
      expect.stringContaining('Noctalia Plus is active')
    );
  });

});
