import type { AudioStatus } from 'expo-audio';

import { createPlayer, createSessionPlayer } from '@/services/mocks/audioServiceMock';

describe('audioServiceMock', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('implements the playbackStatusUpdate contract used by PlayerContext', () => {
    const player = createPlayer(null, 500);
    const listener = jest.fn<void, [AudioStatus]>();

    player.addListener('playbackStatusUpdate', listener);
    player.play();
    jest.advanceTimersByTime(500);

    expect(listener).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ currentTime: 0, duration: 300, playing: true })
    );
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentTime: 0.5, playing: true, didJustFinish: false })
    );
  });

  it('notifies listeners deterministically for seek, rate and pause', async () => {
    const player = createPlayer(null);
    const listener = jest.fn<void, [AudioStatus]>();

    player.addListener('playbackStatusUpdate', listener);
    await player.seekTo(42);
    player.setPlaybackRate(1.5);
    player.play();
    player.pause();

    expect(listener.mock.calls.map(([status]) => status)).toEqual([
      expect.objectContaining({ currentTime: 42, playing: false, playbackRate: 1 }),
      expect.objectContaining({ currentTime: 42, playing: false, playbackRate: 1.5 }),
      expect.objectContaining({ currentTime: 42, playing: true, playbackRate: 1.5 }),
      expect.objectContaining({ currentTime: 42, playing: false, playbackRate: 1.5 }),
    ]);
  });

  it('removes subscriptions and releases timers without retaining callbacks', () => {
    const player = createPlayer(null, 500);
    const listener = jest.fn<void, [AudioStatus]>();
    const subscription = player.addListener('playbackStatusUpdate', listener);

    player.play();
    expect(jest.getTimerCount()).toBe(1);

    subscription.remove();
    jest.advanceTimersByTime(500);
    expect(listener).toHaveBeenCalledTimes(1);

    player.remove();
    expect(jest.getTimerCount()).toBe(0);
    player.play();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('emits one completion update and stops its clock at the duration', () => {
    const player = createPlayer(null, 1_000);
    const listener = jest.fn<void, [AudioStatus]>();

    player.addListener('playbackStatusUpdate', listener);
    player.play();
    jest.advanceTimersByTime(300_000);

    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        currentTime: 300,
        playing: false,
        didJustFinish: true,
      })
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('uses the requested session duration instead of the five-minute loop length', () => {
    const player = createSessionPlayer(null, 1_200, 300, 1_000);
    const listener = jest.fn<void, [AudioStatus]>();

    player.addListener('playbackStatusUpdate', listener);
    player.play();
    jest.advanceTimersByTime(300_000);

    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        currentTime: 300,
        duration: 1_200,
        playing: true,
        didJustFinish: false,
      })
    );
  });
});
