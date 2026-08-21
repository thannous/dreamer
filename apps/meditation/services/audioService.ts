import { isMockModeEnabled } from '@/lib/env';

import * as mock from './mocks/audioServiceMock';
import * as real from './audioServiceReal';

/**
 * Conditional export, resolved at bundle time — the Noctalia convention.
 * Always import this module; never `audioServiceReal` or the mock directly.
 */
const implementation = isMockModeEnabled() ? mock : real;

export type PlayerHandle = real.PlayerHandle | mock.PlayerHandle;

export const configureAudioSession = implementation.configureAudioSession;
export const createPlayer = implementation.createPlayer as typeof real.createPlayer;
export const play = implementation.play as (player: PlayerHandle) => void;
export const pause = implementation.pause as (player: PlayerHandle) => void;
export const seekTo = implementation.seekTo as (player: PlayerHandle, s: number) => Promise<void>;
export const setRate = implementation.setRate as (player: PlayerHandle, r: number) => void;
export const setVolume = implementation.setVolume as (player: PlayerHandle, v: number) => void;
export const setLoop = implementation.setLoop as (player: PlayerHandle, l: boolean) => void;
export const release = implementation.release as (player: PlayerHandle) => void;
