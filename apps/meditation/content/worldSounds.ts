import type { AudioSource } from 'expo-audio';

import type { WorldId } from '@/constants/worlds';

export type WorldSoundAssetId = 'rain' | 'ocean' | 'brown-noise';

export type WorldSoundLayer = {
  assetId: WorldSoundAssetId;
  source: AudioSource;
  volume: number;
  rate: number;
};

export type WorldSoundProfile = {
  primary: WorldSoundLayer;
  secondary: WorldSoundLayer | null;
  cue: AudioSource | null;
  cueVolume: number;
};

/** Every bundled ambience loop is five minutes long. */
export const WORLD_SOUND_TRACK_DURATION_SEC = 300;

const SOUND_SOURCE_BY_ID: Record<WorldSoundAssetId, AudioSource> = {
  rain: require('@/assets/audio/ambience/rain.m4a'),
  ocean: require('@/assets/audio/ambience/ocean.m4a'),
  'brown-noise': require('@/assets/audio/ambience/brown-noise.m4a'),
};

const FIRST_BREATH = require('@/assets/audio/ui/first-breath.m4a');

const layer = (
  assetId: WorldSoundAssetId,
  volume: number,
  rate = 1
): WorldSoundLayer => ({
  assetId,
  source: SOUND_SOURCE_BY_ID[assetId],
  volume,
  rate,
});

/**
 * The six worlds share a tiny local sound library but never the same treatment.
 * Rates and levels are restrained on purpose: sound supports the breath rather
 * than becoming another instruction to follow.
 */
export const WORLD_SOUND_BY_ID: Record<WorldId, WorldSoundProfile> = {
  constellation: {
    primary: layer('brown-noise', 0.2),
    secondary: null,
    cue: FIRST_BREATH,
    cueVolume: 0.22,
  },
  dawn: {
    primary: layer('ocean', 0.16, 1.06),
    secondary: null,
    cue: FIRST_BREATH,
    cueVolume: 0.3,
  },
  forest: {
    primary: layer('rain', 0.26),
    secondary: layer('brown-noise', 0.11, 0.92),
    cue: null,
    cueVolume: 0,
  },
  tide: {
    primary: layer('ocean', 0.3, 0.88),
    secondary: null,
    cue: null,
    cueVolume: 0,
  },
  sanctuary: {
    primary: layer('brown-noise', 0.26, 0.92),
    secondary: layer('rain', 0.07),
    cue: null,
    cueVolume: 0,
  },
  cloud: {
    primary: layer('brown-noise', 0.1, 1.08),
    secondary: null,
    cue: FIRST_BREATH,
    cueVolume: 0.2,
  },
};
