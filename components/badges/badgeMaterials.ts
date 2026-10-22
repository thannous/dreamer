import { DarkTheme } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { BADGE_TIERS, type BadgeTier, type BadgeTierLevel } from '@/lib/badges/catalog';

const NIGHT = getNoctaliaDesignTokens(DarkTheme, 'dark');

/** The cards are night objects whatever the theme: their tokens are the night palette's. */
export const COLLECTION = NIGHT.collection;

/** The held card's own action, on the night it is shown against in either theme. */
export const NIGHT_ACTION = NIGHT.action;

export type BadgeMaterial = {
  frame: readonly [string, string, ...string[]];
  glow: string;
  ink: string;
  /** Silver and gold catch a moving sheen; gold also carries the holographic foil. */
  sheen: boolean;
  foil: boolean;
};

const MATERIALS: Record<BadgeTier | 'locked', BadgeMaterial> = {
  locked: { ...COLLECTION.locked, sheen: false, foil: false },
  bronze: { ...COLLECTION.bronze, sheen: false, foil: false },
  silver: { ...COLLECTION.silver, sheen: true, foil: false },
  gold: { ...COLLECTION.gold, sheen: true, foil: true },
};

export const tierOfLevel = (level: BadgeTierLevel): BadgeTier | null =>
  level === 0 ? null : BADGE_TIERS[level - 1];

export function getBadgeMaterial(tier: BadgeTier | null): BadgeMaterial {
  return MATERIALS[tier ?? 'locked'];
}
