import { createAudioPlayer } from 'expo-audio';

import {
  createLocalCuePlayer,
  createPlayer,
  createSessionPlayer,
  release,
  type PlayerHandle,
} from '@/services/audioService';

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  createAudioPlaylist: jest.fn(),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

function createNativePlayer() {
  const nativePlayer = {
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
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    remove: jest.fn(),
    release: jest.fn(),
    setActiveForLockScreen: jest.fn(),
    clearLockScreenControls: jest.fn(),
    updateLockScreenMetadata: jest.fn(),
  };
  return nativePlayer;
}

describe('audioService facade release', () => {
  let nativePlayer: ReturnType<typeof createNativePlayer>;

  beforeEach(() => {
    nativePlayer = createNativePlayer();
    jest.mocked(createAudioPlayer).mockReturnValue(nativePlayer as never);
  });

  it('pauses, removes, then releases a raw player once through the public boundary', () => {
    const player = createPlayer(1);
    nativePlayer.play();

    release(player);
    release(player);

    expect(nativePlayer.playing).toBe(false);
    expect(nativePlayer.pause).toHaveBeenCalledTimes(1);
    expect(nativePlayer.remove).toHaveBeenCalledTimes(1);
    expect(nativePlayer.release).toHaveBeenCalledTimes(1);
    expect(nativePlayer.pause.mock.invocationCallOrder[0]).toBeLessThan(
      nativePlayer.remove.mock.invocationCallOrder[0]!
    );
    expect(nativePlayer.remove.mock.invocationCallOrder[0]).toBeLessThan(
      nativePlayer.release.mock.invocationCallOrder[0]!
    );
  });

  it('releases a local cue player through the native helper once', () => {
    const player = createLocalCuePlayer(1);
    nativePlayer.play();

    release(player);
    release(player);

    expect(nativePlayer.pause).toHaveBeenCalledTimes(1);
    expect(nativePlayer.remove).toHaveBeenCalledTimes(1);
    expect(nativePlayer.release).toHaveBeenCalledTimes(1);
    expect(nativePlayer.pause.mock.invocationCallOrder[0]).toBeLessThan(
      nativePlayer.remove.mock.invocationCallOrder[0]!
    );
    expect(nativePlayer.remove.mock.invocationCallOrder[0]).toBeLessThan(
      nativePlayer.release.mock.invocationCallOrder[0]!
    );
  });

  it('only removes mock-only handles that have no native release', () => {
    const remove = jest.fn();
    const pause = jest.fn();
    const mockOnly: PlayerHandle = {
      currentTime: 0,
      duration: 1,
      playing: false,
      volume: 1,
      loop: false,
      play: jest.fn(),
      pause,
      seekTo: jest.fn(async () => {}),
      setPlaybackRate: jest.fn(),
      addListener: jest.fn(() => ({ remove: jest.fn() })),
      remove,
    };

    release(mockOnly);
    release(mockOnly);

    expect(remove).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();
  });

  it('keeps session adapter teardown once-only through the public release', () => {
    const player = createSessionPlayer(1, 600, 300);
    player.play();

    release(player);
    release(player);

    expect(nativePlayer.playing).toBe(false);
    expect(nativePlayer.pause).toHaveBeenCalledTimes(1);
    expect(nativePlayer.remove).toHaveBeenCalledTimes(1);
    expect(nativePlayer.release).toHaveBeenCalledTimes(1);
    expect(nativePlayer.pause.mock.invocationCallOrder[0]).toBeLessThan(
      nativePlayer.remove.mock.invocationCallOrder[0]!
    );
    expect(nativePlayer.remove.mock.invocationCallOrder[0]).toBeLessThan(
      nativePlayer.release.mock.invocationCallOrder[0]!
    );
  });
});
