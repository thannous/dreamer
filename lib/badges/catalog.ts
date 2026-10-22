/**
 * The badge collection: twenty families, each earned in bronze, silver and gold.
 *
 * A family rewards a way of keeping the journal, never the quality or the feeling of a dream.
 * Its thresholds count distinct dreams, days, entries or the longest gap; none asks for
 * consecutive days, so a pause never takes a level back.
 */

export const BADGE_TIERS = ['bronze', 'silver', 'gold'] as const;
export type BadgeTier = (typeof BADGE_TIERS)[number];
/** 0 while nothing is earned, then the number of tiers earned. */
export type BadgeTierLevel = 0 | 1 | 2 | 3;

export const BADGE_CHAPTERS = ['rhythm', 'capture', 'reread', 'shape', 'explore'] as const;
export type BadgeChapter = (typeof BADGE_CHAPTERS)[number];

/** What one unit of progress is, which also decides how it is remembered. */
export type BadgeUnit =
  /** Distinct dreams. */
  | 'dream'
  /** Distinct local days, ISO-like weeks (Monday first) or calendar months. */
  | 'day'
  | 'week'
  | 'month'
  /** Distinct dictionary entries or guides. */
  | 'entry'
  /** The longest number of days reached, not a count. */
  | 'max_days';

export type BadgeFamilyId =
  | 'night-journal'
  | 'gentle-rhythm'
  | 'night-thread'
  | 'moon-cycles'
  | 'ink-dreamer'
  | 'night-voice'
  | 'memory-keeper'
  | 'dream-reader'
  | 'time-traveler'
  | 'treasure-keeper'
  | 'favorite-echoes'
  | 'dream-weaver'
  | 'dream-namer'
  | 'night-cartographer'
  | 'dream-seeker'
  | 'path-finder'
  | 'symbol-explorer'
  | 'night-scholar'
  | 'observatory'
  | 'dream-painter';

export type BadgeFamily = {
  id: BadgeFamilyId;
  chapter: BadgeChapter;
  unit: BadgeUnit;
  /** Bronze, silver and gold, strictly increasing. */
  thresholds: readonly [number, number, number];
  /** Where the next step is taken; the collection offers it as the family's way in. */
  action: BadgeAction;
  /** Counted from the journal itself, so dreams kept before the collection count too. */
  fromJournal: boolean;
};

export type BadgeAction =
  | 'capture'
  | 'capture_voice'
  | 'capture_memory'
  | 'journal'
  | 'favorites'
  | 'dictionary'
  | 'guides'
  | 'trends';

const family = (
  id: BadgeFamilyId,
  chapter: BadgeChapter,
  unit: BadgeUnit,
  thresholds: readonly [number, number, number],
  action: BadgeAction,
  fromJournal = false,
): BadgeFamily => ({ id, chapter, unit, thresholds, action, fromJournal });

/** In the order the collection shows them, chapter by chapter. */
export const BADGE_FAMILIES: readonly BadgeFamily[] = [
  family('night-journal', 'rhythm', 'dream', [1, 25, 100], 'capture', true),
  family('gentle-rhythm', 'rhythm', 'day', [3, 14, 50], 'capture', true),
  family('night-thread', 'rhythm', 'week', [2, 8, 26], 'capture', true),
  family('moon-cycles', 'rhythm', 'month', [2, 6, 12], 'capture', true),

  family('ink-dreamer', 'capture', 'dream', [3, 15, 50], 'capture'),
  family('night-voice', 'capture', 'dream', [1, 10, 30], 'capture_voice'),
  family('memory-keeper', 'capture', 'dream', [1, 5, 15], 'capture_memory', true),

  family('dream-reader', 'reread', 'dream', [1, 10, 30], 'journal'),
  family('time-traveler', 'reread', 'max_days', [7, 30, 90], 'journal'),
  family('treasure-keeper', 'reread', 'dream', [1, 5, 15], 'journal', true),
  family('favorite-echoes', 'reread', 'dream', [1, 5, 15], 'favorites'),

  family('dream-weaver', 'shape', 'dream', [1, 5, 15], 'journal'),
  family('dream-namer', 'shape', 'dream', [1, 5, 15], 'journal'),
  family('night-cartographer', 'shape', 'dream', [1, 5, 15], 'journal'),
  family('dream-painter', 'shape', 'dream', [1, 5, 15], 'journal', true),

  family('dream-seeker', 'explore', 'day', [3, 10, 30], 'journal'),
  family('path-finder', 'explore', 'day', [3, 10, 30], 'journal'),
  family('symbol-explorer', 'explore', 'entry', [3, 15, 40], 'dictionary'),
  // Eight guides ship today: the gold card asks for every one of them.
  family('night-scholar', 'explore', 'entry', [2, 4, 8], 'guides'),
  family('observatory', 'explore', 'day', [3, 10, 30], 'trends'),
];

export const BADGE_FAMILY_IDS = BADGE_FAMILIES.map((entry) => entry.id);

const FAMILY_BY_ID = new Map(BADGE_FAMILIES.map((entry) => [entry.id, entry]));

export function getBadgeFamily(id: string): BadgeFamily | undefined {
  return FAMILY_BY_ID.get(id as BadgeFamilyId);
}

export function isBadgeFamilyId(id: unknown): id is BadgeFamilyId {
  return typeof id === 'string' && FAMILY_BY_ID.has(id as BadgeFamilyId);
}

/** Every card the collection can hold: one per family and tier. */
export const BADGE_CARD_COUNT = BADGE_FAMILIES.length * BADGE_TIERS.length;

/** The tier a progress value reaches on its own. */
export function tierForProgress(thresholds: readonly [number, number, number], progress: number): BadgeTierLevel {
  if (progress >= thresholds[2]) return 3;
  if (progress >= thresholds[1]) return 2;
  if (progress >= thresholds[0]) return 1;
  return 0;
}
