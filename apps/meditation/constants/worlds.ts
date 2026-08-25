import type { ImageSourcePropType } from 'react-native';

import type { BreathingPatternId } from '@/content/breathing';
import { Atmosphere, NightTheme, PaperTheme } from '@/constants/theme';
import type { CategorySlug, SessionId } from '@/lib/types';

export type WorldId =
  | 'constellation'
  | 'dawn'
  | 'forest'
  | 'tide'
  | 'sanctuary'
  | 'cloud';

export type WorldMotion = 'orbit' | 'rise' | 'canopy' | 'drift' | 'pulse' | 'float';

/** The concrete need a world answers. Values are identifiers, never display copy. */
export type WorldRole =
  | 'dream-entry'
  | 'morning-intention'
  | 'grounding'
  | 'decompression'
  | 'night-refuge'
  | 'mental-clarity';

export type WorldJourneyStageId = 'discovery' | 'deepen' | 'inhabit';

export type WorldJourneyProgression = readonly [
  { readonly id: 'discovery'; readonly sessionId: SessionId },
  { readonly id: 'deepen'; readonly sessionId: SessionId },
  { readonly id: 'inhabit'; readonly sessionId: SessionId },
];

export type WorldPersonality = {
  /** Unique functional promise, separate from the visual treatment. */
  role: WorldRole;
  /** Exclusive content lane used by daily and upcoming recommendations. */
  primaryCategory: CategorySlug;
  /** Trainer rhythm suggested when entering this world. */
  breathingPatternId: BreathingPatternId;
  /** A concise editorial path from first contact to autonomous practice. */
  progression: WorldJourneyProgression;
};

export type MeditationWorld = {
  id: WorldId;
  /** Free worlds open directly; purchase worlds are unlocked once, forever. */
  access: 'free' | 'purchase';
  appearance: 'dark' | 'light';
  nameKey: `world.${WorldId}.name`;
  descriptionKey: `world.${WorldId}.description`;
  personality: WorldPersonality;
  /** A world-specific movement derived from the one global breath. */
  motion: WorldMotion;
  thumbnail: ImageSourcePropType;
  artwork: {
    journey: ImageSourcePropType;
    trainer: ImageSourcePropType;
    completion: ImageSourcePropType;
    purchase: ImageSourcePropType;
  };
  atmosphere: {
    /** Opaque colour laid over the artwork to protect text contrast. */
    scrimColor: string;
    scrimOpacity: number;
    /**
     * Alpha of the gradient mid stop, authored per artwork so the
     * luminous well does not punch a hole through the text.
     */
    centreScrimOpacity: number;
    /** Low-opacity world tint; glass remains a supporting texture above it. */
    overlayColor: string;
    overlayOpacity: number;
  };
};

const CONSTELLATION_ARTWORK = require('@/assets/worlds/constellation.webp');
const CONSTELLATION_TRAINER_ARTWORK = require('@/assets/worlds/constellation-trainer.webp');
const CONSTELLATION_THUMBNAIL = require('@/assets/worlds/constellation-thumbnail.webp');
const DAWN_ARTWORK = require('@/assets/worlds/dawn.webp');
const DAWN_TRAINER_ARTWORK = require('@/assets/worlds/dawn-trainer.webp');
const DAWN_THUMBNAIL = require('@/assets/worlds/dawn-thumbnail.webp');
const FOREST_ARTWORK = require('@/assets/worlds/forest.webp');
const FOREST_TRAINER_ARTWORK = require('@/assets/worlds/forest-trainer.webp');
const FOREST_THUMBNAIL = require('@/assets/worlds/forest-thumbnail.webp');
const TIDE_ARTWORK = require('@/assets/worlds/tide.webp');
const TIDE_TRAINER_ARTWORK = require('@/assets/worlds/tide-trainer.webp');
const TIDE_PURCHASE_ARTWORK = require('@/assets/worlds/tide-purchase.webp');
const TIDE_THUMBNAIL = require('@/assets/worlds/tide-thumbnail.webp');
const SANCTUARY_ARTWORK = require('@/assets/worlds/sanctuary.webp');
const SANCTUARY_TRAINER_ARTWORK = require('@/assets/worlds/sanctuary-trainer.webp');
const SANCTUARY_THUMBNAIL = require('@/assets/worlds/sanctuary-thumbnail.webp');
const CLOUD_ARTWORK = require('@/assets/worlds/cloud.webp');
const CLOUD_TRAINER_ARTWORK = require('@/assets/worlds/cloud-trainer.webp');
const CLOUD_THUMBNAIL = require('@/assets/worlds/cloud-thumbnail.webp');

