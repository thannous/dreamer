/* eslint-disable @typescript-eslint/no-require-imports -- Jest hoists module factories above imports. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import SessionDetail from '@/app/session/[id]';
import PlayerScreen from '@/app/player/[id]';
import { SessionCard } from '@/components/session/SessionCard';
import { SESSION_BY_ID } from '@/content/sessions';
import { WORLD_BY_ID as mockWorldById, type MeditationWorld, type WorldId } from '@/constants/worlds';
import { TID } from '@/lib/testIDs';

const mockPush = jest.fn();
const mockOpenPaywall = jest.fn();
const mockToggleFavorite = jest.fn();
const mockPlayerOpen = jest.fn();
let mockWorldId: WorldId = 'constellation';
let mockPlayerStatus: 'idle' | 'paused' | 'unavailable' = 'paused';
let mockRouteSessionId = 'sleep-descent';
let mockRouteWorldId: WorldId | undefined;
let mockOwnedWorldIds: WorldId[] = [];
let mockSessionGate:
  | { allowed: true }
  | { allowed: false; reason: 'premium-session' | 'monthly-quota' } = {
  allowed: true,
};
let mockRemainingPlays = 3;
let mockQuotaResetDay = '2026-09-01';
let mockIsPlus = false;
let mockSubscriptionsEnabled = true;

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: mockRouteSessionId, worldId: mockRouteWorldId }),
  useRouter: () => ({ push: mockPush, canGoBack: () => true, back: jest.fn() }),
}));

jest.mock('@/context/WorldContext', () => ({
  useWorld: () => ({
    loaded: true,
    worldId: mockWorldId,
    world: mockWorldById[mockWorldId],
    setWorld: jest.fn(),
  }),
}));

let mockWorldPurchasesLoaded = true;

jest.mock('@/context/WorldPurchaseContext', () => ({
  useWorldPurchases: () => ({
    loaded: mockWorldPurchasesLoaded,
    isWorldOwned: (worldId: WorldId) =>
      mockWorldById[worldId].access === 'free' || mockOwnedWorldIds.includes(worldId),
  }),
}));

jest.mock('@/components/worlds/WorldScene', () => ({
  WorldScene: ({ world, artwork, children }: React.PropsWithChildren<{
    world: MeditationWorld;
    artwork: 'journey' | 'trainer' | 'completion';
  }>) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(
      View,
      {
        testID: 'world-scene',
        accessibilityLabel: `world:${world.id};artwork:${artwork}`,
        worldId: world.id,
        artwork,
      },
      children
    );
  },
}));

jest.mock('@/components/atmosphere/Screen', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Screen: ({ children }: React.PropsWithChildren) => React.createElement(View, null, children) };
});

jest.mock('@/components/atmosphere/ProgressiveSilence', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    ProgressiveSilence: ({ children }: React.PropsWithChildren) => React.createElement(View, null, children),
  };
});

jest.mock('@/context/SilenceContext', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { SilenceProvider: ({ children }: React.PropsWithChildren) => React.createElement(View, null, children) };
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

jest.mock('@/components/session/SessionArtwork', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SessionArtwork: ({ children }: React.PropsWithChildren) =>
      React.createElement(View, { testID: 'generic-session-artwork' }, children),
  };
});

jest.mock('@/components/ui', () => {
  const React = require('react');
  const { Pressable, Text: RNText, View } = require('react-native');
  const UI = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <View {...props}>{children}</View>
  );
  const Text = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <RNText {...props}>{children}</RNText>
  );
  const Button = ({
    label,
    loading,
    disabled,
    ...props
  }: {
    label: string;
    testID?: string;
    loading?: boolean;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={!!(disabled || loading)}
      {...props}>
      <RNText>{label}</RNText>
    </Pressable>
  );
  const BackLink = ({ label, ...props }: { label: string; testID?: string }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} {...props}>
      <RNText>{label}</RNText>
    </Pressable>
  );
  const Chip = ({ label, selected, onPress, ...props }: {
    label: string;
    selected?: boolean;
    onPress?: () => void;
  }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      {...props}>
      <RNText>{label}</RNText>
    </Pressable>
  );
  const IconSymbol = ({ name }: { name: string }) => <RNText>{name}</RNText>;
  return { BackLink, Button, Card: UI, Chip, IconSymbol, Rule: UI, Text };
});

jest.mock('@/hooks/usePressMotion', () => ({
  usePressMotion: () => ({
    style: undefined,
    handlePressIn: jest.fn(),
    handlePressOut: jest.fn(),
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      accentText: '#f2c078',
      textOnAccent: '#17120d',
    },
  }),
}));

jest.mock('@/context/LanguageContext', () => ({
  useTranslation: () => ({
    language: 'en',
    t: (key: string, values?: Record<string, string | number>) => {
      const copy: Record<string, string> = {
        'common.back': 'Back',
        'common.minutes': `${values?.count ?? 0} min`,
        'common.plus': 'Plus',
        'common.free': 'Free',
        'session.sleep-descent.title': 'Bringing the breath down',
        'session.sleep-descent.benefit.1': 'Slows the heart rate',
        'session.sleep-descent.benefit.2': 'Prepares for sleep',
        'session.sleep-descent.benefit.3': 'Done lying down',
        'session.sleep-body-scan.title': 'The body settling',
        'session.sleep-body-scan.benefit.1': 'Releases tension',
        'session.sleep-body-scan.benefit.2': 'Anchors attention',
        'session.sleep-body-scan.benefit.3': 'A long practice',
        'session.stress-shoulders.title': 'Drop the shoulders',
        'session.stress-storm.title': 'After the storm',
        'category.sleep.name': 'Sleep',
        'category.stress.name': 'Stress',
        'session.play': 'Play',
        'session.resume': 'Resume',
        'session.replay': 'Replay',
        'session.benefits': 'Benefits',
        'session.favorite.add': 'Add to favourites',
        'session.favorite.remove': 'Remove from favourites',
        'session.premium.title': 'Noctalia Plus',
        'session.premium.cta': 'See Noctalia Plus',
        'session.completed': `${values?.count ?? 0} sessions`,
        'paywall.remaining': `${values?.count ?? 0} free sessions left this month`,
        'paywall.remaining.one': '1 free session left this month',
        'paywall.remaining.none': 'No free sessions left this month',
        'paywall.reset': `Resets on ${values?.date ?? ''}`,
        'paywall.options': 'See Plus options',
        'home.breathe.title': 'Or just breathe',
        'player.close': 'Close',
        'player.play': 'Play',
        'player.pause': 'Pause',
        'player.back15': 'Back 15 seconds',
        'player.forward15': 'Forward 15 seconds',
        'player.scrub': 'Playback position',
        'player.reveal': 'Show controls',
        'player.timer.none': 'No timer',
        'player.ambience.none': 'None',
        'player.unavailable.title': 'Audio unavailable',
        'player.unavailable.subtitle': 'Try again later.',
        'search.empty.title': 'Nothing here',
      };
      return copy[key] ?? key;
    },
  }),
}));

let mockLibraryLoaded = true;
let mockLibraryProgress: Record<string, { positionSec: number }> = {};

jest.mock('@/context/LibraryContext', () => ({
  useLibrary: () => ({
    favorites: [],
    isFavorite: () => false,
    toggleFavorite: mockToggleFavorite,
    progress: mockLibraryProgress,
    loaded: mockLibraryLoaded,
  }),
}));

jest.mock('@/context/SubscriptionContext', () => ({
  useSubscription: () => ({
    gateForSession: () => mockSessionGate,
    gateForTimer: () => ({ allowed: true }),
    openPaywall: mockOpenPaywall,
    remainingPlays: mockRemainingPlays,
    quotaResetDay: mockQuotaResetDay,
    isPlus: mockIsPlus,
    subscriptionsEnabled: mockSubscriptionsEnabled,
  }),
}));

jest.mock('@/context/PlayerContext', () => ({
  usePlayer: () => ({
    session: null,
    worldId: null,
    status: mockPlayerStatus,
    positionSec: 0,
    durationSec: 600,
    rate: 1,
    ambienceId: 'none',
    fadeMinutes: null,
    fadeRemainingSec: null,
    open: mockPlayerOpen,
    toggle: jest.fn(),
    seekTo: jest.fn(),
    skip: jest.fn(),
    setRate: jest.fn(),
    setAmbience: jest.fn(),
    setFadeTimer: jest.fn(),
    close: jest.fn(),
  }),
}));

describe('world continuity from journey into practice', () => {
  beforeEach(() => {
    mockWorldId = 'constellation';
    mockPlayerStatus = 'paused';
    mockRouteSessionId = 'sleep-descent';
    mockRouteWorldId = undefined;
    mockOwnedWorldIds = [];
    mockSessionGate = { allowed: true };
    mockRemainingPlays = 3;
    mockQuotaResetDay = '2026-09-01';
    mockIsPlus = false;
    mockSubscriptionsEnabled = true;
    mockLibraryLoaded = true;
    mockLibraryProgress = {};
    mockWorldPurchasesLoaded = true;
    mockPush.mockClear();
    mockOpenPaywall.mockClear();
    mockToggleFavorite.mockClear();
    mockPlayerOpen.mockClear();
  });

  it.each<WorldId>(['constellation', 'forest', 'dawn'])(
    'keeps the selected %s world and trainer artwork on session detail',
    (worldId) => {
      mockWorldId = worldId;
      render(<SessionDetail />);

      const scene = screen.getByTestId('world-scene');
      expect(scene.props.worldId).toBe(worldId);
      expect(scene.props.artwork).toBe('trainer');
      expect(scene.props.accessibilityLabel).toBe(`world:${worldId};artwork:trainer`);
      expect(screen.getByTestId(TID.Screen.SessionDetail)).toBeTruthy();
      expect(screen.getByTestId(TID.Button.SessionPlay)).toBeTruthy();
      expect(screen.queryByTestId('generic-session-artwork')).toBeNull();
    }
  );

  it('opens the player from the same world without changing the world scene', () => {
    mockWorldId = 'constellation';
    render(<SessionDetail />);

    fireEvent.press(screen.getByTestId(TID.Button.SessionPlay));
    expect(mockPush).toHaveBeenCalledWith('/player/sleep-descent?worldId=constellation');

    render(<PlayerScreen />);
    const scene = screen.getByTestId('world-scene');
    expect(scene.props.worldId).toBe('constellation');
    expect(scene.props.artwork).toBe('trainer');
    expect(screen.getByTestId(TID.Screen.Player)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.PlayerClose)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.PlayerToggle)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.PlayerBack)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.PlayerForward)).toBeTruthy();
    expect(screen.queryByTestId('generic-session-artwork')).toBeNull();
    expect(mockPlayerOpen).toHaveBeenCalledWith('sleep-descent', 0, 'constellation');
  });

  it('does not reopen audio after a natural finish while the player route is still mounted', () => {
    mockWorldId = 'constellation';
    mockPlayerStatus = 'paused';
    const { rerender } = render(<PlayerScreen />);
    expect(mockPlayerOpen).toHaveBeenCalledTimes(1);

    mockPlayerStatus = 'idle';
    rerender(<PlayerScreen />);
    expect(mockPlayerOpen).toHaveBeenCalledTimes(1);
  });

  it('waits for library hydration before opening a saved resume position once', () => {
    mockWorldId = 'constellation';
    mockLibraryLoaded = false;
    mockLibraryProgress = {};
    const { rerender } = render(<PlayerScreen />);
    expect(mockPlayerOpen).not.toHaveBeenCalled();
    expect(mockOpenPaywall).not.toHaveBeenCalled();

    mockLibraryLoaded = true;
    mockLibraryProgress = { 'sleep-descent': { positionSec: 187 } };
    rerender(<PlayerScreen />);
    expect(mockPlayerOpen).toHaveBeenCalledTimes(1);
    expect(mockPlayerOpen).toHaveBeenCalledWith('sleep-descent', 187, 'constellation');

    mockLibraryProgress = { 'sleep-descent': { positionSec: 240 } };
    rerender(<PlayerScreen />);
    expect(mockPlayerOpen).toHaveBeenCalledTimes(1);
  });

  it('preserves controls and the unavailable escape hatch when audio cannot load', () => {
    mockWorldId = 'dawn';
    mockPlayerStatus = 'unavailable';
    render(<PlayerScreen />);

    const scene = screen.getByTestId('world-scene');
    expect(scene.props.worldId).toBe('dawn');
    expect(scene.props.artwork).toBe('trainer');
    expect(screen.getByTestId(TID.Screen.PlayerUnavailable)).toBeTruthy();
    expect(screen.getByTestId('empty-illustration')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(screen.queryByTestId(TID.Button.PlayerToggle)).toBeNull();
  });

  it('rejects an unowned paid world supplied by a deep link', () => {
    mockRouteWorldId = 'tide';

    render(<SessionDetail />);

    expect(screen.getByTestId('world-scene').props.worldId).toBe('constellation');
  });

  it('honours an owned paid world supplied by a deep link', () => {
    mockRouteWorldId = 'tide';
    mockOwnedWorldIds = ['tide'];

    render(<SessionDetail />);

    expect(screen.getByTestId('world-scene').props.worldId).toBe('tide');
  });

  it('blocks a direct premium player route before opening audio', () => {
    mockRouteSessionId = 'dream-threshold';
    mockSessionGate = { allowed: false, reason: 'premium-session' };

    render(<PlayerScreen />);

    expect(mockOpenPaywall).toHaveBeenCalledWith('premium-session');
    expect(mockPlayerOpen).not.toHaveBeenCalled();
  });

  it('includes curated premium practices in an owned one-time world purchase', () => {
    mockRouteSessionId = 'stress-storm';
    mockRouteWorldId = 'tide';
    mockOwnedWorldIds = ['tide'];
    mockSessionGate = { allowed: false, reason: 'premium-session' };

    render(<PlayerScreen />);

    expect(mockOpenPaywall).not.toHaveBeenCalled();
    expect(mockPlayerOpen).toHaveBeenCalledWith('stress-storm', 0, 'tide');
  });

  it('waits for world purchase hydration before opening an owned world player once', () => {
    mockRouteSessionId = 'stress-storm';
    mockRouteWorldId = 'tide';
    mockOwnedWorldIds = [];
    mockWorldPurchasesLoaded = false;
    mockSessionGate = { allowed: false, reason: 'premium-session' };

    const { rerender } = render(<PlayerScreen />);
    expect(mockPlayerOpen).not.toHaveBeenCalled();
    expect(mockOpenPaywall).not.toHaveBeenCalled();

    mockOwnedWorldIds = ['tide'];
    mockWorldPurchasesLoaded = true;
    rerender(<PlayerScreen />);
    expect(mockOpenPaywall).not.toHaveBeenCalled();
    expect(mockPlayerOpen).toHaveBeenCalledTimes(1);
    expect(mockPlayerOpen).toHaveBeenCalledWith('stress-storm', 0, 'tide');

    rerender(<PlayerScreen />);
    expect(mockPlayerOpen).toHaveBeenCalledTimes(1);
  });

  it('waits for world purchase hydration before routing an owned world from session detail', () => {
    mockRouteSessionId = 'stress-storm';
    mockRouteWorldId = 'tide';
    mockOwnedWorldIds = [];
    mockWorldPurchasesLoaded = false;
    mockSessionGate = { allowed: false, reason: 'monthly-quota' };

    const { rerender } = render(<SessionDetail />);
    const cta = screen.getByTestId(TID.Button.SessionPlay);
    expect(cta.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true, busy: true })
    );
    expect(screen.queryByTestId('session.quota-alternative')).toBeNull();
    fireEvent.press(cta);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockOpenPaywall).not.toHaveBeenCalled();

    mockOwnedWorldIds = ['tide'];
    mockWorldPurchasesLoaded = true;
    rerender(<SessionDetail />);
    const readyCta = screen.getByTestId(TID.Button.SessionPlay);
    expect(readyCta.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false, busy: false })
    );
    fireEvent.press(readyCta);
    expect(mockOpenPaywall).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/player/stress-storm?worldId=tide');
  });

  it('treats a non-premium included owned-world session as playable without quota copy', () => {
    mockRouteSessionId = 'stress-shoulders';
    mockRouteWorldId = 'tide';
    mockOwnedWorldIds = ['tide'];
    mockRemainingPlays = 0;
    mockSessionGate = { allowed: false, reason: 'monthly-quota' };

    render(<SessionDetail />);

    expect(screen.getByTestId('session.access')).toHaveTextContent('Free');
    expect(screen.getByTestId('session.access')).not.toHaveTextContent('Plus');
    expect(screen.queryByText('Plus')).toBeNull();
    expect(screen.queryByTestId('session.quota')).toBeNull();
    expect(screen.queryByTestId('session.quota-reset')).toBeNull();
    expect(screen.queryByTestId('session.quota-alternative')).toBeNull();
    expect(screen.getByTestId(TID.Button.SessionPlay)).toHaveTextContent('Play');
    fireEvent.press(screen.getByTestId(TID.Button.SessionPlay));
    expect(mockOpenPaywall).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/player/stress-shoulders?worldId=tide');
  });

  it.each<{ reason: 'premium-session' | 'monthly-quota' }>([
    { reason: 'premium-session' },
    { reason: 'monthly-quota' },
  ])(
    'treats a premium included owned-world session as Free when gated as $reason',
    ({ reason }) => {
      mockRouteSessionId = 'stress-storm';
      mockRouteWorldId = 'tide';
      mockOwnedWorldIds = ['tide'];
      mockRemainingPlays = 0;
      mockSessionGate = { allowed: false, reason };

      render(<SessionDetail />);

      expect(screen.getByTestId('session.access')).toHaveTextContent('Free');
      expect(screen.getByTestId('session.access')).not.toHaveTextContent('Plus');
      expect(screen.queryByText('Plus')).toBeNull();
      expect(screen.queryByTestId('session.quota')).toBeNull();
      expect(screen.queryByTestId('session.quota-reset')).toBeNull();
      expect(screen.queryByTestId('session.quota-alternative')).toBeNull();
      expect(screen.getByTestId(TID.Button.SessionPlay)).toHaveTextContent('Play');
      fireEvent.press(screen.getByTestId(TID.Button.SessionPlay));
      expect(mockOpenPaywall).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/player/stress-storm?worldId=tide');
    }
  );

  it('shows remaining quota on a free session before play', () => {
    mockRemainingPlays = 2;
    render(<SessionDetail />);

    expect(screen.getByTestId('session.access')).toHaveTextContent('Free');
    expect(screen.getByTestId('session.access')).not.toHaveTextContent('Plus');
    expect(screen.queryByText('Plus')).toBeNull();
    expect(screen.getByTestId('session.quota')).toHaveTextContent(
      /2 free sessions left this month/
    );
    expect(screen.getByTestId('session.quota-reset')).toHaveTextContent('Resets on 1 September 2026');
    expect(screen.getByTestId(TID.Button.SessionPlay)).toHaveTextContent('Play');
    expect(screen.getByTestId('session.quota')).not.toHaveTextContent('2026-09-01');
  });

  it('sends a Plus session to the paywall with an honest CTA', () => {
    mockRouteSessionId = 'dream-threshold';
    mockSessionGate = { allowed: false, reason: 'premium-session' };
    render(<SessionDetail />);

    expect(screen.getByTestId('session.access')).toHaveTextContent('Plus');
    expect(screen.getByTestId('session.access')).not.toHaveTextContent('Free');
    expect(screen.queryByText('Free')).toBeNull();
    expect(screen.queryByTestId('session.quota')).toBeNull();
    expect(screen.getByTestId(TID.Button.SessionPlay)).toHaveTextContent('See Plus options');
    fireEvent.press(screen.getByTestId(TID.Button.SessionPlay));
    expect(mockOpenPaywall).toHaveBeenCalledWith('premium-session');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('removes every Plus cue from a premium session while subscriptions are disabled', () => {
    mockRouteSessionId = 'dream-threshold';
    mockSubscriptionsEnabled = false;
    mockIsPlus = true;
    mockSessionGate = { allowed: true };

    render(<SessionDetail />);

    expect(screen.getByTestId('session.access')).toHaveTextContent('Free');
    expect(screen.getByTestId('session.access')).not.toHaveTextContent('Plus');
    expect(screen.queryByText('Noctalia Plus')).toBeNull();
    expect(screen.getByTestId(TID.Button.SessionPlay)).toHaveTextContent('Play');
  });

  it('does not keep a start action when the monthly quota is spent', () => {
    mockRemainingPlays = 0;
    mockSessionGate = { allowed: false, reason: 'monthly-quota' };
    render(<SessionDetail />);

    expect(screen.getByTestId('session.access')).toHaveTextContent('Free');
    expect(screen.getByTestId('session.access')).not.toHaveTextContent('Plus');
    expect(screen.getByTestId('session.quota')).toHaveTextContent(
      /No free sessions left this month/
    );
    expect(screen.getByTestId('session.quota-reset')).toHaveTextContent('Resets on 1 September 2026');
    expect(screen.getByTestId(TID.Button.SessionPlay)).toHaveTextContent('See Plus options');
    expect(screen.getByTestId(TID.Button.SessionPlay)).not.toHaveTextContent(
      'No free sessions left this month'
    );
    fireEvent.press(screen.getByTestId(TID.Button.SessionPlay));
    expect(mockOpenPaywall).toHaveBeenCalledWith('monthly-quota');
    fireEvent.press(screen.getByTestId('session.quota-alternative'));
    expect(mockPush).toHaveBeenCalledWith('/breathe');
  });

  it('keeps Free and Plus mutually exclusive on session detail', () => {
    mockRemainingPlays = 1;
    const { unmount } = render(<SessionDetail />);

    expect(screen.getByTestId('session.access')).toHaveTextContent('Free');
    expect(screen.queryByText('Plus')).toBeNull();
    expect(screen.getByTestId('session.quota')).toHaveTextContent(
      /1 free session left this month/
    );
    unmount();

    mockRouteSessionId = 'dream-threshold';
    mockSessionGate = { allowed: false, reason: 'premium-session' };
    render(<SessionDetail />);

    expect(screen.getByTestId('session.access')).toHaveTextContent('Plus');
    expect(screen.queryByText('Free')).toBeNull();
    expect(screen.queryByTestId('session.quota')).toBeNull();
  });

  it('lets compact session cards expose all three benefits without clipping', () => {
    render(<SessionCard session={SESSION_BY_ID['sleep-descent']} testID="continuity.session.free" />);

    expect(screen.getByTestId('continuity.session.free.access')).toHaveTextContent('Free');
    expect(screen.getByTestId('continuity.session.free.access')).not.toHaveTextContent('Plus');
    expect(screen.getByTestId('continuity.session.free.benefit.1')).toHaveTextContent('Slows the heart rate');
    expect(screen.getByTestId('continuity.session.free.benefit.2')).toHaveTextContent('Prepares for sleep');
    expect(screen.getByTestId('continuity.session.free.benefit.3')).toHaveTextContent('Done lying down');
    expect(screen.getByTestId('continuity.session.free.benefit.1').props.numberOfLines).toBeUndefined();
    expect(screen.getByTestId('continuity.session.free.benefit.2').props.numberOfLines).toBeUndefined();
    expect(screen.getByTestId('continuity.session.free.benefit.3').props.numberOfLines).toBeUndefined();
    expect(screen.getByTestId('continuity.session.free.title').props.numberOfLines).toBeUndefined();
    expect(screen.getByRole('button').props.accessibilityLabel).toEqual(
      expect.stringContaining('Slows the heart rate. Prepares for sleep. Done lying down. Free')
    );
  });

  it('keeps Plus exclusive of Free on a premium session card', () => {
    render(<SessionCard session={SESSION_BY_ID['sleep-body-scan']} testID="continuity.session.plus" />);

    expect(screen.getByTestId('continuity.session.plus.access')).toHaveTextContent('Plus');
    expect(screen.getByTestId('continuity.session.plus.access')).not.toHaveTextContent('Free');
    expect(screen.getByTestId('continuity.session.plus.benefit.1')).toHaveTextContent('Releases tension');
    expect(screen.getByTestId('continuity.session.plus.benefit.2')).toHaveTextContent('Anchors attention');
    expect(screen.getByTestId('continuity.session.plus.benefit.3')).toHaveTextContent('A long practice');
    expect(screen.getByRole('button').props.accessibilityLabel).toEqual(
      expect.stringContaining('Releases tension. Anchors attention. A long practice. Plus')
    );
  });

});
