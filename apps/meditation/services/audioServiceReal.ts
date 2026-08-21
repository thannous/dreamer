import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from 'expo-audio';

/**
 * The only place `expo-audio` is touched. Everything above it talks to this
 * interface, which is what lets the mock stand in for E2E and for development
 * without any audio files.
 */
export type PlayerHandle = AudioPlayer;

/**
 * Set once, before anything plays.
 *
 * `shouldPlayInBackground` is the whole point of the app: a guided session that
 * stops when the screen locks is useless. `playsInSilentMode` matters just as
 * much — people put their phone on silent precisely when going to bed.
 */
export async function configureAudioSession(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
    shouldRouteThroughEarpiece: false,
  });
}

export function createPlayer(source: AudioSource, updateIntervalMs = 500): PlayerHandle {
  const player = createAudioPlayer(source, { updateInterval: updateIntervalMs });
  return player;
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
