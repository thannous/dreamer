/* @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import {
  setAudioModeAsync,
  useAudioPlayer,
} from 'expo-audio';

import type { SleepSoundConfig } from '@/lib/sleepSounds';
import { useSleepSoundPlayer } from '@/hooks/useSleepSoundPlayer';

let focusCleanup: (() => void) | undefined;

const mockPlayer = {
  clearLockScreenControls: jest.fn(),
  loop: true,
  pause: jest.fn(),
  play: jest.fn(),
  seekTo: jest.fn().mockResolvedValue(undefined),
  setActiveForLockScreen: jest.fn(),
  volume: 1,
};

const mockStatus = {
  currentTime: 0,
  didJustFinish: false,
  duration: 2700,
  isBuffering: false,
  isLoaded: true,
  playing: false,
};

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  useAudioPlayer: jest.fn(() => mockPlayer),
  useAudioPlayerStatus: jest.fn(() => mockStatus),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn((callback: () => void | (() => void)) => {
    focusCleanup = callback() ?? undefined;
  }),
}));

const sound: SleepSoundConfig = {
  id: 'rain',
  icon: 'cloud.rain.fill',
  source: 1,
};

describe('useSleepSoundPlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    focusCleanup = undefined;
    mockPlayer.loop = true;
    mockPlayer.volume = 1;
    mockStatus.currentTime = 0;
    mockStatus.didJustFinish = false;
    mockStatus.duration = 2700;
    mockStatus.isBuffering = false;
    mockStatus.isLoaded = true;
    mockStatus.playing = false;
    jest.mocked(setAudioModeAsync).mockResolvedValue(undefined);
    jest.mocked(mockPlayer.seekTo).mockResolvedValue(undefined);
  });

  it('configures background playback and seeks to the 15 minute start point', async () => {
    const { result } = renderHook(() =>
      useSleepSoundPlayer({
        sound,
        durationMinutes: 15,
        title: 'Gentle rain',
        albumTitle: 'Evening ambience',
      }),
    );

    await act(async () => {
      await result.current.play();
    });

    expect(useAudioPlayer).toHaveBeenCalledWith(sound.source, {
      downloadFirst: true,
      updateInterval: 500,
    });
    expect(setAudioModeAsync).toHaveBeenCalledWith({
      allowsRecording: false,
      interruptionMode: 'doNotMix',
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
    });
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(1800);
    expect(mockPlayer.loop).toBe(false);
    expect(mockPlayer.volume).toBe(0.65);
    expect(mockPlayer.setActiveForLockScreen).toHaveBeenCalledWith(
      true,
      {
        title: 'Gentle rain',
        artist: 'Noctalia',
        albumTitle: 'Evening ambience',
      },
      {
        isLiveStream: false,
        showSeekBackward: false,
        showSeekForward: false,
      },
    );
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  it('resumes a paused session without seeking back to the start', async () => {
    const { result, rerender } = renderHook(() =>
      useSleepSoundPlayer({
        sound,
        durationMinutes: 30,
        title: 'Gentle rain',
        albumTitle: 'Evening ambience',
      }),
    );

    await act(async () => {
      await result.current.play();
    });
    mockStatus.currentTime = 1200;
    rerender();

    await act(async () => {
      await result.current.play();
    });

    expect(mockPlayer.seekTo).toHaveBeenCalledTimes(1);
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(900);
    expect(mockPlayer.play).toHaveBeenCalledTimes(2);
  });

  it('pauses and clears lock-screen controls when the route loses focus', () => {
    renderHook(() =>
      useSleepSoundPlayer({
        sound,
        durationMinutes: 45,
        title: 'Gentle rain',
        albumTitle: 'Evening ambience',
      }),
    );

    act(() => {
      focusCleanup?.();
    });

    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    expect(mockPlayer.clearLockScreenControls).toHaveBeenCalledTimes(1);
  });

  it('surfaces a playback error without starting the player', async () => {
    jest.mocked(setAudioModeAsync).mockRejectedValueOnce(new Error('audio unavailable'));
    const { result } = renderHook(() =>
      useSleepSoundPlayer({
        sound,
        durationMinutes: 30,
        title: 'Gentle rain',
        albumTitle: 'Evening ambience',
      }),
    );

    await act(async () => {
      await result.current.play();
    });

    expect(result.current.error).toBe('playback_failed');
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(mockPlayer.clearLockScreenControls).toHaveBeenCalled();
  });
});
