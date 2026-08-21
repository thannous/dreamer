import type { AudioSource } from 'expo-audio';

/**
 * A player that advances a clock and nothing else.
 *
 * Used by the E2E suite and by development without audio files: the provider
 * above it cannot tell the difference, so the whole player UI — scrubber,
 * completion, fade timer — is exercised with no native module involved.
 */
export type PlayerHandle = {
  currentTime: number;
  duration: number;
  playing: boolean;
  volume: number;
  loop: boolean;
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  setPlaybackRate(rate: number): void;
  remove(): void;
};

const MOCK_DURATION_SEC = 300;

export async function configureAudioSession(): Promise<void> {}

export function createPlayer(_source: AudioSource, updateIntervalMs = 500): PlayerHandle {
  let timer: ReturnType<typeof setInterval> | null = null;
  let rate = 1;

  const handle: PlayerHandle = {
    currentTime: 0,
    duration: MOCK_DURATION_SEC,
    playing: false,
    volume: 1,
    loop: false,
    play() {
      if (timer) return;
      handle.playing = true;
      timer = setInterval(() => {
        handle.currentTime = Math.min(
          handle.duration,
          handle.currentTime + (updateIntervalMs / 1000) * rate
        );
        if (handle.currentTime >= handle.duration) handle.pause();
      }, updateIntervalMs);
    },
    pause() {
      handle.playing = false;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    async seekTo(seconds: number) {
      handle.currentTime = Math.min(Math.max(seconds, 0), handle.duration);
    },
    setPlaybackRate(next: number) {
      rate = next;
    },
    remove() {
      handle.pause();
    },
  };

  return handle;
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
