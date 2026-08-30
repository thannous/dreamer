/* @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { AppState, type AppStateStatus } from 'react-native';

import { useLucidMorningVoicePlayer } from '@/hooks/useLucidMorningVoicePlayer';
import {
  createLucidMorningVoiceNote,
  type LucidMorningVoiceNote,
} from '@/lib/lucid/morningVoiceNote';

const NOW = Date.UTC(2026, 7, 28, 7, 15, 0);

const mockPlayer = {
  loop: true,
  pause: jest.fn(),
  play: jest.fn(),
  seekTo: jest.fn().mockResolvedValue(undefined),
  setActiveForLockScreen: jest.fn(),
  clearLockScreenControls: jest.fn(),
  volume: 1,
};

const mockStatus = {
  currentTime: 0,
  didJustFinish: false,
  duration: 4.8,
  isBuffering: false,
  isLoaded: true,
  playing: false,
};

let appStateListener: ((state: AppStateStatus) => void) | undefined;
let removeSubscription: jest.Mock;

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  useAudioPlayer: jest.fn(() => mockPlayer),
  useAudioPlayerStatus: jest.fn(() => mockStatus),
}));

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
  },
}));

function validNote(overrides: Partial<LucidMorningVoiceNote> = {}): LucidMorningVoiceNote {
  return createLucidMorningVoiceNote({
    id: 'mvn_morning_play01',
    userScope: 'guest',
    status: 'ready',
    title: 'Morning voice note',
    transcript: null,
    durationMs: 4_800,
    mimeType: 'audio/mp4',
    extension: '.m4a',
    uri: 'file:///data/user/0/app/files/lucid/morning-voice/mvn_morning_play01.m4a',
    createdAt: NOW,
    updatedAt: NOW,
    recoverable: false,
    now: NOW,
    ...overrides,
  });
}

const FOREGROUND_AUDIO_MODE = {
  allowsRecording: false,
  playsInSilentMode: true,
  interruptionMode: 'doNotMix',
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false,
};

const PLAYER_OPTIONS = {
  downloadFirst: false,
  updateInterval: 500,
};

describe('useLucidMorningVoicePlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayer.loop = true;
    mockPlayer.volume = 1;
    mockPlayer.pause.mockReset();
    mockPlayer.play.mockReset();
    mockPlayer.seekTo.mockReset();
    mockPlayer.seekTo.mockResolvedValue(undefined);
    mockPlayer.setActiveForLockScreen.mockReset();
    mockPlayer.clearLockScreenControls.mockReset();
    mockStatus.currentTime = 0;
    mockStatus.didJustFinish = false;
    mockStatus.duration = 4.8;
    mockStatus.isBuffering = false;
    mockStatus.isLoaded = true;
    mockStatus.playing = false;
    jest.mocked(setAudioModeAsync).mockResolvedValue(undefined);
    removeSubscription = jest.fn();
    appStateListener = undefined;
    jest.mocked(AppState.addEventListener).mockImplementation((_event, listener) => {
      appStateListener = listener as (state: AppStateStatus) => void;
      return { remove: removeSubscription };
    });
  });

  it('is a no-op for a null note and never loads a source', async () => {
    const { result } = renderHook(() => useLucidMorningVoicePlayer(null));

    expect(useAudioPlayer).toHaveBeenCalledWith(null, PLAYER_OPTIONS);
    expect(result.current.isLoaded).toBe(false);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isBuffering).toBe(false);
    expect(result.current.currentTimeSeconds).toBe(0);
    expect(result.current.durationSeconds).toBe(0);
    expect(result.current.error).toBeNull();

    await act(async () => {
      await result.current.play();
      await result.current.pause();
      await result.current.replay();
      await result.current.stop();
    });

    expect(setAudioModeAsync).not.toHaveBeenCalled();
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(mockPlayer.pause).not.toHaveBeenCalled();
    expect(mockPlayer.seekTo).not.toHaveBeenCalled();
    expect(mockPlayer.setActiveForLockScreen).not.toHaveBeenCalled();
  });

  it('passes only a validated local URI with downloadFirst false', async () => {
    const note = validNote();
    const { result } = renderHook(() => useLucidMorningVoicePlayer(note));

    expect(useAudioPlayer).toHaveBeenCalledWith(note.uri, PLAYER_OPTIONS);
    expect(result.current.isLoaded).toBe(true);
    expect(result.current.durationSeconds).toBe(4.8);
    expect(result.current.error).toBeNull();

    await act(async () => {
      await result.current.play();
    });

    expect(setAudioModeAsync).toHaveBeenCalledWith(FOREGROUND_AUDIO_MODE);
    expect(mockPlayer.loop).toBe(false);
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.seekTo).not.toHaveBeenCalled();
    expect(mockPlayer.setActiveForLockScreen).not.toHaveBeenCalled();
    expect(mockPlayer.clearLockScreenControls).not.toHaveBeenCalled();
  });

  it('pauses, always replays from 0, and stops with pause plus seek 0', async () => {
    const { result } = renderHook(() => useLucidMorningVoicePlayer(validNote()));

    await act(async () => {
      await result.current.play();
    });
    await act(async () => {
      await result.current.pause();
    });
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.replay();
    });
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayer.play).toHaveBeenCalledTimes(2);

    mockPlayer.pause.mockClear();
    mockPlayer.seekTo.mockClear();
    await act(async () => {
      await result.current.stop();
    });
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
  });

  it('restarts from 0 after didJustFinish or native end', async () => {
    const { result } = renderHook(() => useLucidMorningVoicePlayer(validNote()));

    await act(async () => {
      await result.current.play();
    });
    expect(mockPlayer.seekTo).not.toHaveBeenCalled();

    mockStatus.didJustFinish = true;
    mockStatus.playing = false;
    mockStatus.currentTime = 4.8;

    await act(async () => {
      await result.current.play();
    });
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayer.play).toHaveBeenCalledTimes(2);

    mockPlayer.seekTo.mockClear();
    mockStatus.didJustFinish = false;
    mockStatus.currentTime = 4.8;
    mockStatus.duration = 4.8;

    await act(async () => {
      await result.current.play();
    });
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
  });

  it('pauses on inactive or background and on unmount, and tolerates a released player', async () => {
    const { result, unmount } = renderHook(() => useLucidMorningVoicePlayer(validNote()));

    await act(async () => {
      await result.current.play();
    });

    mockPlayer.pause.mockClear();
    act(() => {
      appStateListener?.('inactive');
    });
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);

    mockPlayer.pause.mockClear();
    act(() => {
      appStateListener?.('background');
    });
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);

    mockPlayer.pause.mockImplementationOnce(() => {
      throw new Error('Cannot use shared object that was already released');
    });
    mockPlayer.seekTo.mockRejectedValueOnce(
      new Error('Cannot use shared object that was already released'),
    );

    expect(() => {
      unmount();
    }).not.toThrow();
    expect(removeSubscription).toHaveBeenCalledTimes(1);
    expect(mockPlayer.setActiveForLockScreen).not.toHaveBeenCalled();
  });

  it('does not pause or seek on background or unmount when the note is null', () => {
    const { unmount } = renderHook(() => useLucidMorningVoicePlayer(null));

    act(() => {
      appStateListener?.('inactive');
      appStateListener?.('background');
    });
    unmount();

    expect(appStateListener).toBeUndefined();
    expect(mockPlayer.pause).not.toHaveBeenCalled();
    expect(mockPlayer.seekTo).not.toHaveBeenCalled();
    expect(removeSubscription).not.toHaveBeenCalled();
  });

  it('maps user pause and stop native failures to playback_failed without throwing', async () => {
    const { result } = renderHook(() => useLucidMorningVoicePlayer(validNote()));

    mockPlayer.pause.mockImplementationOnce(() => {
      throw new Error('pause released');
    });
    await act(async () => {
      await expect(result.current.pause()).resolves.toBeUndefined();
    });
    expect(result.current.error).toBe('playback_failed');

    mockPlayer.pause.mockReset();
    mockPlayer.seekTo.mockRejectedValueOnce(new Error('stop seek failed'));
    await act(async () => {
      await expect(result.current.stop()).resolves.toBeUndefined();
    });
    expect(result.current.error).toBe('playback_failed');
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  it('stops the previous note and clears a stale playback error when switching notes or null', async () => {
    jest.mocked(setAudioModeAsync).mockRejectedValueOnce(new Error('audio unavailable'));
    const first = validNote();
    const second = validNote({
      id: 'mvn_morning_play02',
      uri: 'file:///data/user/0/app/files/lucid/morning-voice/mvn_morning_play02.m4a',
    });
    const { result, rerender } = renderHook(
      ({ note }: { note: LucidMorningVoiceNote | null }) => useLucidMorningVoicePlayer(note),
      { initialProps: { note: first as LucidMorningVoiceNote | null } },
    );

    await act(async () => {
      await result.current.play();
    });
    expect(result.current.error).toBe('playback_failed');
    expect(mockPlayer.play).not.toHaveBeenCalled();

    mockPlayer.pause.mockClear();
    mockPlayer.seekTo.mockClear();
    await act(async () => {
      rerender({ note: second });
    });

    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(result.current.error).toBeNull();
    expect(useAudioPlayer).toHaveBeenLastCalledWith(second.uri, PLAYER_OPTIONS);

    mockPlayer.pause.mockClear();
    mockPlayer.seekTo.mockClear();
    await act(async () => {
      rerender({ note: null as LucidMorningVoiceNote | null });
    });
    expect(useAudioPlayer).toHaveBeenLastCalledWith(null, PLAYER_OPTIONS);
    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoaded).toBe(false);
  });

  it('rejects remote and invalid notes without loading a source', async () => {
    const remote = {
      ...validNote(),
      uri: 'https://cdn.example.com/voice.m4a',
    } as LucidMorningVoiceNote;
    const { result, rerender } = renderHook(
      ({ note }: { note: LucidMorningVoiceNote | null }) => useLucidMorningVoicePlayer(note),
      { initialProps: { note: remote } },
    );

    expect(useAudioPlayer).toHaveBeenCalledWith(null, PLAYER_OPTIONS);
    expect(result.current.error).toBe('invalid_uri');
    expect(result.current.isLoaded).toBe(false);

    await act(async () => {
      await result.current.play();
    });
    expect(setAudioModeAsync).not.toHaveBeenCalled();
    expect(mockPlayer.play).not.toHaveBeenCalled();

    const invalidLocal = {
      ...validNote(),
      title: '',
    } as LucidMorningVoiceNote;
    await act(async () => {
      rerender({ note: invalidLocal });
    });
    expect(useAudioPlayer).toHaveBeenLastCalledWith(null, PLAYER_OPTIONS);
    expect(result.current.error).toBe('invalid_metadata');

    const http = {
      ...validNote(),
      uri: 'http://example.com/voice.m4a',
    } as LucidMorningVoiceNote;
    await act(async () => {
      rerender({ note: http });
    });
    expect(result.current.error).toBe('invalid_uri');
    expect(useAudioPlayer).toHaveBeenLastCalledWith(null, PLAYER_OPTIONS);
  });

  it('surfaces native playback failures and never enables lockscreen or network download', async () => {
    const note = validNote();
    const { result } = renderHook(() => useLucidMorningVoicePlayer(note));

    jest.mocked(setAudioModeAsync).mockRejectedValueOnce(new Error('native failure'));
    await act(async () => {
      await result.current.play();
    });
    expect(result.current.error).toBe('playback_failed');
    expect(mockPlayer.play).not.toHaveBeenCalled();

    jest.mocked(setAudioModeAsync).mockResolvedValue(undefined);
    mockPlayer.seekTo.mockRejectedValueOnce(new Error('seek failed'));
    await act(async () => {
      await result.current.replay();
    });
    expect(result.current.error).toBe('playback_failed');

    expect(useAudioPlayer).toHaveBeenCalledWith(note.uri, PLAYER_OPTIONS);
    expect(setAudioModeAsync).toHaveBeenCalledWith(FOREGROUND_AUDIO_MODE);
    expect(mockPlayer.setActiveForLockScreen).not.toHaveBeenCalled();
    expect(mockPlayer.clearLockScreenControls).not.toHaveBeenCalled();
    expect(JSON.stringify(jest.mocked(useAudioPlayer).mock.calls)).not.toMatch(
      /https?:|downloadFirst.:true|headers/i,
    );
    expect(JSON.stringify(FOREGROUND_AUDIO_MODE)).not.toMatch(/shouldPlayInBackground.:true/);
  });
});
