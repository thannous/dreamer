import type { ImageSourcePropType } from 'react-native';

import { Atmosphere, NightTheme, PaperTheme } from '@/constants/theme';

export type WorldId = 'constellation' | 'dawn';

export type MeditationWorld = {
  id: WorldId;
  appearance: 'dark' | 'light';
  nameKey: `world.${WorldId}.name`;
  descriptionKey: `world.${WorldId}.description`;
  thumbnail: ImageSourcePropType;
  artwork: {
    journey: ImageSourcePropType;
    trainer: ImageSourcePropType;
    completion: ImageSourcePropType;
  };
  atmosphere: {
    /** Opaque colour laid over the artwork to protect text contrast. */
    scrimColor: string;
    scrimOpacity: number;
    /** Low-opacity world tint; glass remains a supporting texture above it. */
    overlayColor: string;
    overlayOpacity: number;
  };
};

const CONSTELLATION_ARTWORK = require('@/assets/worlds/constellation.webp');
const CONSTELLATION_THUMBNAIL = require('@/assets/worlds/constellation-thumbnail.webp');
const DAWN_ARTWORK = require('@/assets/worlds/dawn.webp');
const DAWN_THUMBNAIL = require('@/assets/worlds/dawn-thumbnail.webp');

export const WORLD_IDS = ['constellation', 'dawn'] as const satisfies readonly WorldId[];

export const WORLD_BY_ID = {
  constellation: {
    id: 'constellation',
    appearance: 'dark',
    nameKey: 'world.constellation.name',
    descriptionKey: 'world.constellation.description',
    thumbnail: CONSTELLATION_THUMBNAIL,
    artwork: {
      journey: CONSTELLATION_ARTWORK,
      trainer: CONSTELLATION_ARTWORK,
      completion: CONSTELLATION_ARTWORK,
    },
    atmosphere: {
      scrimColor: NightTheme.background,
      scrimOpacity: 0.48,
      overlayColor: Atmosphere.dark.glow,
      overlayOpacity: 0.12,
    },
  },
  dawn: {
    id: 'dawn',
    appearance: 'light',
    nameKey: 'world.dawn.name',
    descriptionKey: 'world.dawn.description',
    thumbnail: DAWN_THUMBNAIL,
    artwork: {
      journey: DAWN_ARTWORK,
      trainer: DAWN_ARTWORK,
      completion: DAWN_ARTWORK,
    },
    atmosphere: {
      scrimColor: PaperTheme.background,
      scrimOpacity: 0.22,
      overlayColor: Atmosphere.light.glow,
      overlayOpacity: 0.1,
    },
  },
} as const satisfies Record<WorldId, MeditationWorld>;

export const DEFAULT_WORLD_ID: WorldId = 'constellation';

export function isWorldId(value: unknown): value is WorldId {
  return typeof value === 'string' && (WORLD_IDS as readonly string[]).includes(value);
}
