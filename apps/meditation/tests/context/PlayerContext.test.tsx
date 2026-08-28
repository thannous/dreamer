/* eslint-disable @typescript-eslint/no-require-imports -- Jest hoists module factories above imports. */
import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AppState } from 'react-native';

import { MiniPlayer } from '@/components/player/MiniPlayer';
import { PlayerControls } from '@/components/player/PlayerControls';
import { PlayerProvider, usePlayer } from '@/context/PlayerContext';
import { fadeVolume } from '@/lib/audio';
import { TID } from '@/lib/testIDs';
import * as audio from '@/services/audioService';

const mockRecordProgress = jest.fn().mockResolvedValue(undefined);
const mockRecordPractice = jest.fn().mockResolvedValue(undefined);
const mockReplace = jest.fn();
let playbackListener: ((status: Record<string, unknown>) => void) | null = null;

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useSegments: () => ['(drawer)', '(tabs)'],
}));

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en' }],
}));

jest.mock('@/components/session/SessionArtwork', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SessionArtwork: () => React.createElement(View, { testID: 'session-artwork' }),
  };
});

jest.mock('@/context/LibraryContext', () => ({
  useLibrary: () => ({
    recordProgress: mockRecordProgress,
    recordPractice: mockRecordPractice,
  }),
}));

jest.mock('@/services/audioService', () => ({
  configureAudioSession: jest.fn().mockResolvedValue(undefined),
  resolvePlayableSource: jest.fn(async (source) => source),
  createSessionPlayer: jest.fn(() => ({
    currentTime: 0,
    duration: 600,
    playing: false,
    volume: 1,
    loop: false,
    addListener: jest.fn((_eventName: string, listener: typeof playbackListener) => {
      playbackListener = listener;
      return { remove: jest.fn() };
    }),
    remove: jest.fn(),
  })),
  createPlayer: jest.fn(() => ({
    currentTime: 0,
    duration: 300,
    playing: false,
    volume: 1,
    loop: false,
    addListener: jest.fn(),
    remove: jest.fn(),
  })),
  play: jest.fn((player: { playing: boolean }) => {
    player.playing = true;
  }),
  pause: jest.fn((player: { playing: boolean }) => {
    player.playing = false;
  }),
  seekTo: jest.fn().mockResolvedValue(undefined),
  setRate: jest.fn(),
  setVolume: jest.fn(),
  setLoop: jest.fn(),
  release: jest.fn(),
}));

