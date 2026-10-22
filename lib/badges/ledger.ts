/**
 * The collection's memory: what has been done, once per dream, day or entry, and the tiers
 * already earned.
 *
 * Nothing in here reads or keeps a dream's words. A dream is remembered by its identity
 * aliases only, a day by its local date, an entry by its id. What the journal itself can
 * tell (how many dreams, on which days, which were marked or pictured) is read from it again
 * on every pass, so a history kept before the collection existed counts. The other families
 * start from their first recorded action: a past reading or search was never written down.
 */
import { differenceInCalendarDays } from '@/lib/engagementReminders';
import { getDreamSyncState } from '@/lib/dreamUtils';
import { getLocalDateKey } from '@/lib/dreamTrends';
import type { DreamAnalysis } from '@/lib/types';
import { startOfWeek } from '@/lib/weekConstellations';

import {
  BADGE_FAMILIES,
  isBadgeFamilyId,
  tierForProgress,
  type BadgeFamily,
  type BadgeFamilyId,
  type BadgeTierLevel,
} from './catalog';

export const BADGE_LEDGER_VERSION = 1;

export type BadgeLedger = {
  version: typeof BADGE_LEDGER_VERSION;
  /**
   * What was counted per family: a dream as its aliases joined by `|`, a day by its local
   * key, an entry by its id. A family stops adding once its gold is reached.
   */
  keys: Partial<Record<BadgeFamilyId, string[]>>;
  /**
   * The highest value reached: the longest gap a reread dream spanned, and for the families
   * read from the journal, the most they ever counted. A deleted dream lowers nothing.
   */
  best: Partial<Record<BadgeFamilyId, number>>;
  /** When each tier was first earned, bronze first. An earned tier is never taken back. */
  earned: Partial<Record<BadgeFamilyId, number[]>>;
  /** The highest tier the collection has already unveiled, so a new one can be revealed. */
  revealed: Partial<Record<BadgeFamilyId, BadgeTierLevel>>;
};

export const createEmptyBadgeLedger = (): BadgeLedger => ({
  version: BADGE_LEDGER_VERSION,
  keys: {},
  best: {},
  earned: {},
  revealed: {},
});

export type BadgeDreamRef = Pick<DreamAnalysis, 'id' | 'remoteId' | 'clientRequestId'> &
  Partial<Pick<DreamAnalysis, 'isFavorite'>>;

/**
 * A successful action. Favourites, old memories and personal images are not events: the
 * journal shows them once they are durably there, and the ledger keeps what it saw.
 */
export type BadgeEvent =
  /** A new dream reached durable storage. `typed` and `voiced` say how its words arrived. */
  | { type: 'dream_saved'; dream: BadgeDreamRef; typed: boolean; voiced: boolean }
  /** A saved dream's page stayed open to be read again. */
  | { type: 'dream_reopened'; dream: BadgeDreamRef; now: number }
  | { type: 'narrative_edited'; dream: BadgeDreamRef }
  | { type: 'title_edited'; dream: BadgeDreamRef }
  | { type: 'classification_edited'; dream: BadgeDreamRef }
  /** A journal result was opened while a search and/or a filter set by hand narrowed the list. */
  | { type: 'journal_result_opened'; searched: boolean; filtered: boolean; now: number }
  | { type: 'symbol_viewed'; symbolId: string }
  | { type: 'guide_viewed'; guideId: string }
  | { type: 'trends_explored'; now: number };

// ---------------------------------------------------------------------------------- keys --

/** Every name a dream is known by: its stable request id, its server row, its local id. */
export function dreamAliases(dream: BadgeDreamRef): string[] {
  const aliases: string[] = [];
  if (dream.clientRequestId) aliases.push(`c:${dream.clientRequestId}`);
  if (dream.remoteId != null) aliases.push(`r:${dream.remoteId}`);
  if (Number.isFinite(dream.id)) aliases.push(`l:${dream.id}`);
  return aliases;
}

export const dayKey = (timestamp: number): string => getLocalDateKey(timestamp);
export const weekKey = (timestamp: number): string => getLocalDateKey(startOfWeek(timestamp));
export const monthKey = (timestamp: number): string => getLocalDateKey(timestamp).slice(0, 7);

const splitAliases = (key: string) => key.split('|').filter(Boolean);

/**
 * Distinct dreams among alias groups. Sync gives a dream its server id later, so two groups
 * sharing any alias are the same dream. Linear in the number of aliases.
 */
