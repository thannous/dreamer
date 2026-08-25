/* eslint-disable @typescript-eslint/no-require-imports -- Jest hoists module factories above imports. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import SessionDetail from '@/app/session/[id]';
import PlayerScreen from '@/app/player/[id]';
import { WORLD_BY_ID as mockWorldById, type MeditationWorld, type WorldId } from '@/constants/worlds';
import { TID } from '@/lib/testIDs';

const mockPush = jest.fn();
const mockOpenPaywall = jest.fn();
const mockToggleFavorite = jest.fn();
const mockPlayerOpen = jest.fn();
let mockWorldId: WorldId = 'constellation';
let mockPlayerStatus: 'paused' | 'unavailable' = 'paused';
let mockRouteSessionId = 'sleep-descent';
let mockRouteWorldId: WorldId | undefined;
let mockOwnedWorldIds: WorldId[] = [];
let mockSessionGate: { allowed: true } | { allowed: false; reason: 'premium-session' } = {
  allowed: true,
};

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

jest.mock('@/context/WorldPurchaseContext', () => ({
  useWorldPurchases: () => ({
    loaded: true,
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
  const Button = ({ label, ...props }: { label: string; testID?: string; onPress?: () => void }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} {...props}>
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
    t: (key: string, values?: Record<string, string | number>) => {
      const copy: Record<string, string> = {
        'common.back': 'Back',
        'common.minutes': `${values?.count ?? 0} min`,
        'common.plus': 'Plus',
        'session.play': 'Play',
        'session.resume': 'Resume',
        'session.replay': 'Replay',
        'session.benefits': 'Benefits',
        'session.favorite.add': 'Add to favourites',
        'session.favorite.remove': 'Remove from favourites',
        'session.premium.title': 'Noctalia Plus',
        'session.completed': `${values?.count ?? 0} sessions`,
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

jest.mock('@/context/LibraryContext', () => ({
  useLibrary: () => ({
    isFavorite: () => false,
    toggleFavorite: mockToggleFavorite,
    progress: {},
  }),
}));

jest.mock('@/context/SubscriptionContext', () => ({
  useSubscription: () => ({
    gateForSession: () => mockSessionGate,
    gateForTimer: () => ({ allowed: true }),
    openPaywall: mockOpenPaywall,
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
});
