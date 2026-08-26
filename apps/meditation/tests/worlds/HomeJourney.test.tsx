import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native';

import HomeTab from '@/app/(drawer)/(tabs)/index';
import {
  ACTIVE_JOURNEY_CTA_TEST_ID,
  ACTIVE_JOURNEY_WIDTH_RATIO,
  COMPACT_INACTIVE_JOURNEY_MIN_HEIGHT,
  INACTIVE_JOURNEY_MIN_HEIGHT,
} from '@/components/journey/WorldJourneyPicker';
import { LibraryProvider } from '@/context/LibraryContext';
import { WorldProvider } from '@/context/WorldContext';
import { TID } from '@/lib/testIDs';
import { INITIAL_LIBRARY } from '@/lib/types';
import { StorageKey } from '@/services/storageService';

const mockPush = jest.fn();
const mockOpenPaywall = jest.fn();
const mockDimensions = { width: 360, height: 800, scale: 3, fontScale: 1 };
let mockSessionGate: { allowed: true } | { allowed: false; reason: 'premium-session' } = {
  allowed: true,
};
let mockOwnedWorldIds = new Set(['constellation', 'dawn', 'forest']);

let mockIsFocused = true;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useIsFocused: () => mockIsFocused,
}));

jest.mock('@/context/WorldPurchaseContext', () => ({
  useWorldPurchases: () => ({
    loaded: true,
    isWorldOwned: (worldId: string) => mockOwnedWorldIds.has(worldId),
    offerForWorld: (worldId: string) =>
      ['tide', 'sanctuary', 'cloud'].includes(worldId)
        ? { worldId, priceLabel: '0,99 €', raw: null }
        : undefined,
    purchaseWorld: async () => false,
    restoreWorlds: async () => [],
  }),
}));

jest.mock('@/context/SubscriptionContext', () => ({
  useSubscription: () => ({
    gateForSession: () => mockSessionGate,
    openPaywall: mockOpenPaywall,
  }),
}));

jest.mock('@/hooks/useTabBarInset', () => ({
  useTabBarInset: () => 96,
}));

jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  default: () => mockDimensions,
  __esModule: true,
}));

jest.mock('uniwind', () => {
  return {
    ScopedTheme: ({ children }: React.PropsWithChildren<{ theme: string }>) => children,
    Uniwind: { setTheme: jest.fn() },
    useUniwind: () => ({ theme: 'dark' }),
    withUniwind: (Component: React.ComponentType<object>) => Component,
  };
});

function renderHome() {
  return render(<HomeTab />, {
    wrapper: ({ children }) => (
      <WorldProvider>
        <LibraryProvider>{children}</LibraryProvider>
      </WorldProvider>
    ),
  });
}

