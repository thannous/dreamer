import { createAudioPlayer } from 'expo-audio';

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(),
}));
jest.mock('expo-asset', () => ({ Asset: {} }));
jest.mock('@/lib/env', () => ({ isAudioMockModeEnabled: jest.fn() }));

function loadFacade(mockMode: boolean) {
  let audio!: typeof import('@/services/audioService');
  jest.isolateModules(() => {
    jest.requireMock('@/lib/env').isAudioMockModeEnabled.mockReturnValue(mockMode);
    audio = jest.requireActual('@/services/audioService');
  });
  return audio;
}

function nativeHandle() {
  return {
    playing: true,
    loop: false,
    pause: jest.fn(),
    remove: jest.fn(),
    release: jest.fn(),
    setActiveForLockScreen: jest.fn(),
    clearLockScreenControls: jest.fn(),
  };
}

// Keep the actual adapter and mock implementation: these tests exercise the
// public boundary used by PlayerContext and useWorldSoundscape.
describe('audioService public resource lifetime', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it.each(['raw', 'session', 'cue'] as const)(
    'releases a real %s native handle through the public facade once',
    (kind) => {
      const audio = loadFacade(false);
      const native = nativeHandle();
      jest.mocked(createAudioPlayer).mockReturnValue(native as never);
      const player = kind === 'session'
        ? audio.createSessionPlayer(1, 600, 300)
        : kind === 'cue' ? audio.createLocalCuePlayer(1) : audio.createPlayer(1);
      audio.release(player);
      audio.release(player);
      expect(native.pause).toHaveBeenCalledTimes(1);
      expect(native.remove).toHaveBeenCalledTimes(1);
      expect(native.release).toHaveBeenCalledTimes(1);
      expect(native.pause.mock.invocationCallOrder[0]).toBeLessThan(
        native.remove.mock.invocationCallOrder[0]!
      );
      expect(native.remove.mock.invocationCallOrder[0]).toBeLessThan(
        native.release.mock.invocationCallOrder[0]!
      );
    }
  );

  it('releases real local cues even when content playback is mocked', () => {
    const audio = loadFacade(true);
    const native = nativeHandle();
    jest.mocked(createAudioPlayer).mockReturnValue(native as never);
    audio.release(audio.createLocalCuePlayer(1));
    expect(native.pause).toHaveBeenCalledTimes(1);
    expect(native.remove).toHaveBeenCalledTimes(1);
    expect(native.release).toHaveBeenCalledTimes(1);
  });

  it('preserves mock timer and listener cleanup without requiring native release', () => {
    jest.useFakeTimers();
    const audio = loadFacade(true);
    const player = audio.createPlayer(null);
    const listener = jest.fn();
    player.addListener('playbackStatusUpdate', listener);
    player.play();
    expect(jest.getTimerCount()).toBeGreaterThan(0);
    audio.release(player);
    audio.release(player);
    listener.mockClear();
    jest.advanceTimersByTime(1000);
    expect(jest.getTimerCount()).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });
});