export const WORLD_IDS = [
  'constellation',
  'dawn',
  'forest',
  'tide',
  'sanctuary',
  'cloud',
] as const satisfies readonly WorldId[];

export const WORLD_BY_ID = {
  constellation: {
    id: 'constellation',
    access: 'free',
    appearance: 'dark',
    nameKey: 'world.constellation.name',
    descriptionKey: 'world.constellation.description',
    personality: {
      role: 'dream-entry',
      primaryCategory: 'dream-prep',
      breathingPatternId: 'calm',
      progression: [
        { id: 'discovery', sessionId: 'sleep-descent' },
        { id: 'deepen', sessionId: 'dream-threshold' },
        { id: 'inhabit', sessionId: 'dream-lucid' },
      ],
    },
    motion: 'orbit',
    thumbnail: CONSTELLATION_THUMBNAIL,
    artwork: {
      journey: CONSTELLATION_ARTWORK,
      trainer: CONSTELLATION_TRAINER_ARTWORK,
      completion: CONSTELLATION_ARTWORK,
      purchase: CONSTELLATION_TRAINER_ARTWORK,
    },
    atmosphere: {
      scrimColor: NightTheme.background,
      scrimOpacity: 0.48,
      centreScrimOpacity: 0.62,
      overlayColor: Atmosphere.dark.glow,
      overlayOpacity: 0.12,
    },
  },
  dawn: {
    id: 'dawn',
    access: 'free',
    appearance: 'light',
    nameKey: 'world.dawn.name',
    descriptionKey: 'world.dawn.description',
    personality: {
      role: 'morning-intention',
      primaryCategory: 'gratitude',
      breathingPatternId: 'coherent',
      progression: [
        { id: 'discovery', sessionId: 'gratitude-three' },
        { id: 'deepen', sessionId: 'gratitude-ordinary' },
        { id: 'inhabit', sessionId: 'gratitude-year' },
      ],
    },
    motion: 'rise',
    thumbnail: DAWN_THUMBNAIL,
    artwork: {
      journey: DAWN_ARTWORK,
      trainer: DAWN_TRAINER_ARTWORK,
      completion: DAWN_ARTWORK,
      purchase: DAWN_TRAINER_ARTWORK,
    },
    atmosphere: {
      scrimColor: PaperTheme.background,
      scrimOpacity: 0.22,
      centreScrimOpacity: 0.58,
      overlayColor: Atmosphere.light.glow,
      overlayOpacity: 0.1,
    },
  },
  forest: {
    id: 'forest',
    access: 'free',
    appearance: 'dark',
    nameKey: 'world.forest.name',
    descriptionKey: 'world.forest.description',
    personality: {
      role: 'grounding',
      primaryCategory: 'anxiety',
      breathingPatternId: 'box',
      progression: [
        { id: 'discovery', sessionId: 'anxiety-ground' },
        { id: 'deepen', sessionId: 'anxiety-wave' },
        { id: 'inhabit', sessionId: 'anxiety-evening' },
      ],
    },
    motion: 'canopy',
    thumbnail: FOREST_THUMBNAIL,
    artwork: {
      journey: FOREST_ARTWORK,
      trainer: FOREST_TRAINER_ARTWORK,
      completion: FOREST_ARTWORK,
      purchase: FOREST_TRAINER_ARTWORK,
    },
    atmosphere: {
      scrimColor: NightTheme.background,
      scrimOpacity: 0.42,
      centreScrimOpacity: 0.7,
      overlayColor: Atmosphere.dark.glow,
      overlayOpacity: 0.1,
    },
  },
  tide: {
    id: 'tide',
    access: 'purchase',
    appearance: 'dark',
    nameKey: 'world.tide.name',
    descriptionKey: 'world.tide.description',
    personality: {
      role: 'decompression',
      primaryCategory: 'stress',
      breathingPatternId: 'calm',
      progression: [
        { id: 'discovery', sessionId: 'stress-shoulders' },
        { id: 'deepen', sessionId: 'stress-unclench' },
        { id: 'inhabit', sessionId: 'stress-storm' },
      ],
    },
    motion: 'drift',
    thumbnail: TIDE_THUMBNAIL,
    artwork: {
      journey: TIDE_ARTWORK,
      trainer: TIDE_TRAINER_ARTWORK,
      completion: TIDE_ARTWORK,
      purchase: TIDE_PURCHASE_ARTWORK,
    },
    atmosphere: {
      scrimColor: NightTheme.background,
      scrimOpacity: 0.44,
      centreScrimOpacity: 0.58,
      overlayColor: Atmosphere.dark.glow,
      overlayOpacity: 0.12,
    },
  },
  sanctuary: {
    id: 'sanctuary',
    access: 'purchase',
    appearance: 'dark',
    nameKey: 'world.sanctuary.name',
    descriptionKey: 'world.sanctuary.description',
    personality: {
      role: 'night-refuge',
      primaryCategory: 'sleep',
      breathingPatternId: 'coherent',
      progression: [
        { id: 'discovery', sessionId: 'sleep-quick-fall' },
        { id: 'deepen', sessionId: 'sleep-night-return' },
        { id: 'inhabit', sessionId: 'sleep-body-scan' },
      ],
    },
    motion: 'pulse',
    thumbnail: SANCTUARY_THUMBNAIL,
    artwork: {
      journey: SANCTUARY_ARTWORK,
      trainer: SANCTUARY_TRAINER_ARTWORK,
      completion: SANCTUARY_ARTWORK,
      purchase: SANCTUARY_TRAINER_ARTWORK,
    },
    atmosphere: {
      scrimColor: NightTheme.background,
      scrimOpacity: 0.44,
      centreScrimOpacity: 0.54,
      overlayColor: Atmosphere.dark.glow,
      overlayOpacity: 0.14,
    },
  },
  cloud: {
    id: 'cloud',
    access: 'purchase',
    appearance: 'light',
    nameKey: 'world.cloud.name',
    descriptionKey: 'world.cloud.description',
    personality: {
      role: 'mental-clarity',
      primaryCategory: 'focus',
      breathingPatternId: 'box',
      progression: [
        { id: 'discovery', sessionId: 'focus-morning' },
        { id: 'deepen', sessionId: 'focus-one-thing' },
        { id: 'inhabit', sessionId: 'focus-deep' },
      ],
    },
    motion: 'float',
    thumbnail: CLOUD_THUMBNAIL,
    artwork: {
      journey: CLOUD_ARTWORK,
      trainer: CLOUD_TRAINER_ARTWORK,
      completion: CLOUD_ARTWORK,
      purchase: CLOUD_TRAINER_ARTWORK,
    },
    atmosphere: {
      scrimColor: PaperTheme.background,
      scrimOpacity: 0.18,
      centreScrimOpacity: 0.66,
      overlayColor: Atmosphere.light.glow,
      overlayOpacity: 0.1,
    },
  },
} as const satisfies Record<WorldId, MeditationWorld>;

export const DEFAULT_WORLD_ID: WorldId = 'constellation';

export function isWorldId(value: unknown): value is WorldId {
  return typeof value === 'string' && (WORLD_IDS as readonly string[]).includes(value);
}

/** Route params may name a free world or one the listener actually owns. */
export function canAccessWorld(
  worldId: WorldId,
  isWorldOwned: (id: WorldId) => boolean
): boolean {
  return WORLD_BY_ID[worldId].access === 'free' || isWorldOwned(worldId);
}
