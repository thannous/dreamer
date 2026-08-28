/* eslint-disable @typescript-eslint/no-require-imports -- Jest hoists module factories above imports. */
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import SessionDetail from '@/app/session/[id]';
import { PracticeProgress } from '@/components/journey/PracticeProgress';
import { MiniPlayer } from '@/components/player/MiniPlayer';
import { WORLD_BY_ID } from '@/constants/worlds';
import { translate } from '@/lib/i18n';
import { TID } from '@/lib/testIDs';

const mockPush = jest.fn();
const mockToggle = jest.fn();
let mockPlayerStatus: 'idle' | 'paused' | 'playing' = 'paused';
let mockDimensions = {
  width: 360,
  height: 800,
  scale: 3,
  fontScale: 1,
};

jest.mock('@/context/LanguageContext', () => ({
  useTranslation: () => ({
    language: 'fr',
    setLanguage: async () => {},
    t: (key: string, values?: Record<string, string | number>) => {
      const { translate } = require('@/lib/i18n');
      return translate('fr', key, values);
    },
  }),
}));

jest.mock('expo-router', () => ({
  useSegments: () => ['(drawer)', '(tabs)'],
  useLocalSearchParams: () => ({ id: 'sleep-quick-fall', worldId: 'sanctuary' }),
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    canGoBack: () => true,
    replace: jest.fn(),
  }),
  useIsFocused: () => true,
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

jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  default: () => mockDimensions,
  __esModule: true,
}));

jest.mock('@/components/session/SessionArtwork', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SessionArtwork: (props: Record<string, unknown>) =>
      React.createElement(View, { ...props, testID: 'mini.artwork' }),
  };
});

jest.mock('@/components/session/BenefitList', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { BenefitList: () => React.createElement(View, { testID: 'benefit-list' }) };
});

jest.mock('@/components/worlds/WorldScene', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    WorldScene: ({ children }: React.PropsWithChildren) =>
      React.createElement(View, { testID: 'world-scene' }, children),
  };
});

jest.mock('@/context/LibraryContext', () => ({
  useLibrary: () => ({
    isFavorite: () => false,
    toggleFavorite: jest.fn(),
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
    isWorldOwned: () => true,
  }),
}));

jest.mock('@/context/WorldContext', () => ({
  useWorld: () => ({
    loaded: true,
    worldId: 'sanctuary',
    world: require('@/constants/worlds').WORLD_BY_ID.sanctuary,
    setWorld: jest.fn(),
  }),
}));

jest.mock('@/context/PlayerContext', () => ({
  usePlayer: () => ({
    session: require('@/content/sessions').SESSION_BY_ID['sleep-quick-fall'],
    worldId: 'sanctuary',
    status: mockPlayerStatus,
    positionSec: 12,
    durationSec: 300,
    toggle: mockToggle,
  }),
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

function expectUntruncated(node: { props: Record<string, unknown> }) {
  expect(node.props.numberOfLines).toBeUndefined();
  expect(node.props.adjustsFontSizeToFit).toBeUndefined();
  expect(node.props.minimumFontScale).toBeUndefined();
  expect(node.props.allowFontScaling).not.toBe(false);
}

function setFontScale(fontScale: number) {
  mockDimensions = { ...mockDimensions, fontScale };
}

describe('TI-391 essential text reflow', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockToggle.mockClear();
    mockPlayerStatus = 'paused';
    setFontScale(1);
  });

  it.each([1, 1.3, 1.6, 2])(
    'lets the session ritual wrap at font scale %s',
    (fontScale) => {
      setFontScale(fontScale);
      render(<SessionDetail />);

      const ritualCopy = translate('fr', 'world.sanctuary.ritual');
      const ritual = screen.getByTestId('session.ritual');
      expect(ritual.props.children).toBe(ritualCopy);
      expectUntruncated(ritual);
      expect(screen.getByTestId(TID.Screen.SessionDetail)).toBeTruthy();
    }
  );

  it.each([1, 1.3, 1.6, 2])(
    'keeps world and progress labels complete at font scale %s',
    (fontScale) => {
      setFontScale(fontScale);
      render(<PracticeProgress world={WORLD_BY_ID.sanctuary} stage="prepare" />);

      const worldName = translate('fr', 'world.sanctuary.name');
      const progressLabel = translate('fr', 'practice.progress', {
        current: 1,
        total: 3,
        stage: translate('fr', 'practice.stage.prepare'),
      });
      const world = screen.getByTestId('practice.progress.world');
      const stage = screen.getByTestId('practice.progress.stage');
      const progress = screen.getByTestId('practice.progress');

      expect(world.props.children).toBe(worldName);
      expect(stage.props.children).toBe(progressLabel);
      expectUntruncated(world);
      expectUntruncated(stage);
      expect(progress.props.accessibilityLabel).toBe(`${worldName}. ${progressLabel}`);
    }
  );

  it.each([1, 1.3, 1.6, 2])(
    'wraps the mini-player title without shrinking the 48dp play control at font scale %s',
    (fontScale) => {
      setFontScale(fontScale);
      render(<MiniPlayer />);

      const title = translate('fr', 'session.sleep-quick-fall.title');
      const titleNode = screen.getByTestId('mini.session-title');
      const open = screen.getByTestId('btn.mini.open');
      const toggle = screen.getByTestId('btn.mini.toggle');

      expect(titleNode.props.children).toBe(title);
      expectUntruncated(titleNode);
      expect(open.props.accessibilityLabel).toBe(`${translate('fr', 'mini.playing')}. ${title}`);
      expect(toggle.props.accessibilityLabel).toBe(translate('fr', 'player.play'));
      expect(meetsMinTarget(toggle.props.style)).toBe(true);

      const stacked = fontScale >= 1.6;
      const openClass = String(open.props.className ?? '');
      const artworkClass = String(screen.getByTestId('mini.artwork').props.className ?? '');
      expect(openClass).toContain(stacked ? 'items-start' : 'items-center');
      expect(openClass).not.toContain(stacked ? 'items-center' : 'items-start');
      if (stacked) {
        expect(artworkClass).toContain('mt-1');
      } else {
        expect(artworkClass).not.toContain('mt-1');
      }
    }
  );
});
