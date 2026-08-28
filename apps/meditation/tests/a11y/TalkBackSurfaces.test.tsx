/* eslint-disable @typescript-eslint/no-require-imports -- Jest hoists module factories above imports. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Linking, StyleSheet } from 'react-native';

import { AccessibleTabBar, DrawerButton } from '@/app/(drawer)/(tabs)/_layout';
import SearchTab from '@/app/(drawer)/(tabs)/search';
import PaywallScreen from '@/app/paywall';
import SettingsScreen from '@/app/settings';
import SessionDetail from '@/app/session/[id]';
import WorldPurchaseScreen from '@/app/world/[id]';
import { WorldJourneyPicker } from '@/components/journey/WorldJourneyPicker';
import { MiniPlayer } from '@/components/player/MiniPlayer';
import { StreakCalendar } from '@/components/profile/StreakCalendar';
import { WORLD_BY_ID, WORLD_IDS } from '@/constants/worlds';
import { translate } from '@/lib/i18n';
import { calendarDays } from '@/lib/streak';
import { TID } from '@/lib/testIDs';

const mockOpenDrawer = jest.fn();
const mockPush = jest.fn();
const mockToggle = jest.fn();
const mockToggleFavorite = jest.fn();
let mockFavorite = false;
let mockPlayerStatus: 'idle' | 'paused' | 'playing' = 'paused';
let mockParams: Record<string, string | undefined> = {
  id: 'sleep-descent',
  reason: 'premium-session',
};
const mockSetWorld = jest.fn();
const mockToggleSoundscape = jest.fn();
let mockSoundEnabled = true;
let mockWorldOwned = false;

jest.mock('@/context/LanguageContext', () => ({
  useTranslation: () => ({
    language: 'en',
    setLanguage: async () => {},
    t: (key: string, values?: Record<string, string | number>) => {
      const { translate } = require('@/lib/i18n');
      return translate('en', key, values);
    },
  }),
}));

jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    BlurView: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement(View, props, children),
  };
});

jest.mock('expo-video', () => ({
  VideoView: 'VideoView',
  useVideoPlayer: () => ({ play: jest.fn(), pause: jest.fn() }),
}));

jest.mock('expo-router', () => ({
  Tabs: ({ children }: React.PropsWithChildren) => children,
  useNavigation: () => ({ openDrawer: mockOpenDrawer }),
  usePathname: () => '/',
  useIsFocused: () => true,
  useSegments: () => ['(drawer)', '(tabs)'],
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    canGoBack: () => true,
    replace: jest.fn(),
    dismissTo: jest.fn(),
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: React.PropsWithChildren<object>) =>
      React.createElement(View, props, children),
    SafeAreaProvider: ({ children }: React.PropsWithChildren) =>
      React.createElement(View, null, children),
    useSafeAreaInsets: () => ({ top: 12, right: 0, bottom: 24, left: 0 }),
  };
});

jest.mock('@/hooks/usePressMotion', () => ({
  usePressMotion: () => ({
    style: undefined,
    handlePressIn: jest.fn(),
    handlePressOut: jest.fn(),
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
  accessibleTabBarHeight: (baseHeight: number, fontScale: number) =>
    Math.ceil(baseHeight + Math.max(0, fontScale - 1) * 44),
  DrawerButtonClearance: 56,
}));

jest.mock('@/components/session/SessionArtwork', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SessionArtwork: () => React.createElement(View, { testID: 'mini.artwork' }),
  };
});

jest.mock('@/components/atmosphere/EmptyIllustration', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { EmptyIllustration: () => React.createElement(View, { testID: 'empty-illustration' }) };
});

jest.mock('@/components/session/BenefitList', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { BenefitList: () => React.createElement(View, { testID: 'benefit-list' }) };
});

jest.mock('@/components/journey/PracticeProgress', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { PracticeProgress: () => React.createElement(View, { testID: 'practice-progress' }) };
});

jest.mock('@/context/LibraryContext', () => ({
  useLibrary: () => ({
    isFavorite: () => mockFavorite,
    toggleFavorite: mockToggleFavorite,
    progress: {},
    favorites: [],
    practiceLog: [],
  }),
}));

jest.mock('@/context/SubscriptionContext', () => ({
  useSubscription: () => ({
    isPlus: false,
    remainingPlays: 3,
    quotaResetDay: '2026-09-01',
    applyTier: jest.fn(),
    gateForSession: () => ({ allowed: true }),
    openPaywall: jest.fn(),
  }),
}));

jest.mock('@/context/WorldPurchaseContext', () => ({
  useWorldPurchases: () => ({
    loaded: true,
    isWorldOwned: () => mockWorldOwned,
    offerForWorld: () => ({ worldId: 'tide', priceLabel: '0,99 €', raw: null }),
    purchaseWorld: jest.fn(),
    restoreWorlds: jest.fn(),
  }),
}));

jest.mock('@/context/WorldContext', () => ({
  useWorld: () => ({
    loaded: true,
    worldId: 'constellation',
    world: require('@/constants/worlds').WORLD_BY_ID.constellation,
    previewWorldId: null,
    presentationWorldId: 'constellation',
    presentationWorld: require('@/constants/worlds').WORLD_BY_ID.constellation,
    setWorld: mockSetWorld,
    setPreviewWorld: jest.fn(),
  }),
}));

jest.mock('@/hooks/useWorldSoundscape', () => ({
  useWorldSoundscape: () => ({
    soundEnabled: mockSoundEnabled,
    toggleSound: mockToggleSoundscape,
  }),
}));

jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success' },
  notificationAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
}));

jest.mock('@/components/atmosphere/Screen', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Screen: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement(View, props, children),
  };
});

jest.mock('@/context/PlayerContext', () => ({
  usePlayer: () => ({
    session: require('@/content/sessions').SESSION_BY_ID['sleep-descent'],
    worldId: 'constellation',
    status: mockPlayerStatus,
    positionSec: 12,
    durationSec: 600,
    toggle: mockToggle,
  }),
}));

jest.mock('@/services/subscriptionService', () => ({
  listOffers: async () => [
    { id: 'annual', priceLabel: '39,99 €', period: 'annual', raw: null },
  ],
  purchase: async () => 'plus',
  restore: async () => 'free',
}));

jest.mock('uniwind', () => ({
  ScopedTheme: ({ children }: React.PropsWithChildren<{ theme: string }>) => children,
  Uniwind: { setTheme: jest.fn() },
  useUniwind: () => ({ theme: 'dark' }),
  withUniwind: (Component: React.ComponentType<object>) => Component,
}));

function flatten(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style) as Record<string, unknown>;
}

function meetsMinTarget(style: unknown, min = 48): boolean {
  const flat = flatten(style);
  const height = Number(flat.height ?? flat.minHeight ?? 0);
  const width = Number(flat.width ?? flat.minWidth ?? 0);
  return height >= min && (width === 0 || width >= min);
}

describe('TI-394 TalkBack surfaces', () => {
  beforeEach(() => {
    mockOpenDrawer.mockClear();
    mockPush.mockClear();
    mockToggle.mockClear();
    mockToggleFavorite.mockClear();
    mockFavorite = false;
    mockPlayerStatus = 'paused';
    mockParams = { id: 'sleep-descent', reason: 'premium-session' };
    mockSoundEnabled = true;
    mockWorldOwned = false;
    mockSetWorld.mockClear();
    mockToggleSoundscape.mockClear();
  });

  it('gives the drawer a 48dp target and an explicit Open the menu label', () => {
    render(<DrawerButton />);

    const button = screen.getByTestId('btn.drawer.open');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe(translate('en', 'drawer.open'));
    expect(meetsMinTarget(button.props.style)).toBe(true);
    fireEvent.press(button);
    expect(mockOpenDrawer).toHaveBeenCalled();
  });

  it('announces the session title when opening the mini-player and keeps play at 48dp', () => {
    render(<MiniPlayer />);

    const open = screen.getByTestId('btn.mini.open');
    const title = translate('en', 'session.sleep-descent.title');
    expect(open.props.accessibilityLabel).toBe(`${translate('en', 'mini.playing')}. ${title}`);
    expect(screen.getByText(title)).toBeTruthy();

    const toggle = screen.getByTestId('btn.mini.toggle');
    expect(toggle.props.accessibilityLabel).toBe(translate('en', 'player.play'));
    expect(toggle.props.accessibilityState).toMatchObject({ selected: false });
    expect(meetsMinTarget(toggle.props.style)).toBe(true);
  });

  it('names the session favourite by its current action and keeps a 48dp target', () => {
    render(<SessionDetail />);

    const favorite = screen.getByTestId(TID.Button.SessionFavorite);
    expect(favorite.props.accessibilityLabel).toBe(translate('en', 'session.favorite.add'));
    expect(favorite.props.accessibilityState).toMatchObject({ selected: false });
    expect(meetsMinTarget(favorite.props.style)).toBe(true);
    fireEvent.press(favorite);
    expect(mockToggleFavorite).toHaveBeenCalledWith('sleep-descent');
  });

  it('exposes distinct TalkBack links for terms and privacy', async () => {
    const openURL = jest.fn().mockResolvedValue(true);
    const openSpy = jest.spyOn(Linking, 'openURL').mockImplementation(openURL);

    render(<PaywallScreen />);
    await waitFor(() => expect(screen.getByTestId(TID.Button.PaywallBuy)).toBeTruthy());

    const terms = screen.getByTestId('paywall.legal.terms');
    const privacy = screen.getByTestId('paywall.legal.privacy');
    expect(terms.props.accessibilityRole).toBe('link');
    expect(privacy.props.accessibilityRole).toBe('link');
    expect(terms.props.accessibilityLabel).toBe(translate('en', 'legal.terms'));
    expect(privacy.props.accessibilityLabel).toBe(translate('en', 'legal.privacy'));
    expect(screen.getByText(translate('en', 'legal.terms'))).toBeTruthy();
    expect(screen.getByText(translate('en', 'legal.privacy'))).toBeTruthy();
    expect(screen.queryByText(translate('en', 'paywall.legal'))).toBeNull();

    fireEvent.press(terms);
    fireEvent.press(privacy);
    expect(openURL).toHaveBeenNthCalledWith(1, 'https://noctalia.app/terms');
    expect(openURL).toHaveBeenNthCalledWith(2, 'https://noctalia.app/privacy');
    openSpy.mockRestore();
  });

  it('gives Search category tiles an explicit TalkBack name', () => {
    render(<SearchTab />);

    const sleep = screen.getByLabelText(translate('en', 'category.sleep.name'));
    expect(sleep.props.accessibilityRole).toBe('button');
    fireEvent.press(sleep);
    expect(mockPush).toHaveBeenCalledWith('/category/sleep');

    const dreamPrep = screen.getByTestId(TID.Option.CategoryDreamPrep);
    expect(dreamPrep.props.accessibilityLabel).toBe(translate('en', 'category.dream-prep.name'));
  });

  it('exposes the four tabs as labelled selected tabs in visual order', () => {
    const navigate = jest.fn();
    const emit = jest.fn(() => ({ defaultPrevented: false }));
    render(
      <AccessibleTabBar
        state={{
          index: 0,
          routes: [
            { key: 'home', name: 'index' },
            { key: 'breathe', name: 'breathe' },
            { key: 'search', name: 'search' },
            { key: 'profile', name: 'profile' },
          ],
        } as never}
        descriptors={{
          home: { options: { title: 'Home', tabBarAccessibilityLabel: 'Home', tabBarButtonTestID: TID.Tab.Home } },
          breathe: { options: { title: 'Breathe', tabBarAccessibilityLabel: 'Breathe', tabBarButtonTestID: TID.Tab.Breathe } },
          search: { options: { title: 'Search', tabBarAccessibilityLabel: 'Search', tabBarButtonTestID: TID.Tab.Search } },
          profile: { options: { title: 'Profile', tabBarAccessibilityLabel: 'Profile', tabBarButtonTestID: TID.Tab.Profile } },
        } as never}
        navigation={{ navigate, emit } as never}
        insets={{ top: 0, right: 0, bottom: 24, left: 0 }}
      />
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Home',
      'Breathe',
      'Search',
      'Profile',
    ]);
    expect(tabs[0].props.accessibilityState).toMatchObject({ selected: true });
    expect(tabs[1].props.accessibilityState).toMatchObject({ selected: false });
    expect(meetsMinTarget(tabs[0].props.style)).toBe(true);
  });

  it('summarises the streak calendar as one TalkBack element in weekday order', () => {
    const days = calendarDays([{ dateISO: '2026-08-19', seconds: 600 }], '2026-08-19');
    render(<StreakCalendar days={days} />);

    const weekdays = [
      translate('en', 'profile.weekday.mon'),
      translate('en', 'profile.weekday.tue'),
      translate('en', 'profile.weekday.wed'),
      translate('en', 'profile.weekday.thu'),
      translate('en', 'profile.weekday.fri'),
      translate('en', 'profile.weekday.sat'),
      translate('en', 'profile.weekday.sun'),
    ];
    const weekdayNodes = weekdays.map((label) => screen.getAllByText(label)[0]);
    expect(weekdayNodes.map((node) => node.props.children)).toEqual(weekdays);

    const summary = screen.getByRole('summary');
    expect(summary.props.accessibilityLabel).toBe(
      translate('en', 'profile.calendar.summary', { practised: 1, total: days.length })
    );
    expect(screen.queryByLabelText('2026-08-19')).toBeNull();
    days.forEach((day) => {
      expect(screen.queryByLabelText(day.day)).toBeNull();
    });
  });

  it('exposes the home world carousel as radios in visual order', () => {
    const onSelect = jest.fn();
    const worlds = WORLD_IDS.map((id) => WORLD_BY_ID[id]);
    render(
      <WorldJourneyPicker
        worlds={worlds}
        selectedWorldId="constellation"
        onSelect={onSelect}
        isWorldOwned={(worldId) => worldId !== 'tide'}
        priceForWorld={(worldId) => (worldId === 'tide' ? '0,99 €' : undefined)}
        accessibilityLabel={translate('en', 'home.journey.worldLabel')}
        testID="home.world-switcher"
      />
    );

    const group = screen.getByTestId('home.world-switcher');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(group.props.accessibilityLabel).toBe(translate('en', 'home.journey.worldLabel'));

    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.props.accessibilityLabel)).toEqual(
      WORLD_IDS.map((id) => translate('en', `world.${id}.name`))
    );
    expect(radios[0].props.accessibilityState).toMatchObject({
      checked: true,
      selected: true,
    });
    expect(radios[1].props.accessibilityState).toMatchObject({
      checked: false,
      selected: false,
    });
    expect(radios[3].props.accessibilityHint).toEqual(expect.stringContaining('0,99'));

    fireEvent.press(radios[2]);
    expect(onSelect).toHaveBeenCalledWith('forest');
    fireEvent.press(radios[0]);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('names world-purchase back, preview, buy and restore with explicit roles', () => {
    mockParams = { id: 'tide' };
    render(<WorldPurchaseScreen />);

    const back = screen.getByTestId(TID.Button.WorldPurchaseBack);
    expect(back.props.accessibilityRole).toBe('button');
    expect(back.props.accessibilityLabel).toBe(translate('en', 'common.back'));

    const preview = screen.getByTestId('btn.worldPurchase.sound');
    expect(preview.props.accessibilityRole).toBe('button');
    expect(preview.props.accessibilityLabel).toBe(
      translate('en', 'world.purchase.preview.soundOn', {
        world: translate('en', 'world.tide.name'),
      })
    );
    expect(preview.props.accessibilityState).toMatchObject({ selected: false });

    const buy = screen.getByTestId(TID.Button.WorldPurchaseBuy);
    expect(buy.props.accessibilityRole).toBe('button');
    expect(buy).toHaveTextContent(
      translate('en', 'world.purchase.buy', { price: '0,99 €' })
    );

    const restore = screen.getByTestId(TID.Button.WorldPurchaseRestore);
    expect(restore.props.accessibilityRole).toBe('button');
    expect(restore).toHaveTextContent(translate('en', 'world.purchase.restore'));
  });

  it('presents Reduce animations as a system fact, not a control', () => {
    render(<SettingsScreen />);

    const motion = screen.getByTestId('settings.motion');
    expect(motion.props.accessibilityRole).toBe('text');
    expect(motion.props.accessibilityLabel).toBe(
      `${translate('en', 'settings.motion')}. ${translate('en', 'settings.motion.system')}`
    );
    expect(motion.props.onPress).toBeUndefined();
    expect(motion.props.accessibilityState).toMatchObject({ disabled: true });

    const theme = screen.getByTestId(TID.Button.SettingsTheme);
    expect(theme.props.accessibilityRole).toBe('button');
  });

});
