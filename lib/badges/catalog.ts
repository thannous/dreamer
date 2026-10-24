/**
 * The badge collection: nine families earned tier by tier, and six cards earned once.
 *
 * A family rewards a way of keeping the journal that enriches it, never the quality or the
 * feeling of a dream. Its thresholds count distinct dreams, months, entries or the longest
 * gap; none asks for consecutive days, so a pause never takes a level back. A gesture that
 * can be repeated without thought earns a single card, the first time, so the dreamer
 * discovers what it does.
 */

export const BADGE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const;
export type BadgeTier = (typeof BADGE_TIERS)[number];
/** 0 while nothing is earned, then the number of tiers earned. */
export type BadgeTierLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const BADGE_CHAPTERS = ['rhythm', 'reread', 'deepen', 'share', 'firsts'] as const;
export type BadgeChapter = (typeof BADGE_CHAPTERS)[number];

/** What one unit of progress is, which also decides how it is remembered. */
export type BadgeUnit =
  /** Distinct dreams. */
  | 'dream'
  /** Distinct local days or calendar months. */
  | 'day'
  | 'month'
  /** Distinct dictionary entries or guides. */
  | 'entry'
  /** The longest number of days reached, not a count. */
  | 'max_days';

export type BadgeFamilyId =
  | 'night-journal'
  | 'moon-cycles'
  | 'memory-keeper'
  | 'dream-reader'
  | 'time-traveler'
  | 'dream-weaver'
  | 'symbol-explorer'
  | 'night-scholar'
  | 'night-echoes'
  | 'night-voice'
  | 'dream-questions'
  | 'treasure-keeper'
  | 'dream-painter'
  | 'dream-seeker'
  | 'observatory';

export type BadgeFamily = {
  id: BadgeFamilyId;
  chapter: BadgeChapter;
  unit: BadgeUnit;
  /**
   * One threshold per tier, strictly increasing: five for a family that grows with time,
   * three for one that stops at gold, one for a card earned once.
   */
  thresholds: readonly number[];
  /** Where the next step is taken; the collection offers it as the family's way in. */
  action: BadgeAction;
  /** Counted from the journal itself, so dreams kept before the collection count too. */
  fromJournal: boolean;
};

export type BadgeAction =
  | 'capture'
  | 'capture_voice'
  | 'capture_questions'
  | 'capture_memory'
  | 'journal'
  | 'dictionary'
  | 'guides'
  | 'trends';

const family = (
  id: BadgeFamilyId,
  chapter: BadgeChapter,
  unit: BadgeUnit,
  thresholds: readonly number[],
  action: BadgeAction,
  fromJournal = false,
): BadgeFamily => ({ id, chapter, unit, thresholds, action, fromJournal });

/**
 * In the order the collection shows them, chapter by chapter. Thresholds assume a regular
 * dreamer keeps about three dreams a week: bronze in the first week, silver within a month,
 * gold within three, platinum within six and diamond within a year.
 */
export const BADGE_FAMILIES: readonly BadgeFamily[] = [
  family('night-journal', 'rhythm', 'dream', [1, 10, 30, 75, 150], 'capture', true),
  family('moon-cycles', 'rhythm', 'month', [2, 3, 6, 9, 12], 'capture', true),
  family('memory-keeper', 'rhythm', 'dream', [1, 3, 10], 'capture_memory', true),

  family('dream-reader', 'reread', 'dream', [1, 3, 10, 20, 35], 'journal', true),
  family('time-traveler', 'reread', 'max_days', [7, 30, 90, 180, 365], 'journal', true),

  family('dream-weaver', 'deepen', 'dream', [1, 3, 10], 'journal'),
  family('symbol-explorer', 'deepen', 'entry', [3, 10, 25, 50, 100], 'dictionary'),
  // Eight guides ship today: the gold card asks for every one of them.
  family('night-scholar', 'deepen', 'entry', [1, 4, 8], 'guides'),

  family('night-echoes', 'share', 'dream', [1, 3, 10], 'journal'),

  family('night-voice', 'firsts', 'dream', [1], 'capture_voice'),
  family('dream-questions', 'firsts', 'dream', [1], 'capture_questions'),
  family('treasure-keeper', 'firsts', 'dream', [1], 'journal', true),
  family('dream-painter', 'firsts', 'dream', [1], 'journal', true),
  family('dream-seeker', 'firsts', 'day', [1], 'journal'),
  family('observatory', 'firsts', 'day', [1], 'trends'),
];

const FAMILY_BY_ID = new Map(BADGE_FAMILIES.map((entry) => [entry.id, entry]));

export function getBadgeFamily(id: string): BadgeFamily | undefined {
  return FAMILY_BY_ID.get(id as BadgeFamilyId);
}

export function isBadgeFamilyId(id: unknown): id is BadgeFamilyId {
  return typeof id === 'string' && FAMILY_BY_ID.has(id as BadgeFamilyId);
}

/** A card earned once, the first time its gesture is made: no tiers, no progress. */
export const isFirstCard = (entry: BadgeFamily): boolean => entry.thresholds.length === 1;

/** The number of tiers a family holds: 1, 3 or 5. */
export const tierCount = (entry: BadgeFamily): BadgeTierLevel => entry.thresholds.length as BadgeTierLevel;

/** Every card the collection can hold: one per family and tier. */
export const BADGE_CARD_COUNT = BADGE_FAMILIES.reduce((sum, entry) => sum + entry.thresholds.length, 0);

/** The tier a progress value reaches on its own. */
export function tierForProgress(thresholds: readonly number[], progress: number): BadgeTierLevel {
  return thresholds.filter((threshold) => progress >= threshold).length as BadgeTierLevel;
}
