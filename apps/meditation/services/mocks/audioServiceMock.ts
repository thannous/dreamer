import type { AudioSource, AudioStatus } from 'expo-audio';

import type {
  PlaybackStatusListener,
  PlaybackStatusSubscription,
  PlayerHandle,
} from '../audioService';

/**
 * A player that advances a clock and nothing else.
 *
 * Used by the E2E suite and by development without audio files: the provider
 * above it cannot tell the difference, so the whole player UI — scrubber,
 * completion, fade timer — is exercised with no native module involved.
 */
const MOCK_DURATION_SEC = 300;
let nextPlayerId = 1;

export async function configureAudioSession(): Promise<void> {}

export async function resolvePlayableSource(source: AudioSource): Promise<AudioSource> {
  if (source == null) {
    throw new Error('Audio source is missing');
  }
  return source;
}

function createMockPlayer(
  _source: AudioSource,
  durationSec: number,
  updateIntervalMs: number
): PlayerHandle {
  let timer: ReturnType<typeof setInterval> | null = null;
  let rate = 1;
  let released = false;
  const id = `mock-audio-player-${nextPlayerId++}`;
  const listeners = new Set<{ listener: PlaybackStatusListener }>();

  const stopClock = () => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  };

  const emitStatus = (didJustFinish = false) => {
    const status: AudioStatus = {
      id,
      currentTime: handle.currentTime,
      playbackState: handle.playing ? 'playing' : 'paused',
      timeControlStatus: handle.playing ? 'playing' : 'paused',
      reasonForWaitingToPlay: '',
      mute: false,
      duration: handle.duration,
      playing: handle.playing,
      loop: handle.loop,
      didJustFinish,
      isBuffering: false,
      isLoaded: true,
      playbackRate: rate,
      shouldCorrectPitch: true,
      isLive: false,
      currentOffsetFromLive: null,
      error: null,
    };

    [...listeners].forEach(({ listener }) => listener(status));
  };

  const handle: PlayerHandle = {
    currentTime: 0,
    duration: Math.max(1, durationSec),
    playing: false,
    volume: 1,
    loop: false,
    play() {
      if (released || timer) return;
      handle.playing = true;
      emitStatus();
      timer = setInterval(() => {
        const nextTime = handle.currentTime + (updateIntervalMs / 1000) * rate;
        if (nextTime < handle.duration) {
          handle.currentTime = nextTime;
          emitStatus();
          return;
        }

        if (handle.loop) {
          handle.currentTime = 0;
          emitStatus(true);
          return;
        }

        handle.currentTime = handle.duration;
        handle.playing = false;
        stopClock();
        emitStatus(true);
      }, updateIntervalMs);
    },
    pause() {
      if (released) return;
      handle.playing = false;
      stopClock();
      emitStatus();
    },
    async seekTo(seconds: number) {
      if (released) return;
      handle.currentTime = Math.min(Math.max(seconds, 0), handle.duration);
      emitStatus();
    },
    setPlaybackRate(next: number) {
      if (released) return;
      rate = next;
      emitStatus();
    },
    addListener(eventName, listener): PlaybackStatusSubscription {
      if (eventName !== 'playbackStatusUpdate' || released) return { remove() {} };

      const registration = { listener };
      listeners.add(registration);
      return {
        remove() {
          listeners.delete(registration);
        },
      };
    },
    remove() {
      if (released) return;
      released = true;
      handle.playing = false;
      stopClock();
      listeners.clear();
    },
  };

  return handle;
}

export function createPlayer(source: AudioSource, updateIntervalMs = 500): PlayerHandle {
  return createMockPlayer(source, MOCK_DURATION_SEC, updateIntervalMs);
}

export function createSessionPlayer(
  source: AudioSource,
  durationSec: number,
  _trackDurationSec: number,
  updateIntervalMs = 500
): PlayerHandle {
  return createMockPlayer(source, durationSec, updateIntervalMs);
}

export const play = (player: PlayerHandle): void => player.play();
export const pause = (player: PlayerHandle): void => player.pause();
export const seekTo = (player: PlayerHandle, seconds: number): Promise<void> =>
  player.seekTo(seconds);
export const setRate = (player: PlayerHandle, rate: number): void =>
  player.setPlaybackRate(rate);
export const setVolume = (player: PlayerHandle, volume: number): void => {
  player.volume = volume;
};
export const setLoop = (player: PlayerHandle, loop: boolean): void => {
  player.loop = loop;
};
export const release = (player: PlayerHandle): void => player.remove();
