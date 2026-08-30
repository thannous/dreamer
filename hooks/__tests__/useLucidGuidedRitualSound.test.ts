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
  isLoaded: true,
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
    mockStatus.isLoaded = true;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stays silent when the optional cue is disabled', async () => {
    const { result } = renderHook(() => useLucidGuidedRitualSound(false));

    await act(async () => {
      await expect(result.current.playTransition()).resolves.toBe(false);
    });

    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(setAudioModeAsync).not.toHaveBeenCalled();
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
});