export function countDistinctDreams(groups: Iterable<readonly string[]>): number {
  const parent: number[] = [];
  const find = (node: number): number => {
    let root = node;
    while (parent[root] !== root) root = parent[root];
    while (parent[node] !== root) {
      const next = parent[node];
      parent[node] = root;
      node = next;
    }
    return root;
  };
  const owner = new Map<string, number>();
  let distinct = 0;
  for (const group of groups) {
    if (group.length === 0) continue;
    const node = parent.length;
    parent.push(node);
    distinct += 1;
    for (const alias of group) {
      const known = owner.get(alias);
      if (known === undefined) {
        owner.set(alias, node);
        continue;
      }
      const a = find(known);
      const b = find(node);
      if (a !== b) {
        parent[b] = a;
        distinct -= 1;
      }
    }
  }
  return distinct;
}

// ------------------------------------------------------------------------------ reducing --

const familyById = new Map(BADGE_FAMILIES.map((family) => [family.id, family]));
const gold = (id: BadgeFamilyId) => familyById.get(id)!.thresholds[2];

/** Adds one distinct key; the same ledger comes back when nothing changed. */
function addKey(ledger: BadgeLedger, id: BadgeFamilyId, key: string): BadgeLedger {
  const keys = ledger.keys[id] ?? [];
  if (keys.includes(key) || keys.length >= gold(id)) return ledger;
  return { ...ledger, keys: { ...ledger.keys, [id]: [...keys, key] } };
}

/** Adds a dream by its names unless one of them is already counted. */
function addDreamAliases(ledger: BadgeLedger, id: BadgeFamilyId, aliases: readonly string[]): BadgeLedger {
  if (aliases.length === 0) return ledger;
  const keys = ledger.keys[id] ?? [];
  const index = keys.findIndex((key) => splitAliases(key).some((alias) => aliases.includes(alias)));
  if (index < 0) return addKey(ledger, id, aliases.join('|'));
  // Already counted: it may have received its server id since, which joins its names.
  const known = splitAliases(keys[index]);
  const added = aliases.filter((alias) => !known.includes(alias));
  if (added.length === 0) return ledger;
  const next = [...keys];
  next[index] = [...known, ...added].join('|');
  return { ...ledger, keys: { ...ledger.keys, [id]: next } };
}

const addDream = (ledger: BadgeLedger, id: BadgeFamilyId, dream: BadgeDreamRef) =>
  addDreamAliases(ledger, id, dreamAliases(dream));

function raiseBest(ledger: BadgeLedger, id: BadgeFamilyId, value: number): BadgeLedger {
  if (!Number.isFinite(value) || value <= (ledger.best[id] ?? 0)) return ledger;
  return { ...ledger, best: { ...ledger.best, [id]: value } };
}

/** Whole local days between a dream's saving and now; 0 on the day it was saved. */
export function daysSinceSaved(dream: BadgeDreamRef, now: number): number {
  if (!Number.isFinite(dream.id) || !Number.isFinite(now)) return 0;
  return Math.max(0, differenceInCalendarDays(now, dream.id));
}

/** Folds one successful action into the ledger. Repeating it changes nothing. */
export function applyBadgeEvent(ledger: BadgeLedger, event: BadgeEvent): BadgeLedger {
  switch (event.type) {
    case 'dream_saved': {
      let next = ledger;
      if (event.typed) next = addDream(next, 'ink-dreamer', event.dream);
      if (event.voiced) next = addDream(next, 'night-voice', event.dream);
      return next;
    }
    case 'dream_reopened': {
      // Read again on a later day than it was saved: the page right after saving is not a return.
      const days = daysSinceSaved(event.dream, event.now);
      if (days < 1) return ledger;
      let next = addDream(ledger, 'dream-reader', event.dream);
      next = raiseBest(next, 'time-traveler', days);
      if (event.dream.isFavorite) next = addDream(next, 'favorite-echoes', event.dream);
      return next;
    }
    case 'narrative_edited':
      return addDream(ledger, 'dream-weaver', event.dream);
    case 'title_edited':
      return addDream(ledger, 'dream-namer', event.dream);
    case 'classification_edited':
      return addDream(ledger, 'night-cartographer', event.dream);
    case 'journal_result_opened': {
      let next = ledger;
      if (event.searched) next = addKey(next, 'dream-seeker', dayKey(event.now));
      if (event.filtered) next = addKey(next, 'path-finder', dayKey(event.now));
      return next;
    }
    case 'symbol_viewed':
      return event.symbolId.trim() ? addKey(ledger, 'symbol-explorer', event.symbolId.trim()) : ledger;
    case 'guide_viewed':
      return event.guideId.trim() ? addKey(ledger, 'night-scholar', event.guideId.trim()) : ledger;
    case 'trends_explored':
      return addKey(ledger, 'observatory', dayKey(event.now));
  }
}

// ------------------------------------------------------------------------------ progress --

/** An old memory the dreamer chose to write down as such, not a dream handed over by Lucid. */
const isRecoveredMemory = (dream: DreamAnalysis) =>
  dream.memory?.origin === 'remembered' && dream.memory.createdFrom !== 'lucid_trainer';

