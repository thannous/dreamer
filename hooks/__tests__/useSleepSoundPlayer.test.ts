/* @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import {
  setAudioModeAsync,
  useAudioPlayer,
} from 'expo-audio';

import type { SleepSoundConfig } from '@/lib/sleepSounds';
import { useSleepSoundPlayer } from '@/hooks/useSleepSoundPlayer';
import { ensureSleepSoundFile } from '@/services/sleepSoundFiles';

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

jest.mock('@/services/sleepSoundFiles', () => ({
  ensureSleepSoundFile: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn((callback: () => void | (() => void)) => {
    focusCleanup = callback() ?? undefined;
  }),
}));

const sound: SleepSoundConfig = {
  id: 'rain',
  remoteUrl: 'https://noctalia.app/audio/sleep/rain.m4a',
};

const LOCAL_URI = 'file:///document/sleep-sounds/rain.m4a';

// The loop resolves asynchronously (cached file or first download).
async function flushDownload() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useSleepSoundPlayer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-04T20:00:00Z'));
    jest.clearAllMocks();
    focusCleanup = undefined;
    mockPlayer.loop = true;
    mockPlayer.volume = 1;
    mockStatus.currentTime = 0;
    mockStatus.didJustFinish = false;
    mockStatus.duration = 300;
    mockStatus.isBuffering = false;
    mockStatus.isLoaded = true;
    mockStatus.playing = false;
    jest.mocked(setAudioModeAsync).mockResolvedValue(undefined);
    jest.mocked(mockPlayer.seekTo).mockResolvedValue(undefined);
    jest.mocked(ensureSleepSoundFile).mockResolvedValue(LOCAL_URI);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('configures background playback and loops the compact source', async () => {
    const { result } = renderHook(() =>
      useSleepSoundPlayer({
        sound,
        durationMinutes: 15,
        title: 'Gentle rain',
        albumTitle: 'Evening ambience',
      }),
    );
    await flushDownload();

    await act(async () => {
      await result.current.play();
    });

    expect(useAudioPlayer).toHaveBeenLastCalledWith({ uri: LOCAL_URI }, {
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
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayer.loop).toBe(true);
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
    const { result } = renderHook(() =>
      useSleepSoundPlayer({
        sound,
        durationMinutes: 30,
        title: 'Gentle rain',
        albumTitle: 'Evening ambience',
      }),
    );
    await flushDownload();

    await act(async () => {
      await result.current.play();
    });
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    act(() => {
      result.current.pause();
    });

    await act(async () => {
      await result.current.play();
    });

    expect(mockPlayer.seekTo).toHaveBeenCalledTimes(1);
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayer.play).toHaveBeenCalledTimes(2);
    expect(result.current.remainingSeconds).toBe(30 * 60 - 5);
  });

  it('keeps the timer aligned with native lock-screen pauses and resumes', async () => {
    const { result, rerender } = renderHook(() =>
      useSleepSoundPlayer({
        sound,
        durationMinutes: 15,
        title: 'Gentle rain',
        albumTitle: 'Evening ambience',
      }),
    );
    await flushDownload();

    await act(async () => {
      await result.current.play();
    });
    act(() => {
      mockStatus.playing = true;
      rerender();
    });
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    act(() => {
      mockStatus.playing = false;
      rerender();
    });

    expect(result.current.remainingSeconds).toBe(15 * 60 - 5);

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.remainingSeconds).toBe(15 * 60 - 5);

    act(() => {
      mockStatus.playing = true;
      rerender();
    });
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.remainingSeconds).toBe(15 * 60 - 10);
  });

  it('stops playback when the selected timer expires', async () => {
    const { result } = renderHook(() =>
      useSleepSoundPlayer({
        sound,
        durationMinutes: 15,
        title: 'Gentle rain',
        albumTitle: 'Evening ambience',
      }),
    );
    await flushDownload();

    await act(async () => {
      await result.current.play();
    });

    // The last minute fades out instead of cutting the sound.
    act(() => {
      jest.setSystemTime(new Date('2026-08-04T20:14:30Z'));
      jest.advanceTimersByTime(500);
    });
    expect(mockPlayer.volume).toBeCloseTo(0.65 / 2, 1);
    expect(mockPlayer.pause).not.toHaveBeenCalled();

    act(() => {
      jest.setSystemTime(new Date('2026-08-04T20:15:00Z'));
      jest.advanceTimersByTime(500);
    });

    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    expect(mockPlayer.clearLockScreenControls).toHaveBeenCalledTimes(1);
    expect(result.current.remainingSeconds).toBe(0);
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

  it('ignores a released native player during focus cleanup', () => {
    mockPlayer.pause.mockImplementationOnce(() => {
      throw new Error('Cannot use shared object that was already released');
    });

    renderHook(() =>
      useSleepSoundPlayer({
        sound,
        durationMinutes: 45,
        title: 'Gentle rain',
        albumTitle: 'Evening ambience',
      }),
    );

    expect(() => {
      act(() => {
        focusCleanup?.();
      });
    }).not.toThrow();
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
    await flushDownload();

    await act(async () => {
      await result.current.play();
    });

    expect(result.current.error).toBe('playback_failed');
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(mockPlayer.clearLockScreenControls).toHaveBeenCalled();
  });

  it('reports a failed first download and retries it on the next play', async () => {
    jest.mocked(ensureSleepSoundFile).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() =>
      useSleepSoundPlayer({
        sound,
        durationMinutes: 30,
        title: 'Gentle rain',
        albumTitle: 'Evening ambience',
      }),
    );
    await flushDownload();

    expect(result.current.error).toBe('download_failed');
    expect(result.current.isLoaded).toBe(false);

    await act(async () => {
      await result.current.play();
    });
    await flushDownload();

    expect(ensureSleepSoundFile).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoaded).toBe(true);
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });
});
