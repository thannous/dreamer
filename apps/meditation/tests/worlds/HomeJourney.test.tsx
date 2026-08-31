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
import { OnboardingProvider } from '@/context/OnboardingContext';
import { WorldProvider } from '@/context/WorldContext';
import { TID } from '@/lib/testIDs';
import { INITIAL_LIBRARY, INITIAL_ONBOARDING } from '@/lib/types';
import { StorageKey } from '@/services/storageService';

const mockPush = jest.fn();
const mockOpenPaywall = jest.fn();
const mockDimensions = { width: 360, height: 800, scale: 3, fontScale: 1 };
let mockSessionGate:
  | { allowed: true }
  | { allowed: false; reason: 'premium-session' | 'monthly-quota' } = {
  allowed: true,
};
let mockRemainingPlays = 3;
let mockQuotaResetDay = '2026-09-01';
let mockIsPlus = false;
let mockSubscriptionsEnabled = true;
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
    remainingPlays: mockRemainingPlays,
    quotaResetDay: mockQuotaResetDay,
    isPlus: mockIsPlus,
    subscriptionsEnabled: mockSubscriptionsEnabled,
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
      <OnboardingProvider>
        <WorldProvider>
          <LibraryProvider>{children}</LibraryProvider>
        </WorldProvider>
      </OnboardingProvider>
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
    mockRemainingPlays = 3;
    mockQuotaResetDay = '2026-09-01';
    mockIsPlus = false;
    mockSubscriptionsEnabled = true;
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
    expect(screen.getByTestId('home.journey.ritual-access')).toHaveTextContent('Free');
    expect(screen.getByTestId('home.journey.ritual-access')).not.toHaveTextContent('Plus');
    expect(screen.getByTestId('home.journey.upcoming.dream-threshold.access')).toHaveTextContent('Plus');
    expect(screen.getByTestId('home.journey.upcoming.dream-lucid.access')).toHaveTextContent('Plus');
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

    await AsyncStorage.setItem(
      StorageKey.onboarding,
      JSON.stringify({
        ...INITIAL_ONBOARDING,
        completed: true,
        goals: ['sleep'],
        dailyIntentionMin: 5,
      })
    );

    renderHome();

    const resume = await screen.findByRole('button', { name: /Continue the journey/i });
    expect(resume).toHaveTextContent(/^Resume$/);
    expect(resume).not.toHaveTextContent(/Continue the journey/i);
    expect(screen.getByTestId('home.journey.reason')).toHaveTextContent('Where you left off');
    expect(screen.getByTestId('home.journey.reason')).not.toHaveTextContent(/Recommended because/);
    expect(screen.queryByTestId('world.path.progress')).toBeTruthy();
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
    const resume = await screen.findByTestId(ACTIVE_JOURNEY_CTA_TEST_ID);
    expect(resume).toHaveTextContent('See Plus options');
    fireEvent.press(resume);

    expect(mockOpenPaywall).toHaveBeenCalledWith('premium-session');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows at most three upcoming practices and opens one from the rail', async () => {
    renderHome();

    await act(async () => {
      await Promise.resolve();
    });

    const upcoming = screen.getAllByTestId(/^home\.journey\.upcoming\.[^.]+$/);
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
    const activeWorld = within(screen.getByRole('radio', { name: 'Constellation' }));
    expect(activeWorld.getByText('Enter the night').props.numberOfLines).toBeUndefined();
    expect(activeWorld.getByText('Before sleep').props.numberOfLines).toBeUndefined();
    expect(screen.getByTestId('home.world-switcher.tide.locked')).toBeTruthy();
    expect(screen.queryByTestId('home.world-switcher.tide.owned')).toBeNull();
    expect(screen.getByTestId('home.journey.ritual-access')).toHaveTextContent('Free');
    expect(screen.getByTestId('home.journey.reason').props.numberOfLines).toBeUndefined();
    const ritualTitle = screen.getByTestId('home.journey.ritual-title');
    expect(ritualTitle).toHaveTextContent('Bringing the breath down');
    expect(ritualTitle.props.numberOfLines).toBeUndefined();
    expect(ritualTitle.props.adjustsFontSizeToFit).toBeUndefined();
    expect(ritualTitle.props.allowFontScaling).not.toBe(false);
    const upcomingTitle = screen.getByTestId('home.journey.upcoming.dream-threshold.title');
    expect(upcomingTitle).toHaveTextContent('The threshold');
    expect(upcomingTitle.props.numberOfLines).toBeUndefined();
    expect(upcomingTitle.props.adjustsFontSizeToFit).toBeUndefined();
    expect(upcomingTitle.props.allowFontScaling).not.toBe(false);
    expect(screen.getAllByTestId(/^home\.journey\.upcoming\.[^.]+$/).length).toBeLessThanOrEqual(3);
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

  it('reveals the hydrated initial world once without recentering later choices', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
    try {
      await AsyncStorage.setItem(StorageKey.world, JSON.stringify('forest'));

      renderHome();

      await waitFor(() =>
        expect(
          screen.getByRole('radio', { name: 'Inner forest' }).props.accessibilityState
        ).toMatchObject({ checked: true })
      );
      await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1));
      const cardWidth = StyleSheet.flatten(
        screen.getByTestId('home.world-switcher.forest').props.style
      ).width;
      expect(scrollTo).toHaveBeenCalledWith({
        x: 2 * (cardWidth + 12),
        y: 0,
        animated: false,
      });

      fireEvent.press(screen.getByRole('radio', { name: 'Inner dawn' }));

      await waitFor(() =>
        expect(
          screen.getByRole('radio', { name: 'Inner dawn' }).props.accessibilityState
        ).toMatchObject({ checked: true })
      );
      expect(scrollTo).toHaveBeenCalledTimes(1);
    } finally {
      scrollTo.mockRestore();
    }
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
    const worldName = active.getByTestId('home.world-switcher.constellation.name');
    expect(worldName).toHaveTextContent('Constellation');
    expect(worldName.props.numberOfLines).toBeUndefined();
    expect(worldName.props.adjustsFontSizeToFit).toBeUndefined();
    expect(worldName.props.allowFontScaling).not.toBe(false);
  });

  it('previews a one-time purchase world from the selected card', async () => {
    renderHome();

    const tide = await screen.findByRole('radio', { name: 'Deep tide' });
    expect(tide.props.accessibilityHint).toMatch(/One-time purchase/);
    expect(tide.props.accessibilityHint).toMatch(/0,99/);
    expect(screen.getByTestId('home.world-switcher.tide.locked')).toHaveTextContent('0,99 €');
    expect(screen.queryByTestId('home.world-switcher.tide.owned')).toBeNull();
    expect(within(screen.getByTestId('home.world-switcher.tide')).queryByText('This world is yours')).toBeNull();

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
    expect(screen.getByTestId('home.world-switcher.tide.owned')).toHaveTextContent('This world is yours');
    expect(screen.queryByTestId('home.world-switcher.tide.locked')).toBeNull();
    expect(tide.props.accessibilityHint).toMatch(/This world is yours/);
    expect(tide.props.accessibilityHint).not.toMatch(/One-time purchase/);
    fireEvent.press(tide);

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Deep tide' }).props.accessibilityState).toMatchObject({
        checked: true,
      })
    );
    expect(screen.queryByText('Plus')).toBeNull();
    expect(screen.getByTestId('home.journey.ritual-access')).toHaveTextContent('Free');
    expect(screen.getByTestId('home.journey.ritual-access')).not.toHaveTextContent('Plus');
    expect(screen.getByTestId(ACTIVE_JOURNEY_CTA_TEST_ID)).toHaveTextContent(/^Begin$/);
    expect(screen.getAllByTestId(/^home\.journey\.upcoming\.[^.]+$/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('home.journey.upcoming.stress-unclench.access')).toHaveTextContent('Free');
    expect(screen.getByTestId('home.journey.upcoming.stress-storm.access')).toHaveTextContent('Free');
  });

  it('does not show an exhausted monthly quota for a practice included in an owned world', async () => {
    mockOwnedWorldIds.add('tide');
    mockSessionGate = { allowed: false, reason: 'monthly-quota' };
    mockRemainingPlays = 0;
    renderHome();

    fireEvent.press(await screen.findByRole('radio', { name: 'Deep tide' }));

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Deep tide' }).props.accessibilityState).toMatchObject({
        checked: true,
      })
    );

    expect(screen.queryByTestId('home.journey.quota')).toBeNull();
    expect(screen.queryByTestId('home.journey.quota-reset')).toBeNull();
    expect(screen.queryByTestId('home.journey.quota-alternative')).toBeNull();
    expect(screen.getByTestId('home.journey.ritual-access')).toHaveTextContent('Free');
    expect(screen.getByTestId('home.journey.ritual-access')).not.toHaveTextContent('Quota used');

    const cta = screen.getByTestId(ACTIVE_JOURNEY_CTA_TEST_ID);
    expect(cta).toHaveTextContent(/^Begin$/);
    fireEvent.press(cta);

    expect(mockOpenPaywall).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/session\/.+\?worldId=tide$/));
  });

  it('shows remaining free sessions before the home CTA', async () => {
    mockRemainingPlays = 2;
    renderHome();

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('home.journey.quota')).toHaveTextContent(
      /2 free sessions left this month/
    );
    expect(screen.getByTestId('home.journey.ritual-access')).toHaveTextContent('Free');
    expect(screen.getByTestId('home.journey.ritual-access')).not.toHaveTextContent('Quota used');
    expect(screen.getByTestId('home.journey.quota-reset')).toHaveTextContent(
      /Resets on 1 September 2026/
    );
    expect(screen.getByTestId(ACTIVE_JOURNEY_CTA_TEST_ID)).toHaveTextContent(/^Begin$/);
    expect(screen.getByTestId('home.journey.quota')).not.toHaveTextContent('2026-09-01');
  });

  it('opens the paywall with a Plus CTA instead of pretending to begin a gated ritual', async () => {
    await AsyncStorage.setItem(
      StorageKey.favorites,
      JSON.stringify({
        ...INITIAL_LIBRARY,
        progress: {
          'sleep-descent': {
            positionSec: 600,
            completedCount: 1,
            lastPlayedISO: '2026-08-20T20:00:00.000Z',
          },
        },
      })
    );
    mockSessionGate = { allowed: false, reason: 'premium-session' };

    renderHome();

    const cta = await screen.findByTestId(ACTIVE_JOURNEY_CTA_TEST_ID);
    expect(cta).toHaveTextContent('See Plus options');
    expect(screen.getByTestId('home.journey.ritual-access')).toHaveTextContent('Plus');
    expect(screen.getByTestId('home.journey.ritual-access')).not.toHaveTextContent('Free');
    expect(within(screen.getByTestId('home.journey.ritual-glass')).getByText('Plus')).toBeTruthy();

    fireEvent.press(cta);

    expect(mockOpenPaywall).toHaveBeenCalledWith('premium-session');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('keeps a playable Begin CTA when Plus is active', async () => {
    mockIsPlus = true;
    mockRemainingPlays = Number.POSITIVE_INFINITY;
    mockSessionGate = { allowed: true };

    renderHome();

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId(ACTIVE_JOURNEY_CTA_TEST_ID)).toHaveTextContent(/^Begin$/);
    expect(screen.getByTestId('home.journey.ritual-access')).toHaveTextContent('Free');
    expect(screen.getByTestId('home.journey.ritual-access')).not.toHaveTextContent('Quota used');
    expect(screen.queryByTestId('home.journey.quota')).toBeNull();
    fireEvent.press(screen.getByTestId(ACTIVE_JOURNEY_CTA_TEST_ID));
    expect(mockPush).toHaveBeenCalledWith('/session/sleep-descent?worldId=constellation');
    expect(mockOpenPaywall).not.toHaveBeenCalled();
  });

  it('replaces replay with an honest exhausted-quota action and a breathe alternative', async () => {
    mockSessionGate = { allowed: false, reason: 'monthly-quota' };
    mockRemainingPlays = 0;

    renderHome();

    const cta = await screen.findByTestId(ACTIVE_JOURNEY_CTA_TEST_ID);
    expect(cta).toHaveTextContent('See Plus options');
    expect(screen.getByTestId('home.journey.ritual-access')).toHaveTextContent('Quota used');
    expect(screen.getByTestId('home.journey.ritual-access')).not.toHaveTextContent('Free');
    expect(cta.props.accessibilityLabel).toMatch(/Quota used/);
    expect(cta.props.accessibilityLabel).not.toMatch(/Free/);
    expect(cta.props.accessibilityLabel).not.toMatch(/Gratuit/);
    expect(screen.getByTestId('home.journey.quota')).toHaveTextContent(
      /No free sessions left this month/
    );
    expect(screen.getByTestId('home.journey.quota-reset')).toHaveTextContent(
      /Resets on 1 September 2026/
    );

    fireEvent.press(cta);
    expect(mockOpenPaywall).toHaveBeenCalledWith('monthly-quota');
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('home.journey.quota-alternative'));
    expect(mockPush).toHaveBeenCalledWith('/breathe');
  });

  it('explains opposing goal-driven recommendations without exposing a raw goal label', async () => {
    await AsyncStorage.setItem(
      StorageKey.onboarding,
      JSON.stringify({
        ...INITIAL_ONBOARDING,
        completed: true,
        goals: ['sleep'],
        dailyIntentionMin: 10,
      })
    );

    const first = renderHome();
    await screen.findByTestId(TID.Screen.Home);
    expect(screen.getByTestId('home.journey.reason')).toHaveTextContent(
      /Recommended because you chose Sleep better/
    );
    expect(screen.getByTestId('home.journey.reason')).not.toHaveTextContent(/^Sleep better$/);
    expect(screen.getByTestId(ACTIVE_JOURNEY_CTA_TEST_ID)).toHaveTextContent(/^Begin$/);
    first.unmount();

    await AsyncStorage.setItem(
      StorageKey.onboarding,
      JSON.stringify({
        ...INITIAL_ONBOARDING,
        completed: true,
        goals: ['anxiety'],
        dailyIntentionMin: 5,
      })
    );
    renderHome();
    await screen.findByTestId(TID.Screen.Home);
    expect(screen.getByTestId('home.journey.reason')).toHaveTextContent(
      /Recommended because you chose Calm anxiety/
    );
  });

  it('recommends a 5-minute catalogue practice when the world path is too long', async () => {
    await AsyncStorage.setItem(
      StorageKey.onboarding,
      JSON.stringify({
        ...INITIAL_ONBOARDING,
        completed: true,
        goals: ['sleep'],
        dailyIntentionMin: 5,
      })
    );

    renderHome();
    await screen.findByTestId(TID.Screen.Home);
    expect(screen.getByTestId('home.journey.reason')).toHaveTextContent(
      /Recommended because you chose Sleep better and have 5 minutes/
    );
    expect(screen.getByTestId('home.journey.ritual-overline')).toHaveTextContent(
      'Recommended for you'
    );
    expect(screen.queryByTestId('world.path.progress')).toBeNull();
    expect(screen.getAllByTestId(/^home\.journey\.upcoming\.[^.]+$/).length).toBeGreaterThan(0);
    fireEvent.press(screen.getByTestId(ACTIVE_JOURNEY_CTA_TEST_ID));
    expect(mockPush).toHaveBeenCalledWith('/session/sleep-quick-fall?worldId=constellation');
  });

  it('keeps a gated access fallback instead of pretending a premium path is playable', async () => {
    await AsyncStorage.setItem(
      StorageKey.onboarding,
      JSON.stringify({
        ...INITIAL_ONBOARDING,
        completed: true,
        goals: ['dream-prep'],
        dailyIntentionMin: 20,
      })
    );
    mockSessionGate = { allowed: false, reason: 'premium-session' };

    renderHome();
    const cta = await screen.findByTestId(ACTIVE_JOURNEY_CTA_TEST_ID);
    expect(cta).toHaveTextContent('See Plus options');
    fireEvent.press(cta);
    expect(mockOpenPaywall).toHaveBeenCalledWith('premium-session');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('keeps the daily ritual above weekly metrics so the first action is practice, not a scoreboard', async () => {
    renderHome();

    await act(async () => {
      await Promise.resolve();
    });

    const flatten = (node: { props?: { testID?: unknown }; children?: unknown[] }, acc: string[] = []): string[] => {
      const testID = node.props?.testID;
      if (typeof testID === 'string') acc.push(testID);
      const children = Array.isArray(node.children) ? node.children : [];
      children.forEach((child) => {
        if (child && typeof child === 'object') {
          flatten(child as { props?: { testID?: unknown }; children?: unknown[] }, acc);
        }
      });
      return acc;
    };
    const ids = flatten(screen.UNSAFE_root);
    expect(ids.indexOf('home.journey.deck')).toBeGreaterThan(-1);
    expect(ids.indexOf('home.journey.week')).toBeGreaterThan(ids.indexOf('home.journey.deck'));
    expect(screen.getByTestId(ACTIVE_JOURNEY_CTA_TEST_ID)).toHaveTextContent(/^Begin$/);
  });

  it('never uses a Begin CTA when the recommended ritual is gated, and still offers an immediate breathe alternative', async () => {
    mockSessionGate = { allowed: false, reason: 'premium-session' };

    renderHome();

    const cta = await screen.findByTestId(ACTIVE_JOURNEY_CTA_TEST_ID);
    expect(cta).toHaveTextContent('See Plus options');
    expect(cta).not.toHaveTextContent(/^Begin$/);
    expect(screen.getByTestId('home.journey.quota-alternative')).toHaveTextContent('Or just breathe');

    fireEvent.press(cta);
    expect(mockOpenPaywall).toHaveBeenCalledWith('premium-session');
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('home.journey.quota-alternative'));
    expect(mockPush).toHaveBeenCalledWith('/breathe');
  });

  it('keeps Begin on a remaining free quota and never opens the paywall from that CTA', async () => {
    mockRemainingPlays = 1;
    mockSessionGate = { allowed: true };

    renderHome();

    await act(async () => {
      await Promise.resolve();
    });

    const cta = screen.getByTestId(ACTIVE_JOURNEY_CTA_TEST_ID);
    expect(cta).toHaveTextContent(/^Begin$/);
    expect(screen.getByTestId('home.journey.ritual-access')).toHaveTextContent('Free');
    expect(screen.getByTestId('home.journey.ritual-access')).not.toHaveTextContent('Quota used');
    expect(screen.getByTestId('home.journey.quota')).toHaveTextContent(/1 free session left this month/);
    fireEvent.press(cta);
    expect(mockPush).toHaveBeenCalledWith('/session/sleep-descent?worldId=constellation');
    expect(mockOpenPaywall).not.toHaveBeenCalled();
  });

  it('presents a premium ritual as freely playable while subscriptions are disabled', async () => {
    await AsyncStorage.setItem(
      StorageKey.onboarding,
      JSON.stringify({
        ...INITIAL_ONBOARDING,
        completed: true,
        goals: ['dream-prep'],
        dailyIntentionMin: 20,
      })
    );
    mockSubscriptionsEnabled = false;
    mockIsPlus = true;
    mockRemainingPlays = 0;
    mockSessionGate = { allowed: false, reason: 'premium-session' };

    renderHome();

    const cta = await screen.findByTestId(ACTIVE_JOURNEY_CTA_TEST_ID);
    expect(cta).toHaveTextContent(/^Begin$/);
    expect(screen.getByTestId('home.journey.ritual-access')).toHaveTextContent('Free');
    expect(screen.getByTestId('home.journey.ritual-access')).not.toHaveTextContent('Plus');
    expect(screen.queryByText('Plus')).toBeNull();
    expect(screen.queryByTestId('home.journey.quota')).toBeNull();
    expect(screen.queryByTestId('home.journey.quota-alternative')).toBeNull();

    fireEvent.press(cta);
    expect(mockOpenPaywall).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/session\/.+\?worldId=constellation$/));
  });

  it('shows upcoming premium practices as free while subscriptions are disabled', async () => {
    mockSubscriptionsEnabled = false;
    mockIsPlus = true;
    mockRemainingPlays = 0;
    mockSessionGate = { allowed: false, reason: 'monthly-quota' };

    renderHome();

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('home.journey.ritual-access')).toHaveTextContent('Free');
    expect(screen.getByTestId('home.journey.upcoming.dream-threshold.access')).toHaveTextContent('Free');
    expect(screen.getByTestId('home.journey.upcoming.dream-lucid.access')).toHaveTextContent('Free');
    expect(screen.getByTestId('home.journey.upcoming.dream-threshold.access')).not.toHaveTextContent('Plus');
    expect(screen.getByTestId('home.journey.upcoming.dream-lucid.access')).not.toHaveTextContent('Plus');
    expect(screen.queryByText('Plus')).toBeNull();
    expect(screen.queryByText('No free sessions left this month')).toBeNull();
    expect(screen.queryByTestId('home.journey.quota')).toBeNull();

    fireEvent.press(screen.getByTestId('home.journey.upcoming.dream-threshold'));
    expect(mockPush).toHaveBeenCalledWith('/session/dream-threshold?worldId=constellation');
    expect(mockOpenPaywall).not.toHaveBeenCalled();
  });

});