/** A personal image that stayed: a failed upload strips it, so only a settled one counts. */
const hasChosenImage = (dream: DreamAnalysis) =>
  dream.imageSource === 'user' && Boolean(dream.imageUrl) && getDreamSyncState(dream) === 'clean';

type JournalReading = {
  saved: string[][];
  days: Set<string>;
  weeks: Set<string>;
  months: Set<string>;
  remembered: string[][];
  favorites: string[][];
  pictured: string[][];
};

/** What the journal itself tells, read again on every pass. */
function readJournal(dreams: readonly DreamAnalysis[]): JournalReading {
  const reading: JournalReading = {
    saved: [],
    days: new Set(),
    weeks: new Set(),
    months: new Set(),
    remembered: [],
    favorites: [],
    pictured: [],
  };
  for (const dream of dreams) {
    const aliases = dreamAliases(dream);
    if (aliases.length === 0) continue;
    reading.saved.push(aliases);
    if (Number.isFinite(dream.id)) {
      reading.days.add(dayKey(dream.id));
      reading.weeks.add(weekKey(dream.id));
      reading.months.add(monthKey(dream.id));
    }
    if (isRecoveredMemory(dream)) reading.remembered.push(aliases);
    if (dream.isFavorite) reading.favorites.push(aliases);
    if (hasChosenImage(dream)) reading.pictured.push(aliases);
  }
  return reading;
}

const storedGroups = (ledger: BadgeLedger, id: BadgeFamilyId) => (ledger.keys[id] ?? []).map(splitAliases);

function progressFrom(ledger: BadgeLedger, reading: JournalReading): Record<BadgeFamilyId, number> {
  const fromJournal: Partial<Record<BadgeFamilyId, number>> = {
    'night-journal': countDistinctDreams(reading.saved),
    'gentle-rhythm': reading.days.size,
    'night-thread': reading.weeks.size,
    'moon-cycles': reading.months.size,
    'memory-keeper': countDistinctDreams(reading.remembered),
    // Marked once is enough: a favourite let go since still counts.
    'treasure-keeper': countDistinctDreams([...storedGroups(ledger, 'treasure-keeper'), ...reading.favorites]),
    'dream-painter': countDistinctDreams([...storedGroups(ledger, 'dream-painter'), ...reading.pictured]),
  };
  const progress = {} as Record<BadgeFamilyId, number>;
  for (const family of BADGE_FAMILIES) {
    const stored = family.unit === 'max_days'
      ? ledger.best[family.id] ?? 0
      : family.unit === 'dream'
        ? countDistinctDreams(storedGroups(ledger, family.id))
        : (ledger.keys[family.id] ?? []).length;
    const kept = family.fromJournal ? ledger.best[family.id] ?? 0 : 0;
    progress[family.id] = Math.max(fromJournal[family.id] ?? 0, stored, kept);
  }
  return progress;
}

/** Every family's current value, from the ledger and the journal as they are now. */
export function computeBadgeProgress(
  ledger: BadgeLedger,
  dreams: readonly DreamAnalysis[],
): Record<BadgeFamilyId, number> {
  return progressFrom(ledger, readJournal(dreams));
}

/**
 * Keeps what the journal showed (its highest counts, each favourite and image seen) and
 * stamps any tier reached for the first time. The same ledger comes back when nothing changed.
 */
export function settleBadgeLedger(
  ledger: BadgeLedger,
  dreams: readonly DreamAnalysis[],
  now: number,
): BadgeLedger {
  const reading = readJournal(dreams);
  let next = ledger;
  for (const aliases of reading.favorites) next = addDreamAliases(next, 'treasure-keeper', aliases);
  for (const aliases of reading.pictured) next = addDreamAliases(next, 'dream-painter', aliases);
  const progress = progressFrom(next, reading);
  for (const family of BADGE_FAMILIES) {
    const value = progress[family.id];
    if (family.fromJournal) next = raiseBest(next, family.id, value);
    const earned = next.earned[family.id] ?? [];
    const reached = tierForProgress(family.thresholds, value);
    if (reached > earned.length) {
      const stamps = [...earned];
      while (stamps.length < reached) stamps.push(now);
      next = { ...next, earned: { ...next.earned, [family.id]: stamps } };
    }
  }
  return next;
}

/** Marks a family's earned tiers as unveiled. */
export function revealBadgeFamily(ledger: BadgeLedger, id: BadgeFamilyId): BadgeLedger {
  const earned = Math.min(3, (ledger.earned[id] ?? []).length) as BadgeTierLevel;
  if ((ledger.revealed[id] ?? 0) >= earned) return ledger;
  return { ...ledger, revealed: { ...ledger.revealed, [id]: earned } };
}

// ------------------------------------------------------------------------------ the view --

