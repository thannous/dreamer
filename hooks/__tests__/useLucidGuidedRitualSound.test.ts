/* @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';

import {
  LUCID_GUIDED_RITUAL_SOUND_DURATION_MS,
  LUCID_GUIDED_RITUAL_SOUND_VOLUME,
  useLucidGuidedRitualSound,
} from '@/hooks/useLucidGuidedRitualSound';

const mockPlayer = {
  loop: true,
  pause: jest.fn(),
  play: jest.fn(),
  seekTo: jest.fn().mockResolvedValue(undefined),
  volume: 1,
};

const mockStatus = {
  didJustFinish: false,
  isLoaded: true,
  mediaServicesDidReset: false,
  playing: false,
};

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  useAudioPlayer: jest.fn(() => mockPlayer),
  useAudioPlayerStatus: jest.fn(() => mockStatus),
}));

describe('useLucidGuidedRitualSound', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockPlayer.loop = true;
    mockPlayer.volume = 1;
    mockPlayer.seekTo.mockResolvedValue(undefined);
    mockStatus.didJustFinish = false;
    mockStatus.isLoaded = true;
    mockStatus.mediaServicesDidReset = false;
    mockStatus.playing = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stays silent when the optional cue is disabled', async () => {
    const onUnexpectedInterruption = jest.fn();
    const { result } = renderHook(() => useLucidGuidedRitualSound(false, onUnexpectedInterruption));

    await act(async () => {
      await expect(result.current.playTransition()).resolves.toBe(false);
    });

    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(setAudioModeAsync).not.toHaveBeenCalled();
    expect(onUnexpectedInterruption).not.toHaveBeenCalled();
  });

  it('plays one quiet foreground cue and stops it after the bounded duration', async () => {
    const { result } = renderHook(() => useLucidGuidedRitualSound(true));

    await act(async () => {
      await expect(result.current.playTransition()).resolves.toBe(true);
    });

    expect(useAudioPlayer).toHaveBeenCalledWith(expect.anything(), {
      downloadFirst: true,
      updateInterval: 500,
    });
    expect(setAudioModeAsync).toHaveBeenCalledWith({
      allowsRecording: false,
      interruptionMode: 'doNotMix',
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
    expect(mockPlayer.loop).toBe(false);
    expect(mockPlayer.volume).toBe(LUCID_GUIDED_RITUAL_SOUND_VOLUME);
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(LUCID_GUIDED_RITUAL_SOUND_DURATION_MS);
      await Promise.resolve();
    });

    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
  });

  it('cleans up a playing cue on unmount', async () => {
    const { result, unmount } = renderHook(() => useLucidGuidedRitualSound(true));
    await act(async () => {
      await result.current.playTransition();
    });
    mockPlayer.pause.mockClear();
    mockPlayer.seekTo.mockClear();

    await act(async () => {
      unmount();
      await Promise.resolve();
    });

    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
  });

  it('notifies once when native playback is interrupted after it was actually heard', async () => {
    const onUnexpectedInterruption = jest.fn();
    const { result, rerender } = renderHook(
      ({ enabled, onUnexpectedInterruption: onInterrupt }) =>
        useLucidGuidedRitualSound(enabled, onInterrupt),
      { initialProps: { enabled: true, onUnexpectedInterruption } }
    );

    await act(async () => {
      await result.current.playTransition();
    });

    mockStatus.playing = true;
    await act(async () => {
      rerender({ enabled: true, onUnexpectedInterruption });
    });

    mockStatus.playing = false;
    mockStatus.didJustFinish = false;
    mockPlayer.pause.mockClear();
    mockPlayer.seekTo.mockClear();
    await act(async () => {
      rerender({ enabled: true, onUnexpectedInterruption });
    });

    expect(onUnexpectedInterruption).toHaveBeenCalledTimes(1);
    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);

    mockStatus.mediaServicesDidReset = true;
    await act(async () => {
      rerender({ enabled: true, onUnexpectedInterruption });
    });
    expect(onUnexpectedInterruption).toHaveBeenCalledTimes(1);
  });

  it('notifies once when media services reset after expected playback', async () => {
    const onUnexpectedInterruption = jest.fn();
    const { result, rerender } = renderHook(
      ({ enabled, onUnexpectedInterruption: onInterrupt }) =>
        useLucidGuidedRitualSound(enabled, onInterrupt),
      { initialProps: { enabled: true, onUnexpectedInterruption } }
    );

    await act(async () => {
      await result.current.playTransition();
    });

    mockStatus.playing = true;
    await act(async () => {
      rerender({ enabled: true, onUnexpectedInterruption });
    });

    mockStatus.mediaServicesDidReset = true;
    mockStatus.playing = false;
    mockPlayer.pause.mockClear();
    mockPlayer.seekTo.mockClear();
    await act(async () => {
      rerender({ enabled: true, onUnexpectedInterruption });
    });

    expect(onUnexpectedInterruption).toHaveBeenCalledTimes(1);
    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
  });

  it('does not treat a controlled stop, natural finish, or disabled cue as an interruption', async () => {
    const onUnexpectedInterruption = jest.fn();
    const { result, rerender, unmount } = renderHook(
      ({ enabled, onUnexpectedInterruption: onInterrupt }) =>
        useLucidGuidedRitualSound(enabled, onInterrupt),
      { initialProps: { enabled: true, onUnexpectedInterruption } }
    );

    await act(async () => {
      await result.current.playTransition();
    });
    mockStatus.playing = true;
    await act(async () => {
      rerender({ enabled: true, onUnexpectedInterruption });
    });
    await act(async () => {
      await result.current.stop();
    });
    mockStatus.playing = false;
    await act(async () => {
      rerender({ enabled: true, onUnexpectedInterruption });
    });
    expect(onUnexpectedInterruption).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.playTransition();
    });
    mockStatus.playing = true;
    await act(async () => {
      rerender({ enabled: true, onUnexpectedInterruption });
    });
    await act(async () => {
      jest.advanceTimersByTime(LUCID_GUIDED_RITUAL_SOUND_DURATION_MS);
      await Promise.resolve();
    });
    mockStatus.playing = false;
    mockStatus.didJustFinish = true;
    await act(async () => {
      rerender({ enabled: true, onUnexpectedInterruption });
    });
    expect(onUnexpectedInterruption).not.toHaveBeenCalled();

    mockStatus.didJustFinish = false;
    await act(async () => {
      await result.current.playTransition();
    });
    mockStatus.playing = true;
    await act(async () => {
      rerender({ enabled: true, onUnexpectedInterruption });
    });
    await act(async () => {
      rerender({ enabled: false, onUnexpectedInterruption });
    });
    mockStatus.playing = false;
    await act(async () => {
      rerender({ enabled: false, onUnexpectedInterruption });
    });
    expect(onUnexpectedInterruption).not.toHaveBeenCalled();

    await act(async () => {
      unmount();
      await Promise.resolve();
    });
    expect(onUnexpectedInterruption).not.toHaveBeenCalled();
  });

  it('does not notify when playback never started or the player is unloaded', async () => {
    const onUnexpectedInterruption = jest.fn();
    const { result, rerender } = renderHook(
      ({ enabled, onUnexpectedInterruption: onInterrupt }) =>
        useLucidGuidedRitualSound(enabled, onInterrupt),
      { initialProps: { enabled: true, onUnexpectedInterruption } }
    );

    mockStatus.playing = false;
    mockStatus.mediaServicesDidReset = true;
    await act(async () => {
      rerender({ enabled: true, onUnexpectedInterruption });
    });
    expect(onUnexpectedInterruption).not.toHaveBeenCalled();

    mockStatus.mediaServicesDidReset = false;
    mockStatus.isLoaded = false;
    await act(async () => {
      await expect(result.current.playTransition()).resolves.toBe(false);
    });
    mockStatus.playing = false;
    mockStatus.mediaServicesDidReset = true;
    await act(async () => {
      rerender({ enabled: true, onUnexpectedInterruption });
    });
    expect(onUnexpectedInterruption).not.toHaveBeenCalled();
  });
});