describe('immersive home journey', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockDimensions.width = 360;
    mockDimensions.height = 800;
    mockDimensions.fontScale = 1;
    mockIsFocused = true;
    mockPush.mockClear();
    mockOpenPaywall.mockClear();
    mockSessionGate = { allowed: true };
    mockOwnedWorldIds = new Set(['constellation', 'dawn', 'forest']);
  });

  it('preserves the Maestro screen anchor and opens the single recommended ritual', async () => {
    const view = renderHome();

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId(TID.Screen.Home)).toBeTruthy();
    expect(screen.getByTestId('home.journey.ritual-glass')).toBeTruthy();
    expect(view.root.findByProps({ testID: 'world-scene-motion.orbit' })).toBeTruthy();

    const primaryAction = screen.getByRole('button', { name: /Begin the journey/i });
    expect(screen.getByTestId(ACTIVE_JOURNEY_CTA_TEST_ID)).toBe(primaryAction);
    expect(primaryAction).toHaveTextContent(/^Begin$/);
    expect(primaryAction).not.toHaveTextContent(/Begin the journey/i);
    expect(
      within(screen.getByTestId('home.world-switcher.constellation')).queryByTestId(
        ACTIVE_JOURNEY_CTA_TEST_ID
      )
    ).toBeNull();
    expect(
      within(screen.getByTestId('home.world-switcher.constellation')).queryAllByRole('button')
    ).toHaveLength(0);

    fireEvent.press(primaryAction);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/session/sleep-descent?worldId=constellation');
  });

  it('shows six worlds and lets the listener persist the third free world', async () => {
    renderHome();

    const constellation = await screen.findByRole('radio', { name: 'Constellation' });
    const forest = screen.getByRole('radio', { name: 'Inner forest' });

    expect(screen.getAllByRole('radio')).toHaveLength(6);
    expect(constellation.props.accessibilityState).toMatchObject({ checked: true });
    expect(forest.props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByTestId('home.world-switcher.current.constellation')).toBeTruthy();

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(forest);

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Inner forest' }).props.accessibilityState).toMatchObject({
        checked: true,
      })
    );
    expect(screen.getByTestId('home.world-switcher.current.forest')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId(ACTIVE_JOURNEY_CTA_TEST_ID)).toBeTruthy()
    );
    expect(screen.getByTestId(TID.Screen.Home)).toBeTruthy();
    await waitFor(async () => {
      expect(await AsyncStorage.getItem(StorageKey.world)).toBe(JSON.stringify('forest'));
    });
    expect(
      within(screen.getByTestId('home.world-switcher.constellation')).queryByTestId(
        ACTIVE_JOURNEY_CTA_TEST_ID
      )
    ).toBeNull();
  });

  it('replaces the ritual, options, and full-screen artwork when the world changes', async () => {
    const view = renderHome();

    const forest = await screen.findByRole('radio', { name: 'Inner forest' });
    expect(screen.getByTestId('home.journey.upcoming.dream-threshold')).toBeTruthy();
    expect(
      screen.getByTestId('home.journey.upcoming-glass.dream-threshold')
    ).toBeTruthy();
    expect(view.root.findByProps({ testID: 'world-scene-motion.orbit' })).toBeTruthy();

    fireEvent.press(forest);

    await waitFor(() =>
      expect(screen.getByTestId('home.journey.upcoming.anxiety-wave')).toBeTruthy()
    );
    expect(screen.queryByTestId('home.journey.upcoming.dream-threshold')).toBeNull();
    expect(view.root.findByProps({ testID: 'world-scene-motion.canopy' })).toBeTruthy();
    expect(screen.queryByTestId('home.journey.ritual-artwork')).toBeNull();
    expect(screen.queryByTestId('home.journey.upcoming-artwork.anxiety-wave')).toBeNull();

    fireEvent.press(screen.getByTestId(ACTIVE_JOURNEY_CTA_TEST_ID));
    expect(mockPush).toHaveBeenCalledWith('/session/anxiety-ground?worldId=forest');
  });

  it('offers the most recent unfinished session before the daily recommendation', async () => {
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

    renderHome();

    const resume = await screen.findByRole('button', { name: /Continue the journey/i });
    expect(resume).toHaveTextContent(/^Resume$/);
    expect(resume).not.toHaveTextContent(/Continue the journey/i);
    fireEvent.press(resume);

    expect(mockPush).toHaveBeenCalledWith('/player/sleep-descent?worldId=constellation');
  });

  it('checks Plus before resuming a gated practice', async () => {
    await AsyncStorage.setItem(
      StorageKey.favorites,
      JSON.stringify({
        ...INITIAL_LIBRARY,
        progress: {
          'dream-threshold': {
            positionSec: 240,
            completedCount: 0,
            lastPlayedISO: '2026-08-22T20:00:00.000Z',
          },
        },
      })
    );
    mockSessionGate = { allowed: false, reason: 'premium-session' };

    renderHome();
    const resume = await screen.findByRole('button', { name: /Continue the journey/i });
    fireEvent.press(resume);

    expect(mockOpenPaywall).toHaveBeenCalledWith('premium-session');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows at most three upcoming practices and opens one from the rail', async () => {
    renderHome();

    await act(async () => {
      await Promise.resolve();
    });

    const upcoming = screen.getAllByTestId(/home\.journey\.upcoming\./);
    expect(upcoming.length).toBeGreaterThan(0);
    expect(upcoming.length).toBeLessThanOrEqual(3);

    fireEvent.press(upcoming[0]);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0][0]).toMatch(/^\/session\/.*\?worldId=constellation$/);
    expect(mockPush.mock.calls[0][0]).not.toMatch(/player/);
  });

  it('keeps the journey readable when Dynamic Type is large on a short viewport', async () => {
    mockDimensions.height = 640;
    mockDimensions.fontScale = 2;

    renderHome();

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId(TID.Screen.Home)).toBeTruthy();
    const cta = screen.getByTestId(ACTIVE_JOURNEY_CTA_TEST_ID);
    expect(cta).toHaveTextContent(/^Begin$/);
    expect(cta).not.toHaveTextContent(/Begin the journey/i);
    expect(screen.getByRole('button', { name: /Begin the journey/i })).toBe(cta);
    expect(screen.getByRole('radio', { name: 'Constellation' })).toBeTruthy();
    expect(screen.getAllByTestId(/home\.journey\.upcoming\./).length).toBeLessThanOrEqual(3);
    expect(useWindowDimensions().fontScale).toBe(2);
  });

  it('uses a horizontal carousel with stable card slots and a visible neighbour', async () => {
    const view = renderHome();

    await act(async () => {
      await Promise.resolve();
    });

    const active = StyleSheet.flatten(screen.getByTestId('home.world-switcher.constellation').props.style);
    const inactive = StyleSheet.flatten(screen.getByTestId('home.world-switcher.dawn').props.style);

    expect(view.UNSAFE_getAllByType(ScrollView).some((node) => node.props.horizontal)).toBe(true);
    expect(active.width).toBeCloseTo((mockDimensions.width - 32) * 0.7, 2);
    expect(inactive.width).toBe(active.width);
    expect(inactive.minHeight).toBe(COMPACT_INACTIVE_JOURNEY_MIN_HEIGHT);
    expect(active.minHeight).toBe(COMPACT_INACTIVE_JOURNEY_MIN_HEIGHT);
  });

  it('preserves the immersive card proportions on a roomy viewport', async () => {
    mockDimensions.width = 390;
    mockDimensions.height = 844;
    const view = renderHome();

    await act(async () => {
      await Promise.resolve();
    });

    const active = StyleSheet.flatten(screen.getByTestId('home.world-switcher.constellation').props.style);
    const inactive = StyleSheet.flatten(screen.getByTestId('home.world-switcher.dawn').props.style);

    expect(view.UNSAFE_getAllByType(ScrollView).some((node) => node.props.horizontal)).toBe(true);
    expect(active.width).toBeCloseTo((mockDimensions.width - 32) * ACTIVE_JOURNEY_WIDTH_RATIO, 2);
    expect(active.minHeight).toBe(INACTIVE_JOURNEY_MIN_HEIGHT);
    expect(inactive.minHeight).toBe(INACTIVE_JOURNEY_MIN_HEIGHT);
  });

  it('keeps the carousel at the listener-controlled position when selecting a world', async () => {
    renderHome();

    const forest = await screen.findByRole('radio', { name: 'Inner forest' });
    expect(screen.getByTestId('home.journey.deck').props.onLayout).toBeUndefined();
    expect(forest.props.onLayout).toBeUndefined();

    fireEvent.press(forest);

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Inner forest' }).props.accessibilityState).toMatchObject({
        checked: true,
      })
    );
    expect(screen.getByTestId('home.journey.deck').props.onLayout).toBeUndefined();
    expect(screen.getByTestId('home.world-switcher.forest').props.onLayout).toBeUndefined();
  });

  it('keeps world choice semantic and the session action outside the radio card', async () => {
    renderHome();

    await act(async () => {
      await Promise.resolve();
    });

    const active = within(screen.getByTestId('home.world-switcher.constellation'));
    const cta = screen.getByTestId(ACTIVE_JOURNEY_CTA_TEST_ID);
    const accessibilityLabel = cta.props.accessibilityLabel as string;
    const [, hiddenSessionTitle, metadata] = accessibilityLabel.split('. ');

    expect(hiddenSessionTitle).toBeTruthy();
    expect(active.queryByText(hiddenSessionTitle)).toBeNull();
    expect(active.queryByTestId(ACTIVE_JOURNEY_CTA_TEST_ID)).toBeNull();
    expect(active.getByText('Enter the night')).toBeTruthy();
    expect(active.getByText('Before sleep')).toBeTruthy();
    expect(cta).toHaveTextContent(/^Begin$/);
    expect(accessibilityLabel).toMatch(/^Begin the journey\./);
    expect(active.queryByText('Plus')).toBeNull();
    expect(active.queryByText('Premium')).toBeNull();
    expect(metadata).toMatch(/min/);
    expect(active.getByText('Constellation').props.numberOfLines).toBe(1);
    expect(active.getByText('Constellation').props.adjustsFontSizeToFit).toBe(true);
  });

  it('previews a one-time purchase world from the selected card', async () => {
    renderHome();

    const tide = await screen.findByRole('radio', { name: 'Deep tide' });
    expect(tide.props.accessibilityHint).toMatch(/One-time purchase/);
    expect(tide.props.accessibilityHint).toMatch(/0,99/);

    fireEvent.press(tide);

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Deep tide' }).props.accessibilityState).toMatchObject({
        checked: false,
      })
    );
    expect(
      screen.getByRole('radio', { name: 'Constellation' }).props.accessibilityState
    ).toMatchObject({ checked: true });

    const purchaseCard = within(screen.getByTestId('home.world-switcher.tide'));
    expect(purchaseCard.queryByTestId(ACTIVE_JOURNEY_CTA_TEST_ID)).toBeNull();
    const discover = screen.getByTestId(ACTIVE_JOURNEY_CTA_TEST_ID);
    expect(discover).toHaveTextContent('Discover');
    expect(screen.queryByTestId('home.journey.up-next')).toBeNull();
    expect(await AsyncStorage.getItem(StorageKey.world)).not.toBe(JSON.stringify('tide'));

    fireEvent.press(discover);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/world/tide');
  });

  it('clears a locked preview when leaving home without persisting it', async () => {
    const view = renderHome();

    const tide = await screen.findByRole('radio', { name: 'Deep tide' });
    fireEvent.press(tide);

    await waitFor(() => expect(screen.getByTestId(ACTIVE_JOURNEY_CTA_TEST_ID)).toHaveTextContent('Discover'));
    expect(await AsyncStorage.getItem(StorageKey.world)).not.toBe(JSON.stringify('tide'));

    mockIsFocused = false;
    view.rerender(<HomeTab />);

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Constellation' }).props.accessibilityState).toMatchObject({
        checked: true,
      })
    );
    expect(screen.getByTestId(ACTIVE_JOURNEY_CTA_TEST_ID)).toHaveTextContent(/^Begin$/);
    expect(await AsyncStorage.getItem(StorageKey.world)).not.toBe(JSON.stringify('tide'));
  });

  it('does not show Plus for curated practices in an owned one-time world', async () => {
    mockOwnedWorldIds.add('tide');
    renderHome();

    const tide = await screen.findByRole('radio', { name: 'Deep tide' });
    fireEvent.press(tide);

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Deep tide' }).props.accessibilityState).toMatchObject({
        checked: true,
      })
    );
    expect(screen.queryByText('Plus')).toBeNull();
    expect(screen.getByTestId(ACTIVE_JOURNEY_CTA_TEST_ID)).toHaveTextContent(/^Begin$/);
    expect(screen.getAllByTestId(/home\.journey\.upcoming\./).length).toBeGreaterThan(0);
  });
});
