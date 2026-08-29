/* eslint-disable @typescript-eslint/no-require-imports -- Jest hoists module factories above imports. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { MiniPlayer } from '@/components/player/MiniPlayer';
import { SESSION_BY_ID } from '@/content/sessions';
import { translate } from '@/lib/i18n';

const mockPush = jest.fn();
const mockToggle = jest.fn();
const mockClose = jest.fn();
let mockPlayerStatus: 'idle' | 'paused' | 'playing' | 'unavailable' | 'loading' = 'paused';
let mockSession: typeof SESSION_BY_ID['sleep-descent'] | null = SESSION_BY_ID['sleep-descent'];
let mockWorldId: string | null = 'constellation';
let mockSegments: string[] = ['(drawer)', '(tabs)'];
let mockFontScale = 1;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useSegments: () => mockSegments,
}));

jest.mock('@/context/LanguageContext', () => ({
  useTranslation: () => ({
    language: 'en',
    setLanguage: async () => {},
    t: (key: string, values?: Record<string, string | number>) => {
      const { translate: translateCopy } = require('@/lib/i18n');
      return translateCopy('en', key, values);
    },
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: { accentText: '#ffffff' } }),
}));

jest.mock('@/hooks/usePressMotion', () => ({
  usePressMotion: () => ({
    style: undefined,
    handlePressIn: jest.fn(),
    handlePressOut: jest.fn(),
  }),
}));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  default: () => ({
    width: 360,
    height: 800,
    scale: 3,
    fontScale: mockFontScale,
  }),
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

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => null,
}));

jest.mock('@/context/PlayerContext', () => ({
  usePlayer: () => ({
    session: mockSession,
    worldId: mockWorldId,
    status: mockPlayerStatus,
    toggle: mockToggle,
    close: mockClose,
  }),
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

describe('MiniPlayer', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockToggle.mockClear();
    mockClose.mockClear();
    mockPlayerStatus = 'paused';
    mockSession = SESSION_BY_ID['sleep-descent'];
    mockWorldId = 'constellation';
    mockSegments = ['(drawer)', '(tabs)'];
    mockFontScale = 1;
  });

  it('opens the full-screen player, toggles playback, and closes the session', () => {
    render(<MiniPlayer />);

    const title = translate('en', 'session.sleep-descent.title');
    const open = screen.getByTestId('btn.mini.open');
    const toggle = screen.getByTestId('btn.mini.toggle');
    const close = screen.getByTestId('btn.mini.close');

    expect(open.props.accessibilityLabel).toBe(`${translate('en', 'mini.playing')}. ${title}`);
    expect(toggle.props.accessibilityLabel).toBe(translate('en', 'player.play'));
    expect(close.props.accessibilityLabel).toBe(translate('en', 'player.close'));
    expect(toggle.props.accessibilityState).toMatchObject({ selected: false });
    expect(meetsMinTarget(toggle.props.style)).toBe(true);
    expect(meetsMinTarget(close.props.style)).toBe(true);

    fireEvent.press(open);
    fireEvent.press(toggle);
    fireEvent.press(close);

    expect(mockPush).toHaveBeenCalledWith('/player/sleep-descent?worldId=constellation');
    expect(mockToggle).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('keeps a 48dp close control when large text stacks the strip', () => {
    mockFontScale = 1.6;
    mockPlayerStatus = 'playing';
    render(<MiniPlayer />);

    const open = screen.getByTestId('btn.mini.open');
    const toggle = screen.getByTestId('btn.mini.toggle');
    const close = screen.getByTestId('btn.mini.close');
    const artworkClass = String(screen.getByTestId('mini.artwork').props.className ?? '');
    const openClass = String(open.props.className ?? '');

    expect(openClass).toContain('items-start');
    expect(openClass).not.toContain('items-center');
    expect(artworkClass).toContain('mt-1');
    expect(toggle.props.accessibilityLabel).toBe(translate('en', 'player.pause'));
    expect(toggle.props.accessibilityState).toMatchObject({ selected: true });
    expect(close.props.accessibilityLabel).toBe(translate('en', 'player.close'));
    expect(meetsMinTarget(toggle.props.style)).toBe(true);
    expect(meetsMinTarget(close.props.style)).toBe(true);

    fireEvent.press(toggle);
    fireEvent.press(close);
    expect(mockToggle).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('hides itself on the full-screen player and when the session is idle', () => {
    mockSegments = ['player'];
    const onPlayer = render(<MiniPlayer />);
    expect(onPlayer.toJSON()).toBeNull();
    onPlayer.unmount();

    mockSegments = ['(drawer)', '(tabs)'];
    mockPlayerStatus = 'idle';
    const idle = render(<MiniPlayer />);
    expect(idle.toJSON()).toBeNull();
  });
});
