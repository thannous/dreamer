import type { AudioSource, AudioStatus } from 'expo-audio';

import { isAudioMockModeEnabled } from '@/lib/env';

import * as mock from './mocks/audioServiceMock';
import * as real from './audioServiceReal';

/**
 * Conditional export, resolved at bundle time — the Noctalia convention.
 * Always import this module; never `audioServiceReal` or the mock directly.
 */
const implementation = isAudioMockModeEnabled() ? mock : real;

export type PlaybackStatusSubscription = { remove(): void };
export type PlaybackStatusListener = (status: AudioStatus) => void;

/** The player surface consumed by PlayerContext, shared by native and mock audio. */
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
  addListener(
    eventName: 'playbackStatusUpdate',
    listener: PlaybackStatusListener
  ): PlaybackStatusSubscription;
  remove(): void;
};

export const configureAudioSession = implementation.configureAudioSession;
export const resolvePlayableSource = (
  source: AudioSource
): Promise<AudioSource> => implementation.resolvePlayableSource(source);
export const createPlayer = (source: AudioSource, updateIntervalMs = 500): PlayerHandle =>
  implementation.createPlayer(source, updateIntervalMs);
export const createSessionPlayer = (
  source: AudioSource,
  durationSec: number,
  trackDurationSec: number,
  updateIntervalMs = 500
): PlayerHandle =>
  implementation.createSessionPlayer(
    source,
    durationSec,
    trackDurationSec,
    updateIntervalMs
  );

/**
 * Bundled interface cues stay audible in mock mode. Mock mode replaces remote
 * meditation content and its clock; it must not silently remove tactile UI
 * feedback that is being reviewed on a real device.
 */
export const configureLocalCueSession = real.configureAudioSession;
export const createLocalCuePlayer = (
  source: AudioSource,
  updateIntervalMs = 1000
): PlayerHandle => real.createPlayer(source, updateIntervalMs);
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