describe('PlayerContext world continuity', () => {
  let appStateHandler: ((next: string) => void) | null = null;

  beforeEach(() => {
    playbackListener = null;
    appStateHandler = null;
    mockRecordProgress.mockClear();
    mockRecordPractice.mockClear();
    mockReplace.mockClear();
    jest.clearAllMocks();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
      if (event === 'change') appStateHandler = listener as (next: string) => void;
      return { remove: jest.fn() };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists completion against the opened session and carries its world to the finish route', async () => {
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <PlayerProvider>{children}</PlayerProvider>
    );
    const { result } = renderHook(() => usePlayer(), { wrapper });

    act(() => {
      result.current.open('sleep-descent', 0, 'constellation');
    });

    await waitFor(() => expect(audio.createSessionPlayer).toHaveBeenCalled());
    await waitFor(() => expect(result.current.worldId).toBe('constellation'));
    const primaryPlayer = jest.mocked(audio.createSessionPlayer).mock.results[0].value;
    expect(audio.createSessionPlayer).toHaveBeenCalledWith(
      expect.anything(),
      600,
      300,
      500,
      expect.objectContaining({
        title: 'Bringing the breath down',
        artist: 'Noctalia Meditation',
        albumTitle: 'Constellation',
      })
    );
    expect(audio.setVolume).toHaveBeenCalledWith(primaryPlayer, 0.2);
    expect(playbackListener).not.toBeNull();

    act(() => {
      playbackListener?.({
        currentTime: 580,
        duration: 600,
        playing: false,
        didJustFinish: true,
      });
    });

    expect(mockRecordProgress).toHaveBeenCalledWith('sleep-descent', 580, true);
    expect(mockRecordPractice).toHaveBeenCalledWith({
      sessionId: 'sleep-descent',
      seconds: 580,
    });
    expect(mockReplace).toHaveBeenCalledWith(
      '/session-complete?id=sleep-descent&worldId=constellation'
    );
    expect(audio.release).toHaveBeenCalledWith(primaryPlayer);
    expect(result.current.session).toBeNull();
    expect(result.current.status).toBe('idle');
    expect(result.current.positionSec).toBe(0);
  });

  it('replays a finished session from the start instead of seeking into a dead loop', async () => {
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <PlayerProvider>{children}</PlayerProvider>
    );
    const { result } = renderHook(() => usePlayer(), { wrapper });

    act(() => {
      result.current.open('sleep-descent', 580, 'constellation');
    });

    await waitFor(() => expect(audio.createSessionPlayer).toHaveBeenCalled());
    await waitFor(() => expect(result.current.positionSec).toBe(0));
    expect(audio.seekTo).not.toHaveBeenCalled();
    expect(audio.play).toHaveBeenCalled();
  });

  it('resumes an in-progress session at the saved position', async () => {
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <PlayerProvider>{children}</PlayerProvider>
    );
    const { result } = renderHook(() => usePlayer(), { wrapper });

    act(() => {
      result.current.open('sleep-descent', 120, 'constellation');
    });

    await waitFor(() => expect(audio.createSessionPlayer).toHaveBeenCalled());
    await waitFor(() => expect(result.current.positionSec).toBe(120));
    expect(audio.seekTo).toHaveBeenCalledWith(
      jest.mocked(audio.createSessionPlayer).mock.results[0].value,
      120
    );
  });

  it('persists an explicit backward seek as the resume base even after a stale native tick', async () => {
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <PlayerProvider>{children}</PlayerProvider>
    );
    const { result } = renderHook(() => usePlayer(), { wrapper });

    act(() => {
      result.current.open('anxiety-ground', 0, 'forest');
    });

    await waitFor(() => expect(audio.createSessionPlayer).toHaveBeenCalled());
    await waitFor(() => expect(playbackListener).not.toBeNull());
    const primaryPlayer = jest.mocked(audio.createSessionPlayer).mock.results[0].value as {
      playing: boolean;
      currentTime: number;
    };

    act(() => {
      playbackListener?.({
        currentTime: 445,
        duration: 600,
        playing: true,
        didJustFinish: false,
      });
    });
    expect(result.current.positionSec).toBe(445);
    expect(mockRecordProgress).toHaveBeenCalledWith('anxiety-ground', 445, false);

    act(() => result.current.toggle());
    expect(result.current.status).toBe('paused');

    act(() => result.current.seekTo(37));
    expect(result.current.positionSec).toBe(37);
    expect(audio.seekTo).toHaveBeenCalledWith(primaryPlayer, 37);
    expect(mockRecordProgress).toHaveBeenCalledWith('anxiety-ground', 37, false);

    act(() => {
      playbackListener?.({
        currentTime: 445,
        duration: 600,
        playing: false,
        didJustFinish: false,
      });
    });
    expect(result.current.positionSec).toBe(37);
    expect(mockRecordProgress.mock.calls.at(-1)).toEqual(['anxiety-ground', 37, false]);

    act(() => {
      appStateHandler?.('background');
    });
    expect(mockRecordProgress.mock.calls.at(-1)).toEqual(['anxiety-ground', 37, false]);
    expect(mockRecordProgress.mock.calls.filter((call) => call[2] === true)).toHaveLength(0);

    const savedPosition = mockRecordProgress.mock.calls.at(-1)?.[1] as number;
    act(() => {
      result.current.close();
    });
    act(() => {
      result.current.open('anxiety-ground', savedPosition, 'forest');
    });
    await waitFor(() =>
      expect(audio.seekTo).toHaveBeenCalledWith(
        jest.mocked(audio.createSessionPlayer).mock.results.at(-1)?.value,
        37
      )
    );
    expect(result.current.positionSec).toBe(37);
    expect(mockRecordPractice).not.toHaveBeenCalled();
  });

  it('layers the forest texture and lets the user silence and restore it', async () => {
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <PlayerProvider>{children}</PlayerProvider>
    );
    const { result } = renderHook(() => usePlayer(), { wrapper });

    act(() => {
      result.current.open('anxiety-ground', 0, 'forest');
    });

    await waitFor(() => expect(audio.createSessionPlayer).toHaveBeenCalled());
    await waitFor(() => expect(result.current.worldId).toBe('forest'));
    const primaryPlayer = jest.mocked(audio.createSessionPlayer).mock.results[0].value;
    const texturePlayer = jest.mocked(audio.createPlayer).mock.results[0].value;
    expect(audio.createPlayer).toHaveBeenCalledTimes(1);
    expect(audio.setLoop).toHaveBeenCalledWith(texturePlayer, true);
    expect(audio.setRate).toHaveBeenCalledWith(texturePlayer, 0.92);
    expect(audio.setVolume).toHaveBeenCalledWith(primaryPlayer, 0.26);
    expect(audio.setVolume).toHaveBeenCalledWith(texturePlayer, 0.11);
    expect(audio.play).toHaveBeenCalledWith(texturePlayer);

    act(() => result.current.toggleSound());
    await waitFor(() => expect(result.current.soundEnabled).toBe(false));
    expect(audio.setVolume).toHaveBeenCalledWith(primaryPlayer, 0);
    expect(audio.pause).toHaveBeenCalledWith(texturePlayer);

    act(() => {
      playbackListener?.({
        currentTime: 1,
        duration: 600,
        playing: true,
        didJustFinish: false,
      });
    });
    act(() => result.current.toggleSound());
    await waitFor(() => expect(result.current.soundEnabled).toBe(true));
    expect(audio.setVolume).toHaveBeenCalledWith(primaryPlayer, 0.26);
    expect(audio.play).toHaveBeenCalledWith(texturePlayer);
  });
  it('marks the session unavailable when native playback reports an error', async () => {
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <PlayerProvider>{children}</PlayerProvider>
    );
    const { result } = renderHook(() => usePlayer(), { wrapper });

    act(() => {
      result.current.open('sleep-descent', 0, 'constellation');
    });

    await waitFor(() => expect(audio.createSessionPlayer).toHaveBeenCalled());
    await waitFor(() => expect(playbackListener).not.toBeNull());

    act(() => {
      playbackListener?.({
        currentTime: 0,
        duration: 600,
        playing: false,
        didJustFinish: false,
        error: 'Source error',
      });
    });

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
  });


  it('marks the session unavailable when the audio cache fails before playback', async () => {
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <PlayerProvider>{children}</PlayerProvider>
    );
    const { result } = renderHook(() => usePlayer(), { wrapper });
    jest.mocked(audio.resolvePlayableSource).mockRejectedValueOnce(new Error('cache failed'));

    act(() => {
      result.current.open('sleep-descent', 0, 'constellation');
    });

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(audio.createSessionPlayer).not.toHaveBeenCalled();
    expect(audio.play).not.toHaveBeenCalled();
  });

  it('toggles pause and resume without duplicating a practised log', async () => {
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <PlayerProvider>{children}</PlayerProvider>
    );
    const { result } = renderHook(() => usePlayer(), { wrapper });

    act(() => {
      result.current.open('sleep-descent', 0, 'constellation');
    });

    await waitFor(() => expect(audio.createSessionPlayer).toHaveBeenCalled());
    await waitFor(() => expect(playbackListener).not.toBeNull());
    const primaryPlayer = jest.mocked(audio.createSessionPlayer).mock.results[0].value;

    act(() => {
      playbackListener?.({
        currentTime: 12,
        duration: 600,
        playing: true,
        didJustFinish: false,
      });
    });
    expect(result.current.status).toBe('playing');

    act(() => result.current.toggle());
    expect(audio.pause).toHaveBeenCalledWith(primaryPlayer);
    expect(result.current.status).toBe('paused');
    expect(mockRecordProgress).toHaveBeenCalledWith('sleep-descent', 12, false);

    act(() => result.current.toggle());
    expect(audio.play).toHaveBeenCalledWith(primaryPlayer);
    expect(result.current.status).toBe('playing');

    act(() => {
      playbackListener?.({
        currentTime: 540,
        duration: 600,
        playing: true,
        didJustFinish: false,
      });
    });
    act(() => {
      playbackListener?.({
        currentTime: 550,
        duration: 600,
        playing: true,
        didJustFinish: false,
      });
    });

    expect(mockRecordPractice).toHaveBeenCalledTimes(1);
    expect(mockRecordProgress.mock.calls.filter((call) => call[2] === true)).toHaveLength(1);
  });

  it('keeps playing in the background and only persists the latest position', async () => {
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <PlayerProvider>{children}</PlayerProvider>
    );
    const { result } = renderHook(() => usePlayer(), { wrapper });

    act(() => {
      result.current.open('sleep-descent', 0, 'constellation');
    });

    await waitFor(() => expect(audio.createSessionPlayer).toHaveBeenCalled());
    await waitFor(() => expect(playbackListener).not.toBeNull());
    const primaryPlayer = jest.mocked(audio.createSessionPlayer).mock.results[0].value;
    expect(audio.createSessionPlayer).toHaveBeenCalledWith(
      expect.anything(),
      600,
      300,
      500,
      expect.objectContaining({
        title: 'Bringing the breath down',
        artist: 'Noctalia Meditation',
        albumTitle: 'Constellation',
      })
    );

    act(() => {
      playbackListener?.({
        currentTime: 20,
        duration: 600,
        playing: true,
        didJustFinish: false,
      });
    });
    expect(result.current.status).toBe('playing');

    expect(appStateHandler).not.toBeNull();
    act(() => {
      appStateHandler?.('background');
    });

    expect(audio.pause).not.toHaveBeenCalledWith(primaryPlayer);
    expect(result.current.status).toBe('playing');
    expect(mockRecordProgress).toHaveBeenCalledWith('sleep-descent', 20, false);
  });

  it('mirrors lock-screen pause onto the layered texture without duplicating practice', async () => {
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <PlayerProvider>{children}</PlayerProvider>
    );
    const { result } = renderHook(() => usePlayer(), { wrapper });

    act(() => {
      result.current.open('anxiety-ground', 0, 'forest');
    });

    await waitFor(() => expect(audio.createSessionPlayer).toHaveBeenCalled());
    await waitFor(() => expect(playbackListener).not.toBeNull());
    const texturePlayer = jest.mocked(audio.createPlayer).mock.results[0].value;

    act(() => {
      playbackListener?.({
        currentTime: 18,
        duration: 600,
        playing: true,
        didJustFinish: false,
      });
    });
    expect(result.current.status).toBe('playing');

    act(() => {
      playbackListener?.({
        currentTime: 19,
        duration: 600,
        playing: false,
        didJustFinish: false,
      });
    });
    expect(result.current.status).toBe('paused');
    expect(audio.pause).toHaveBeenCalledWith(texturePlayer);
    expect(mockRecordPractice).not.toHaveBeenCalled();
  });

  it('resyncs a native interruption on AppState active so hidden chrome can return', async () => {
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <PlayerProvider>{children}</PlayerProvider>
    );
    const { result } = renderHook(() => usePlayer(), { wrapper });

    act(() => {
      result.current.open('anxiety-ground', 0, 'forest');
    });

    await waitFor(() => expect(audio.createSessionPlayer).toHaveBeenCalled());
    await waitFor(() => expect(playbackListener).not.toBeNull());
    const primaryPlayer = jest.mocked(audio.createSessionPlayer).mock.results[0].value as {
      playing: boolean;
      currentTime: number;
    };
    const texturePlayer = jest.mocked(audio.createPlayer).mock.results[0].value;

    act(() => {
      playbackListener?.({
        currentTime: 83,
        duration: 600,
        playing: true,
        didJustFinish: false,
      });
    });
    expect(result.current.status).toBe('playing');
    expect(result.current.positionSec).toBe(83);

    act(() => {
      appStateHandler?.('background');
    });
    expect(result.current.status).toBe('playing');

    primaryPlayer.playing = false;
    primaryPlayer.currentTime = 83.916;
    const progressCalls = mockRecordProgress.mock.calls.length;

    act(() => {
      appStateHandler?.('active');
    });

    expect(result.current.status).toBe('paused');
    expect(result.current.positionSec).toBe(83.916);
    expect(audio.pause).toHaveBeenCalledWith(texturePlayer);
    expect(mockRecordProgress.mock.calls.length).toBeGreaterThan(progressCalls);
    expect(mockRecordProgress).toHaveBeenCalledWith('anxiety-ground', 84, false);
    expect(mockRecordPractice).not.toHaveBeenCalled();
  });

  it('detects a native interruption when Android keeps both media activities resumed', async () => {
    jest.useFakeTimers();
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <PlayerProvider>{children}</PlayerProvider>
    );
    const { result, unmount } = renderHook(() => usePlayer(), { wrapper });

    act(() => {
      result.current.open('anxiety-ground', 0, 'forest');
    });

    await waitFor(() => expect(audio.createSessionPlayer).toHaveBeenCalled());
    await waitFor(() => expect(playbackListener).not.toBeNull());
    const primaryPlayer = jest.mocked(audio.createSessionPlayer).mock.results[0].value as {
      playing: boolean;
      currentTime: number;
    };
    const texturePlayer = jest.mocked(audio.createPlayer).mock.results[0].value;

    act(() => {
      playbackListener?.({
        currentTime: 14,
        duration: 600,
        playing: true,
        didJustFinish: false,
      });
    });
    expect(result.current.status).toBe('playing');
    expect(primaryPlayer.playing).toBe(true);

    primaryPlayer.playing = false;
    primaryPlayer.currentTime = 14.208;

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.status).toBe('paused');
    expect(result.current.positionSec).toBe(14.208);
    expect(audio.pause).toHaveBeenCalledWith(texturePlayer);
    expect(mockRecordProgress).toHaveBeenCalledWith('anxiety-ground', 14, false);
    expect(mockRecordPractice).not.toHaveBeenCalled();

    unmount();
    jest.useRealTimers();
  });

  it('exposes localized play/pause labels without internal-state TalkBack hints', async () => {
    const onToggle = jest.fn();
    const onSkip = jest.fn();
    const view = render(
      <PlayerControls playing={false} loading={false} onToggle={onToggle} onSkip={onSkip} />
    );
    const toggle = screen.getByTestId(TID.Button.PlayerToggle);
    expect(toggle.props.accessibilityLabel).toBe('Play');
    expect(toggle.props.accessibilityHint).toBeUndefined();
    expect(toggle.props.accessibilityState).toMatchObject({ busy: false, selected: false });
    view.unmount();

    const pauseView = render(
      <PlayerControls playing loading={false} onToggle={onToggle} onSkip={onSkip} />
    );
    const pause = screen.getByTestId(TID.Button.PlayerToggle);
    expect(pause.props.accessibilityLabel).toBe('Pause');
    expect(pause.props.accessibilityHint).toBeUndefined();
    expect(pause.props.accessibilityState).toMatchObject({ busy: false, selected: true });
    pauseView.unmount();

    const { result } = renderHook(() => usePlayer(), {
      wrapper: ({ children }: React.PropsWithChildren) => (
        <PlayerProvider>
          <MiniPlayer />
          {children}
        </PlayerProvider>
      ),
    });
    act(() => {
      result.current.open('sleep-descent', 0, 'constellation');
    });
    await waitFor(() => expect(playbackListener).not.toBeNull());
    act(() => {
      playbackListener?.({
        currentTime: 4,
        duration: 600,
        playing: true,
        didJustFinish: false,
      });
    });
    await waitFor(() => expect(result.current.status).toBe('playing'));
    const miniToggle = screen.getByLabelText('Pause');
    expect(miniToggle.props.accessibilityHint).toBeUndefined();
    expect(miniToggle.props.accessibilityState).toMatchObject({ selected: true });
  });

  it('keeps one AppState listener and persists the latest position after later ticks', async () => {
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <PlayerProvider>{children}</PlayerProvider>
    );
    const { result } = renderHook(() => usePlayer(), { wrapper });

    act(() => {
      result.current.open('sleep-descent', 0, 'constellation');
    });
    await waitFor(() => expect(audio.createSessionPlayer).toHaveBeenCalled());
    await waitFor(() => expect(playbackListener).not.toBeNull());
    expect(
      jest.mocked(AppState.addEventListener).mock.calls.filter(([event]) => event === 'change')
    ).toHaveLength(1);

    act(() => {
      playbackListener?.({
        currentTime: 8,
        duration: 600,
        playing: true,
        didJustFinish: false,
      });
    });
    act(() => {
      playbackListener?.({
        currentTime: 27,
        duration: 600,
        playing: true,
        didJustFinish: false,
      });
    });
    expect(result.current.positionSec).toBe(27);
    expect(
      jest.mocked(AppState.addEventListener).mock.calls.filter(([event]) => event === 'change')
    ).toHaveLength(1);

    act(() => {
      appStateHandler?.('inactive');
    });
    expect(result.current.status).toBe('playing');
    expect(mockRecordProgress).toHaveBeenCalledWith('sleep-descent', 27, false);
  });
});

