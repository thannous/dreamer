import { DarkTheme } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { BADGE_TIERS, isFirstCard, type BadgeFamily, type BadgeTier, type BadgeTierLevel } from '@/lib/badges/catalog';

const NIGHT = getNoctaliaDesignTokens(DarkTheme, 'dark');

/** The cards are night objects whatever the theme: their tokens are the night palette's. */
export const COLLECTION = NIGHT.collection;

/** The held card's own action, on the night it is shown against in either theme. */
export const NIGHT_ACTION = NIGHT.action;

/** How an earned card is dressed: a tier's metal, or the violet of a card earned once. */
export type BadgeFinish = BadgeTier | 'discovery';

export type BadgeMaterial = {
  frame: readonly [string, string, ...string[]];
  glow: string;
  ink: string;
  /** Silver and the metals above it catch a moving band of light. */
  sheen: boolean;
  /** A film drifting across the painting: gold's foil, platinum's nacre, diamond's prism. */
  film: readonly [string, string, ...string[]] | null;
  /** Gold and above wear a crown of rays; silver and platinum a ring around the medallion. */
  rays: boolean;
  ring: boolean;
};

const MATERIALS: Record<BadgeFinish | 'locked', BadgeMaterial> = {
  locked: { ...COLLECTION.locked, sheen: false, film: null, rays: false, ring: false },
  discovery: { ...COLLECTION.discovery, sheen: false, film: null, rays: false, ring: true },
  bronze: { ...COLLECTION.bronze, sheen: false, film: null, rays: false, ring: false },
  silver: { ...COLLECTION.silver, sheen: true, film: null, rays: false, ring: true },
  gold: { ...COLLECTION.gold, sheen: true, film: COLLECTION.foil, rays: true, ring: false },
  platinum: { ...COLLECTION.platinum, sheen: true, film: COLLECTION.nacre, rays: true, ring: true },
  diamond: { ...COLLECTION.diamond, sheen: true, film: COLLECTION.prism, rays: true, ring: true },
};

/** A family's dress at a level: none before it is earned, a metal per tier, or a discovery. */
export function finishOf(family: BadgeFamily, level: BadgeTierLevel): BadgeFinish | null {
  if (level === 0) return null;
  return isFirstCard(family) ? 'discovery' : BADGE_TIERS[level - 1];
}

export function getBadgeMaterial(finish: BadgeFinish | null): BadgeMaterial {
  return MATERIALS[finish ?? 'locked'];
}