export type BadgeFamilyState = {
  family: BadgeFamily;
  progress: number;
  /** Tiers earned, never fewer than before. */
  tier: BadgeTierLevel;
  /** When each earned tier was first reached, bronze first. */
  earnedAt: number[];
  /** The next threshold, or null once gold is earned. */
  nextThreshold: number | null;
  /** Earned tiers the collection has not unveiled yet. */
  unrevealed: number;
};

export type BadgeCollection = {
  families: BadgeFamilyState[];
  earnedCards: number;
  unrevealedCards: number;
  /** Families holding at least that tier. */
  counts: { bronze: number; silver: number; gold: number };
};

export function buildBadgeCollection(
  ledger: BadgeLedger,
  progress: Record<BadgeFamilyId, number>,
): BadgeCollection {
  const families = BADGE_FAMILIES.map((family): BadgeFamilyState => {
    const value = progress[family.id] ?? 0;
    const earnedAt = ledger.earned[family.id] ?? [];
    const tier = Math.min(3, Math.max(earnedAt.length, tierForProgress(family.thresholds, value))) as BadgeTierLevel;
    return {
      family,
      progress: value,
      tier,
      earnedAt,
      nextThreshold: tier >= 3 ? null : family.thresholds[tier as 0 | 1 | 2],
      unrevealed: Math.max(0, tier - (ledger.revealed[family.id] ?? 0)),
    };
  });
  return {
    families,
    earnedCards: families.reduce((sum, state) => sum + state.tier, 0),
    unrevealedCards: families.reduce((sum, state) => sum + state.unrevealed, 0),
    counts: {
      bronze: families.filter((state) => state.tier >= 1).length,
      silver: families.filter((state) => state.tier >= 2).length,
      gold: families.filter((state) => state.tier >= 3).length,
    },
  };
}

// ------------------------------------------------------------------------- stored ledgers --

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
const isStampArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length <= 3 && value.every((item) => typeof item === 'number' && Number.isFinite(item));
const entriesOf = (field: unknown) =>
  field && typeof field === 'object' && !Array.isArray(field) ? Object.entries(field as Record<string, unknown>) : [];

/** Reads a stored ledger, keeping every well-formed family and dropping the rest. */
export function parseBadgeLedger(raw: unknown): BadgeLedger {
  const ledger = createEmptyBadgeLedger();
  if (!raw || typeof raw !== 'object') return ledger;
  const value = raw as Partial<Record<keyof BadgeLedger, unknown>>;
  if (value.version !== BADGE_LEDGER_VERSION) return ledger;
  for (const [id, keys] of entriesOf(value.keys)) {
    if (isBadgeFamilyId(id) && isStringArray(keys)) ledger.keys[id] = [...new Set(keys)].slice(0, gold(id));
  }
  for (const [id, best] of entriesOf(value.best)) {
    if (isBadgeFamilyId(id) && typeof best === 'number' && Number.isFinite(best) && best > 0) ledger.best[id] = best;
  }
  for (const [id, stamps] of entriesOf(value.earned)) {
    if (isBadgeFamilyId(id) && isStampArray(stamps)) ledger.earned[id] = stamps;
  }
  for (const [id, level] of entriesOf(value.revealed)) {
    if (isBadgeFamilyId(id) && (level === 1 || level === 2 || level === 3)) ledger.revealed[id] = level;
  }
  return ledger;
}

/**
 * Joins a guest's ledger to the account that takes over its journal: every count, best and
 * earned tier of both is kept, at the earliest date either earned it.
 */
export function mergeBadgeLedgers(base: BadgeLedger, other: BadgeLedger): BadgeLedger {
  let next = base;
  for (const [id, keys] of Object.entries(other.keys) as [BadgeFamilyId, string[]][]) {
    const family = familyById.get(id);
    if (!family) continue;
    for (const key of keys) {
      next = family.unit === 'dream' ? addDreamAliases(next, id, splitAliases(key)) : addKey(next, id, key);
    }
  }
  for (const [id, best] of Object.entries(other.best) as [BadgeFamilyId, number][]) next = raiseBest(next, id, best);
  for (const [id, stamps] of Object.entries(other.earned) as [BadgeFamilyId, number[]][]) {
    const current = next.earned[id] ?? [];
    const merged = Array.from({ length: Math.max(current.length, stamps.length) }, (_, index) => {
      const mine = current[index];
      const theirs = stamps[index];
      return mine == null ? theirs : theirs == null ? mine : Math.min(mine, theirs);
    });
    if (merged.length !== current.length || merged.some((stamp, index) => stamp !== current[index])) {
      next = { ...next, earned: { ...next.earned, [id]: merged } };
    }
  }
  for (const [id, level] of Object.entries(other.revealed) as [BadgeFamilyId, BadgeTierLevel][]) {
    if (level > (next.revealed[id] ?? 0)) next = { ...next, revealed: { ...next.revealed, [id]: level } };
  }
  return next;
}