describe('PlayerContext fade timer', () => {
  const wrapper = ({ children }: React.PropsWithChildren) => (
    <PlayerProvider>{children}</PlayerProvider>
  );

  const openPlayingForestSession = async () => {
    const { result, unmount } = renderHook(() => usePlayer(), { wrapper });

    act(() => {
      result.current.open('anxiety-ground', 0, 'forest');
    });

    await waitFor(() => expect(audio.createSessionPlayer).toHaveBeenCalled());
    await waitFor(() => expect(playbackListener).not.toBeNull());

    const primaryPlayer = jest.mocked(audio.createSessionPlayer).mock.results.at(-1)?.value;
    const texturePlayer = jest.mocked(audio.createPlayer).mock.results.at(-1)?.value;

    act(() => {
      playbackListener?.({
        currentTime: 12,
        duration: 600,
        playing: true,
        didJustFinish: false,
      });
    });
    expect(result.current.status).toBe('playing');

    return { result, unmount, primaryPlayer, texturePlayer };
  };

  beforeEach(() => {
    playbackListener = null;
    mockRecordProgress.mockClear();
    mockRecordPractice.mockClear();
    mockReplace.mockClear();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts a fade, ramps the last minute, then pauses without logging extra practice', async () => {
    const { result, unmount, primaryPlayer, texturePlayer } = await openPlayingForestSession();

    act(() => {
      result.current.setFadeTimer(5);
    });
    expect(result.current.fadeMinutes).toBe(5);
    expect(result.current.fadeRemainingSec).toBe(300);

    act(() => {
      jest.advanceTimersByTime(241_000);
    });
    expect(result.current.fadeRemainingSec).toBe(59);
    expect(audio.setVolume).toHaveBeenCalledWith(primaryPlayer, fadeVolume(59, 0.26));
    expect(audio.setVolume).toHaveBeenCalledWith(texturePlayer, fadeVolume(59, 0.11));

    const progressBeforeExpiry = mockRecordProgress.mock.calls.length;
    const practiceBeforeExpiry = mockRecordPractice.mock.calls.length;

    act(() => {
      jest.advanceTimersByTime(59_000);
    });
    expect(result.current.fadeRemainingSec).toBeNull();
    expect(audio.setVolume).toHaveBeenCalledWith(primaryPlayer, 0);
    expect(audio.setVolume).toHaveBeenCalledWith(texturePlayer, 0);
    expect(audio.pause).toHaveBeenCalledWith(primaryPlayer);
    expect(audio.pause).toHaveBeenCalledWith(texturePlayer);
    expect(result.current.status).toBe('paused');
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockRecordPractice).toHaveBeenCalledTimes(practiceBeforeExpiry);
    expect(mockRecordProgress.mock.calls.length).toBe(progressBeforeExpiry);

    const pauseCalls = jest.mocked(audio.pause).mock.calls.length;
    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    expect(jest.mocked(audio.pause).mock.calls.length).toBe(pauseCalls);
    expect(result.current.fadeRemainingSec).toBeNull();
    expect(result.current.status).toBe('paused');

    act(() => result.current.toggle());
    expect(result.current.status).toBe('playing');
    expect(audio.play).toHaveBeenCalledWith(primaryPlayer);

    unmount();
  });

  it('replaces an existing fade instead of stacking intervals', async () => {
    const { result, unmount, primaryPlayer } = await openPlayingForestSession();

    act(() => {
      result.current.setFadeTimer(5);
    });
    act(() => {
      jest.advanceTimersByTime(3_000);
    });
    expect(result.current.fadeRemainingSec).toBe(297);

    act(() => {
      result.current.setFadeTimer(10);
    });
    expect(result.current.fadeMinutes).toBe(10);
    expect(result.current.fadeRemainingSec).toBe(600);

    act(() => {
      jest.advanceTimersByTime(4_000);
    });
    expect(result.current.fadeRemainingSec).toBe(596);
    expect(audio.setVolume).toHaveBeenCalledWith(primaryPlayer, 0.26);

    unmount();
  });

  it('freezes on pause and resumes from the remaining time', async () => {
    const { result, unmount, primaryPlayer } = await openPlayingForestSession();

    act(() => {
      result.current.setFadeTimer(5);
    });
    act(() => {
      jest.advanceTimersByTime(8_000);
    });
    expect(result.current.fadeRemainingSec).toBe(292);

    const volumeCalls = jest.mocked(audio.setVolume).mock.calls.length;
    act(() => result.current.toggle());
    expect(result.current.status).toBe('paused');

    act(() => {
      jest.advanceTimersByTime(12_000);
    });
    expect(result.current.fadeRemainingSec).toBe(292);
    expect(jest.mocked(audio.setVolume).mock.calls.length).toBe(volumeCalls);

    act(() => result.current.toggle());
    expect(result.current.status).toBe('playing');
    act(() => {
      jest.advanceTimersByTime(3_000);
    });
    expect(result.current.fadeRemainingSec).toBe(289);
    expect(audio.setVolume).toHaveBeenCalledWith(primaryPlayer, 0.26);

    unmount();
  });

  it('cancels a fade without pausing playback, and close/finish do not double-release or double-log', async () => {
    const { result, unmount, primaryPlayer, texturePlayer } = await openPlayingForestSession();

    act(() => {
      result.current.setFadeTimer(5);
    });
    act(() => {
      jest.advanceTimersByTime(2_000);
    });
    expect(result.current.fadeRemainingSec).toBe(298);

    const pauseCalls = jest.mocked(audio.pause).mock.calls.length;
    act(() => {
      result.current.setFadeTimer(null);
    });
    expect(result.current.fadeMinutes).toBeNull();
    expect(result.current.fadeRemainingSec).toBeNull();

    act(() => {
      jest.advanceTimersByTime(8_000);
    });
    expect(result.current.fadeRemainingSec).toBeNull();
    expect(jest.mocked(audio.pause).mock.calls.length).toBe(pauseCalls);
    expect(result.current.status).toBe('playing');

    const {
      result: finished,
      unmount: unmountFinished,
      primaryPlayer: finishedPlayer,
    } = await openPlayingForestSession();
    act(() => {
      finished.current.setFadeTimer(5);
    });
    act(() => {
      playbackListener?.({
        currentTime: 580,
        duration: 600,
        playing: false,
        didJustFinish: true,
      });
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(audio.release).toHaveBeenCalledWith(finishedPlayer);
    expect(finished.current.status).toBe('idle');
    expect(finished.current.fadeRemainingSec).toBeNull();

    const releaseCalls = jest.mocked(audio.release).mock.calls.length;
    const practiceCalls = mockRecordPractice.mock.calls.length;
    act(() => {
      jest.advanceTimersByTime(3_000);
    });
    expect(jest.mocked(audio.release).mock.calls.length).toBe(releaseCalls);
    expect(mockRecordPractice).toHaveBeenCalledTimes(practiceCalls);

    const {
      result: closed,
      unmount: unmountClosed,
      primaryPlayer: closedPlayer,
    } = await openPlayingForestSession();
    act(() => {
      closed.current.setFadeTimer(5);
    });
    act(() => {
      closed.current.close();
    });
    expect(closed.current.status).toBe('idle');
    expect(closed.current.fadeRemainingSec).toBeNull();
    expect(audio.release).toHaveBeenCalledWith(closedPlayer);

    const releaseAfterClose = jest.mocked(audio.release).mock.calls.length;
    act(() => {
      jest.advanceTimersByTime(4_000);
    });
    expect(jest.mocked(audio.release).mock.calls.length).toBe(releaseAfterClose);
    expect(mockReplace).toHaveBeenCalledTimes(1);

    unmount();
    unmountFinished();
    unmountClosed();
    expect(primaryPlayer).toBeTruthy();
    expect(texturePlayer).toBeTruthy();
  });
});
