/* @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import {
  setAudioModeAsync,
  useAudioPlayer,
} from 'expo-audio';

import type { SleepSoundConfig } from '@/lib/sleepSounds';
import { useSleepSoundPlayer } from '@/hooks/useSleepSoundPlayer';
import { endSleepTimer, showSleepTimer } from '@/services/noctaliaWidgets';
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

jest.mock('@/services/noctaliaWidgets', () => ({
  endSleepTimer: jest.fn(),
  showSleepTimer: jest.fn(),
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
    // Without lock-screen words (Lucid), no countdown leaves the app.
    expect(showSleepTimer).not.toHaveBeenCalled();
  });

  it('counts down on the lock screen while the session plays or pauses, until it runs out', async () => {
    const lockScreenTimer = { caption: 'Fades out in', paused: 'Paused' };
    const { result } = renderHook(() =>
      useSleepSoundPlayer({
        sound,
        durationMinutes: 15,
        title: 'Gentle rain',
        albumTitle: 'Evening ambience',
        lockScreenTimer,
      }),
    );
    await flushDownload();
    expect(showSleepTimer).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.play();
    });
    expect(showSleepTimer).toHaveBeenLastCalledWith({
      sound: 'Gentle rain', caption: 'Fades out in', remainingMs: 15 * 60_000, paused: false,
    });

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    act(() => {
      result.current.pause();
    });
    expect(showSleepTimer).toHaveBeenLastCalledWith({
      sound: 'Gentle rain', caption: 'Paused', remainingMs: 15 * 60_000 - 5000, paused: true,
    });
    // The system counts down by itself: the ticks in between never reached it.
    expect(showSleepTimer).toHaveBeenCalledTimes(2);

    await act(async () => {
      await result.current.play();
    });
    jest.mocked(endSleepTimer).mockClear();
    jest.mocked(showSleepTimer).mockClear();
    act(() => {
      jest.setSystemTime(new Date('2026-08-04T20:15:10Z'));
      jest.advanceTimersByTime(500);
    });

    expect(result.current.remainingSeconds).toBe(0);
    expect(endSleepTimer).toHaveBeenCalled();
    expect(showSleepTimer).not.toHaveBeenCalled();
  });

  it('takes a paused countdown off the lock screen when the screen is left', async () => {
    const lockScreenTimer = { caption: 'Fades out in', paused: 'Paused' };
    const { result } = renderHook(() =>
      useSleepSoundPlayer({
        sound,
        durationMinutes: 15,
        title: 'Gentle rain',
        albumTitle: 'Evening ambience',
        lockScreenTimer,
      }),
    );
    await flushDownload();
    await act(async () => {
      await result.current.play();
    });
    act(() => {
      result.current.pause();
    });
    jest.mocked(endSleepTimer).mockClear();
    jest.mocked(showSleepTimer).mockClear();

    act(() => {
      focusCleanup?.();
    });

    expect(endSleepTimer).toHaveBeenCalled();
    expect(showSleepTimer).not.toHaveBeenCalled();
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

  it('reports a failed first download, retries it on the next play and then starts', async () => {
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
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  it('does not start a retried download after Stop', async () => {
    jest.mocked(ensureSleepSoundFile).mockRejectedValueOnce(new Error('offline'));
    let resolveRetry: (uri: string) => void = () => {};
    const { result } = renderHook(() =>
      useSleepSoundPlayer({
        sound,
        durationMinutes: 30,
        title: 'Gentle rain',
        albumTitle: 'Evening ambience',
      }),
    );
    await flushDownload();
    jest.mocked(ensureSleepSoundFile).mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveRetry = resolve;
      }),
    );

    await act(async () => {
      await result.current.play();
    });
    await act(async () => {
      await result.current.stop();
    });
    await act(async () => {
      resolveRetry(LOCAL_URI);
    });
    await flushDownload();

    expect(result.current.isLoaded).toBe(true);
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  it('offers a retry when the player still cannot open the loop after 30 seconds', async () => {
    mockStatus.isLoaded = false;
    const { result, rerender } = renderHook(() =>
      useSleepSoundPlayer({
        sound,
        durationMinutes: 30,
        title: 'Gentle rain',
        albumTitle: 'Evening ambience',
      }),
    );
    await flushDownload();

    act(() => {
      jest.advanceTimersByTime(29_999);
    });
    expect(result.current.error).toBeNull();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.error).toBe('download_failed');

    // The source opens late: the error clears without another tap.
    mockStatus.isLoaded = true;
    rerender();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoaded).toBe(true);
  });

  it('reports a sound that drops out while playing as interrupted and resumes it on retry', async () => {
    const { result, rerender } = renderHook(() =>
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
    mockStatus.playing = true;
    rerender();
    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    // The Android decoder fails: the loaded file leaves the player.
    mockStatus.playing = false;
    mockStatus.isLoaded = false;
    rerender();
    act(() => {
      jest.advanceTimersByTime(2_999);
    });
    expect(result.current.error).toBeNull();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.error).toBe('playback_interrupted');

    jest.mocked(mockPlayer.play).mockClear();
    jest.mocked(mockPlayer.seekTo).mockClear();
    await act(async () => {
      await result.current.play();
    });
    await flushDownload();
    // The player reports the reloaded file.
    mockStatus.isLoaded = true;
    rerender();
    await flushDownload();

    expect(result.current.error).toBeNull();
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.seekTo).not.toHaveBeenCalled();
    expect(result.current.remainingSeconds).toBe(29 * 60);
  });

  it('classifies a dropout afresh once a late source has loaded and played', async () => {
    mockStatus.isLoaded = false;
    const { result, rerender } = renderHook(() =>
      useSleepSoundPlayer({
        sound,
        durationMinutes: 30,
        title: 'Gentle rain',
        albumTitle: 'Evening ambience',
      }),
    );
    await flushDownload();
    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(result.current.error).toBe('download_failed');

    mockStatus.isLoaded = true;
    rerender();
    expect(result.current.error).toBeNull();
    await act(async () => {
      await result.current.play();
    });
    mockStatus.playing = true;
    rerender();

    mockStatus.playing = false;
    mockStatus.isLoaded = false;
    rerender();
    expect(result.current.error).toBeNull();
    act(() => {
      jest.advanceTimersByTime(3_000);
    });
    expect(result.current.error).toBe('playback_interrupted');
  });

  it('does not call a sound interrupted when it was never heard', async () => {
    const { result, rerender } = renderHook(() =>
      useSleepSoundPlayer({
        sound,
        durationMinutes: 30,
        title: 'Gentle rain',
        albumTitle: 'Evening ambience',
      }),
    );
    await flushDownload();

    mockStatus.isLoaded = false;
    rerender();
    act(() => {
      jest.advanceTimersByTime(3_000);
    });
    expect(result.current.error).toBeNull();
  });

  it('does not call a stopped sound interrupted when the native status lags behind Stop', async () => {
    const { result, rerender } = renderHook(() =>
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
    mockStatus.playing = true;
    rerender();

    // Stop lands while the last native snapshot still says playing.
    await act(async () => {
      await result.current.stop();
    });
    rerender();
    mockStatus.playing = false;
    mockStatus.isLoaded = false;
    rerender();
    act(() => {
      jest.advanceTimersByTime(3_000);
    });
    expect(result.current.error).toBeNull();
  });

  it('does not start a retried download after the screen loses focus', async () => {
    jest.mocked(ensureSleepSoundFile).mockRejectedValueOnce(new Error('offline'));
    let resolveRetry: (uri: string) => void = () => {};
    const { result } = renderHook(() =>
      useSleepSoundPlayer({
        sound,
        durationMinutes: 30,
        title: 'Gentle rain',
        albumTitle: 'Evening ambience',
      }),
    );
    await flushDownload();
    jest.mocked(ensureSleepSoundFile).mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveRetry = resolve;
      }),
    );

    await act(async () => {
      await result.current.play();
    });
    act(() => {
      focusCleanup?.();
    });
    await act(async () => {
      resolveRetry(LOCAL_URI);
    });
    await flushDownload();

    expect(result.current.isLoaded).toBe(true);
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  it('hands the loop to the player again when a load timeout is retried', async () => {
    mockStatus.isLoaded = false;
    const { result } = renderHook(() =>
      useSleepSoundPlayer({
        sound,
        durationMinutes: 30,
        title: 'Gentle rain',
        albumTitle: 'Evening ambience',
      }),
    );
    await flushDownload();
    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(result.current.error).toBe('download_failed');
    jest.mocked(useAudioPlayer).mockClear();

    await act(async () => {
      await result.current.play();
    });
    await flushDownload();

    const sources = jest.mocked(useAudioPlayer).mock.calls.map(([source]) => source);
    expect(sources).toContainEqual(null);
    expect(sources[sources.length - 1]).toEqual({ uri: LOCAL_URI });
  });
});
