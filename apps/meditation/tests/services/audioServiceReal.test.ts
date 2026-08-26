import { createAudioPlaylist } from 'expo-audio';
import { Asset } from 'expo-asset';

import { createSessionPlayer, resolvePlayableSource } from '@/services/audioServiceReal';

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  createAudioPlaylist: jest.fn(),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn(),
    fromURI: jest.fn(),
  },
}));

const statusAt = (currentTime: number, currentIndex = 0) => ({
  id: 'playlist',
  currentIndex,
  trackCount: 1,
  currentTime,
  duration: 300,
  playing: true,
  isBuffering: false,
  isLoaded: true,
  playbackRate: 1,
  muted: false,
  volume: 1,
  loop: 'none' as const,
  didJustFinish: false,
});

describe('audioServiceReal session timeline', () => {
  let playlistListener: ((status: ReturnType<typeof statusAt>) => void) | null;
  let playlist: {
    currentIndex: number;
    currentStatus: ReturnType<typeof statusAt>;
    playing: boolean;
    volume: number;
    loop: 'none' | 'all';
    playbackRate: number;
    play: jest.Mock;
    pause: jest.Mock;
    skipTo: jest.Mock;
    seekTo: jest.Mock;
    addListener: jest.Mock;
    destroy: jest.Mock;
  };

  beforeEach(() => {
    playlistListener = null;
    playlist = {
      currentIndex: 0,
      currentStatus: statusAt(0),
      playing: false,
      volume: 1,
      loop: 'none',
      playbackRate: 1,
      play: jest.fn(),
      pause: jest.fn(),
      skipTo: jest.fn((index: number) => {
        playlist.currentIndex = index;
      }),
      seekTo: jest.fn().mockResolvedValue(undefined),
      addListener: jest.fn((_eventName, listener) => {
        playlistListener = listener;
        return { remove: jest.fn() };
      }),
      destroy: jest.fn(),
    };
    jest.mocked(createAudioPlaylist).mockReturnValue(playlist as never);
  });

  it('ends a three-minute session without waiting for the five-minute source', () => {
    const player = createSessionPlayer(1, 180, 300);
    const listener = jest.fn();
    player.addListener('playbackStatusUpdate', listener);

    playlistListener?.(statusAt(179));
    playlistListener?.(statusAt(180));

    expect(listener).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ currentTime: 179, playing: true, didJustFinish: false })
    );
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentTime: 180, duration: 180, playing: false, didJustFinish: true })
    );
    expect(playlist.pause).toHaveBeenCalledTimes(1);
  });

  it('maps seeking across repeated five-minute tracks', async () => {
    const player = createSessionPlayer(1, 600, 300);

    await player.seekTo(450);

    expect(createAudioPlaylist).toHaveBeenCalledWith(
      expect.objectContaining({ sources: [1, 1], loop: 'none' })
    );
    expect(playlist.skipTo).toHaveBeenCalledWith(1);
    expect(playlist.seekTo).toHaveBeenCalledWith(150);
  });
  it('surfaces a playlist load error instead of swallowing it', () => {
    const player = createSessionPlayer(1, 180, 300);
    const listener = jest.fn();
    player.addListener('playbackStatusUpdate', listener);

    playlistListener?.({
      ...statusAt(0),
      playing: false,
      isLoaded: false,
      error: { message: 'Source error', code: 2000 },
    } as never);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Source error', playing: false, didJustFinish: false })
    );
  });

});

describe('audioServiceReal playable source cache', () => {
  beforeEach(() => {
    jest.mocked(Asset.fromModule).mockReset();
    jest.mocked(Asset.fromURI).mockReset();
  });

  it('returns a file URI after a successful download', async () => {
    const asset = {
      localUri: 'file:///cache/brown-noise.m4a',
      downloadAsync: jest.fn().mockResolvedValue(undefined),
    };
    jest.mocked(Asset.fromModule).mockReturnValue(asset as never);

    await expect(resolvePlayableSource(42)).resolves.toEqual({
      uri: 'file:///cache/brown-noise.m4a',
    });
    expect(asset.downloadAsync).toHaveBeenCalledTimes(1);
  });

  it('keeps object metadata and overwrites the URI with the cached file', async () => {
    const asset = {
      localUri: 'file:///cache/rain.m4a',
      downloadAsync: jest.fn().mockResolvedValue(undefined),
    };
    jest.mocked(Asset.fromURI).mockReturnValue(asset as never);

    await expect(
      resolvePlayableSource({ uri: 'http://localhost:8081/assets/rain.m4a', name: 'rain' })
    ).resolves.toEqual({
      uri: 'file:///cache/rain.m4a',
      name: 'rain',
    });
  });

  it('throws when the cached file URI is missing', async () => {
    const asset = {
      localUri: null,
      downloadAsync: jest.fn().mockResolvedValue(undefined),
    };
    jest.mocked(Asset.fromModule).mockReturnValue(asset as never);

    await expect(resolvePlayableSource(7)).rejects.toThrow('Audio source could not be cached');
  });

  it('throws when downloadAsync fails', async () => {
    const asset = {
      localUri: 'file:///cache/ocean.m4a',
      downloadAsync: jest.fn().mockRejectedValue(new Error('network down')),
    };
    jest.mocked(Asset.fromURI).mockReturnValue(asset as never);

    await expect(resolvePlayableSource('http://localhost:8081/ocean.m4a')).rejects.toThrow(
      'network down'
    );
  });
});
