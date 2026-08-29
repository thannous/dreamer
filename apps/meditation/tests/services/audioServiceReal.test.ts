import { createAudioPlayer } from 'expo-audio';
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

const statusAt = (currentTime: number, extras: Record<string, unknown> = {}) => ({
  id: 'player',
  currentTime,
  duration: 300,
  playing: true,
  isBuffering: false,
  isLoaded: true,
  playbackRate: 1,
  mute: false,
  volume: 1,
  loop: true,
  didJustFinish: false,
  playbackState: 'playing' as const,
  timeControlStatus: 'playing' as const,
  reasonForWaitingToPlay: '',
  shouldCorrectPitch: true,
  isLive: false,
  currentOffsetFromLive: null,
  error: null,
  ...extras,
});

describe('audioServiceReal session timeline', () => {
  let nativeListener: ((status: ReturnType<typeof statusAt>) => void) | null;
  let nativePlayer: {
    currentTime: number;
    duration: number;
    playing: boolean;
    volume: number;
    loop: boolean;
    play: jest.Mock;
    pause: jest.Mock;
    seekTo: jest.Mock;
    setPlaybackRate: jest.Mock;
    addListener: jest.Mock;
    remove: jest.Mock;
    setActiveForLockScreen: jest.Mock;
    clearLockScreenControls: jest.Mock;
    updateLockScreenMetadata: jest.Mock;
  };

  beforeEach(() => {
    nativeListener = null;
    nativePlayer = {
      currentTime: 0,
      duration: 300,
      playing: false,
      volume: 1,
      loop: false,
      play: jest.fn(() => {
        nativePlayer.playing = true;
      }),
      pause: jest.fn(() => {
        nativePlayer.playing = false;
      }),
      seekTo: jest.fn(async (seconds: number) => {
        nativePlayer.currentTime = seconds;
      }),
      setPlaybackRate: jest.fn(),
      addListener: jest.fn((_eventName, listener) => {
        nativeListener = listener;
        return { remove: jest.fn() };
      }),
      remove: jest.fn(),
      setActiveForLockScreen: jest.fn(),
      clearLockScreenControls: jest.fn(),
      updateLockScreenMetadata: jest.fn(),
    };
    jest.mocked(createAudioPlayer).mockReturnValue(nativePlayer as never);
  });

  it('ends a three-minute session without waiting for the five-minute source', () => {
    const player = createSessionPlayer(1, 180, 300);
    const listener = jest.fn();
    player.addListener('playbackStatusUpdate', listener);

    nativeListener?.(statusAt(179));
    nativeListener?.(statusAt(180));

    expect(listener).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ currentTime: 179, playing: true, didJustFinish: false })
    );
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentTime: 180, duration: 180, playing: false, didJustFinish: true })
    );
    expect(nativePlayer.pause).toHaveBeenCalledTimes(1);
    expect(nativePlayer.loop).toBe(false);
    expect(nativePlayer.setActiveForLockScreen).toHaveBeenCalledWith(false);
    expect(nativePlayer.clearLockScreenControls).toHaveBeenCalled();
    expect(
      nativePlayer.setActiveForLockScreen.mock.invocationCallOrder.at(-1)!
    ).toBeLessThan(nativePlayer.clearLockScreenControls.mock.invocationCallOrder[0]!);
  });

  it('deactivates lock-screen controls before native remove when seeking to the session end', async () => {
    const player = createSessionPlayer(1, 180, 300, 500, {
      title: 'Traverser l\'orage',
      artist: 'Noctalia Meditation',
    });

    await player.seekTo(180);

    expect(nativePlayer.pause).toHaveBeenCalledTimes(1);
    expect(nativePlayer.loop).toBe(false);
    expect(nativePlayer.setActiveForLockScreen).toHaveBeenCalledWith(false);
    expect(nativePlayer.clearLockScreenControls).toHaveBeenCalled();
    expect(nativePlayer.remove).not.toHaveBeenCalled();
    expect(
      nativePlayer.setActiveForLockScreen.mock.invocationCallOrder.at(-1)!
    ).toBeLessThan(nativePlayer.clearLockScreenControls.mock.invocationCallOrder[0]!);
  });

  it('maps seeking across repeated five-minute tracks', async () => {
    const player = createSessionPlayer(1, 600, 300);

    await player.seekTo(450);

    expect(createAudioPlayer).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ keepAudioSessionActive: true })
    );
    expect(nativePlayer.seekTo).toHaveBeenCalledWith(150);
    expect(player.currentTime).toBe(450);
  });

  it('keeps a session looping until its advertised duration without saturating the clock', () => {
    const player = createSessionPlayer(1, 600, 300);
    const listener = jest.fn();
    player.addListener('playbackStatusUpdate', listener);

    nativeListener?.(statusAt(299));
    nativeListener?.(statusAt(0.4, { duration: 300 }));

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        currentTime: 299,
        duration: 600,
        playing: true,
        didJustFinish: false,
        loop: false,
      })
    );
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        currentTime: 300.4,
        duration: 600,
        playing: true,
        didJustFinish: false,
      })
    );
    expect(nativePlayer.pause).not.toHaveBeenCalled();
  });

  it('surfaces a native load error instead of swallowing it', () => {
    const player = createSessionPlayer(1, 180, 300);
    const listener = jest.fn();
    player.addListener('playbackStatusUpdate', listener);

    nativeListener?.({
      ...statusAt(0),
      playing: false,
      isLoaded: false,
      error: 'Source error',
    } as never);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Source error', playing: false, didJustFinish: false })
    );
  });

  it('freezes the virtual clock across a native lock-screen pause', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-26T12:00:00.000Z'));
    const player = createSessionPlayer(1, 600, 300);
    const listener = jest.fn();
    player.addListener('playbackStatusUpdate', listener);

    player.play();
    nativeListener?.(statusAt(12));
    expect(player.currentTime).toBe(12);

    jest.advanceTimersByTime(8_000);
    nativeListener?.(statusAt(20));
    expect(player.currentTime).toBe(20);

    nativeListener?.(statusAt(20, { playing: false, playbackState: 'paused', timeControlStatus: 'paused' }));
    expect(player.currentTime).toBe(20);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentTime: 20, playing: false, didJustFinish: false })
    );

    jest.advanceTimersByTime(45_000);
    expect(player.currentTime).toBe(20);
    nativeListener?.(statusAt(20, { playing: false, playbackState: 'paused', timeControlStatus: 'paused' }));
    expect(player.currentTime).toBe(20);

    nativeListener?.(statusAt(20.2));
    expect(player.currentTime).toBe(20.2);
    jest.advanceTimersByTime(5_000);
    nativeListener?.(statusAt(25.2));
    expect(player.currentTime).toBe(25.2);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentTime: 25.2, playing: true, didJustFinish: false })
    );
    jest.useRealTimers();
  });

  it('freezes currentTime from the native player when paused without a callback', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-28T16:00:00.000Z'));
    const player = createSessionPlayer(1, 600, 300);
    player.addListener('playbackStatusUpdate', jest.fn());

    player.play();
    nativeListener?.(statusAt(83.916));
    expect(player.currentTime).toBe(83.916);
    expect(player.playing).toBe(true);

    nativePlayer.playing = false;
    nativePlayer.currentTime = 83.916;
    jest.advanceTimersByTime(45_000);

    expect(player.playing).toBe(false);
    expect(player.currentTime).toBe(83.916);
    jest.useRealTimers();
  });

  it('does not turn an interruption-time native reset into a full source loop', () => {
    const player = createSessionPlayer(1, 600, 300);
    player.addListener('playbackStatusUpdate', jest.fn());

    player.play();
    nativeListener?.(statusAt(37.367));
    expect(player.currentTime).toBe(37.367);

    nativePlayer.playing = false;
    nativePlayer.currentTime = 0;

    expect(player.currentTime).toBe(37.367);
  });

  it('refreshes lock-screen state once when Android auto-resumes after audio-focus loss', () => {
    const player = createSessionPlayer(1, 600, 300, 500, {
      title: 'Traverser l\'orage',
      artist: 'Noctalia Meditation',
      albumTitle: 'Marée profonde',
    });
    player.addListener('playbackStatusUpdate', jest.fn());
    player.play();

    const activationCount = nativePlayer.setActiveForLockScreen.mock.calls.length;

    nativePlayer.playing = false;
    nativeListener?.(
      statusAt(48.279, {
        playing: false,
        playbackState: 'paused',
        timeControlStatus: 'paused',
      })
    );
    expect(nativePlayer.setActiveForLockScreen).toHaveBeenCalledTimes(activationCount);

    nativePlayer.playing = true;
    nativeListener?.(statusAt(48.3));

    expect(nativePlayer.setActiveForLockScreen).toHaveBeenCalledTimes(activationCount + 1);
    expect(nativePlayer.setActiveForLockScreen).toHaveBeenLastCalledWith(
      true,
      {
        title: 'Traverser l\'orage',
        artist: 'Noctalia Meditation',
        albumTitle: 'Marée profonde',
      },
      {
        showSeekForward: false,
        showSeekBackward: false,
        isLiveStream: true,
      }
    );

    nativeListener?.(statusAt(49));
    expect(nativePlayer.setActiveForLockScreen).toHaveBeenCalledTimes(activationCount + 1);
  });

  it('activates live lock-screen controls and clears them on release', () => {
    const player = createSessionPlayer(1, 600, 300, 500, {
      title: 'Bringing the breath down',
      artist: 'Noctalia Meditation',
      albumTitle: 'Constellation',
    });

    expect(nativePlayer.loop).toBe(true);
    expect(nativePlayer.setActiveForLockScreen).toHaveBeenCalledWith(
      true,
      {
        title: 'Bringing the breath down',
        artist: 'Noctalia Meditation',
        albumTitle: 'Constellation',
      },
      {
        showSeekForward: false,
        showSeekBackward: false,
        isLiveStream: true,
      }
    );

    player.remove();
    expect(nativePlayer.setActiveForLockScreen).toHaveBeenCalledWith(false);
    expect(nativePlayer.clearLockScreenControls).toHaveBeenCalled();
    expect(nativePlayer.remove).toHaveBeenCalled();
    expect(
      nativePlayer.setActiveForLockScreen.mock.invocationCallOrder.at(-1)!
    ).toBeLessThan(nativePlayer.clearLockScreenControls.mock.invocationCallOrder[0]!);
    expect(nativePlayer.clearLockScreenControls.mock.invocationCallOrder[0]!).toBeLessThan(
      nativePlayer.remove.mock.invocationCallOrder[0]!
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
