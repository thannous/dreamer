import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import { PlayerProvider, usePlayer } from '@/context/PlayerContext';
import * as audio from '@/services/audioService';

const mockRecordProgress = jest.fn().mockResolvedValue(undefined);
const mockRecordPractice = jest.fn().mockResolvedValue(undefined);
const mockReplace = jest.fn();
let playbackListener: ((status: Record<string, unknown>) => void) | null = null;

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

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
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn().mockResolvedValue(undefined),
  setRate: jest.fn(),
  setVolume: jest.fn(),
  setLoop: jest.fn(),
  release: jest.fn(),
}));

describe('PlayerContext world continuity', () => {
  beforeEach(() => {
    playbackListener = null;
    mockRecordProgress.mockClear();
    mockRecordPractice.mockClear();
    mockReplace.mockClear();
    jest.clearAllMocks();
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
    expect(audio.createSessionPlayer).toHaveBeenCalledWith(expect.anything(), 600, 300);
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

});
