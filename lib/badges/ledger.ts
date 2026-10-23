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
  getBadgeFamily,
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

/** The fields of a dream an event needs, so a whole dream is not kept with it. */
export const dreamRef = ({ id, remoteId, clientRequestId, isFavorite }: BadgeDreamRef): BadgeDreamRef =>
  ({ id, remoteId, clientRequestId, isFavorite });

/**
 * A successful action. Favourites, old memories and personal images are not events: the
 * journal shows them once they are durably there, and the ledger keeps what it saw.
 */
export type BadgeEvent =
  /**
   * A new dream reached durable storage. `input` says how its words arrived: recognised
   * speech, typing alone, or neither (a restored draft).
   */
  | { type: 'dream_saved'; dream: BadgeDreamRef; input: 'voice' | 'text' | null }
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
function dreamAliases(dream: BadgeDreamRef): string[] {
  const aliases: string[] = [];
  if (dream.clientRequestId) aliases.push(`c:${dream.clientRequestId}`);
  if (dream.remoteId != null) aliases.push(`r:${dream.remoteId}`);
  if (Number.isFinite(dream.id)) aliases.push(`l:${dream.id}`);
  return aliases;
}

const dayKey = (timestamp: number): string => getLocalDateKey(timestamp);
const weekKey = (timestamp: number): string => getLocalDateKey(startOfWeek(timestamp));
const monthKey = (timestamp: number): string => getLocalDateKey(timestamp).slice(0, 7);

const splitAliases = (key: string) => key.split('|').filter(Boolean);
const stableAliases = (aliases: readonly string[]) => aliases.filter((alias) => alias.startsWith('c:') || alias.startsWith('r:'));
const sharesDream = (known: readonly string[], incoming: readonly string[]) => {
  const knownStable = stableAliases(known);
  const incomingStable = stableAliases(incoming);
  // Local timestamps can collide across devices. When both have stable identities,
  // only an actual shared UUID/server row establishes that this is the same dream.
  const left = knownStable.length && incomingStable.length ? knownStable : known;
  const right = knownStable.length && incomingStable.length ? incomingStable : incoming;
  return left.some((alias) => right.includes(alias));
};

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
    const stable = stableAliases(group);
    for (const alias of stable.length ? stable : group) {
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

const gold = (id: BadgeFamilyId) => getBadgeFamily(id)!.thresholds[2];

/** Adds one distinct key; the same ledger comes back when nothing changed. */
function addKey(ledger: BadgeLedger, id: BadgeFamilyId, key: string): BadgeLedger {
  const keys = ledger.keys[id] ?? [];
  if (keys.includes(key) || keys.length >= gold(id)) return ledger;
  return { ...ledger, keys: { ...ledger.keys, [id]: [...keys, key] } };
}

/**
 * Adds each dream by its names unless one of them is already counted. The counted keys are
 * indexed by alias once, so a whole journal folds in linear time rather than key by key.
 */
function addDreamAliases(ledger: BadgeLedger, id: BadgeFamilyId, groups: Iterable<readonly string[]>): BadgeLedger {
  const stored = ledger.keys[id] ?? [];
  const known = stored.map(splitAliases);
  const owners = new Map<string, number[]>();
  const own = (aliases: readonly string[], index: number) => {
    for (const alias of aliases) {
      const indices = owners.get(alias);
      if (indices) indices.push(index);
      else owners.set(alias, [index]);
    }
  };
  known.forEach(own);
  let keys = stored;
  for (const aliases of groups) {
    if (aliases.length === 0) continue;
    // The first counted dream sharing a name, as a scan of the keys in order would find it.
    let index = -1;
    for (const alias of aliases) {
      for (const candidate of owners.get(alias) ?? []) {
        if ((index < 0 || candidate < index) && sharesDream(known[candidate], aliases)) index = candidate;
      }
    }
    if (index < 0) {
      const key = aliases.join('|');
      if (keys.length >= gold(id) || keys.includes(key)) continue;
      keys = [...keys, key];
      index = keys.length - 1;
    } else {
      // Already counted: it may have received its server id since, which joins its names.
      const added = aliases.filter((alias) => !known[index].includes(alias));
      if (added.length === 0) continue;
      keys = [...keys];
      keys[index] = [...known[index], ...added].join('|');
    }
    known[index] = splitAliases(keys[index]);
    own(known[index], index);
  }
  return keys === stored ? ledger : { ...ledger, keys: { ...ledger.keys, [id]: keys } };
}

const addDream = (ledger: BadgeLedger, id: BadgeFamilyId, dream: BadgeDreamRef) =>
  addDreamAliases(ledger, id, [dreamAliases(dream)]);

function raiseBest(ledger: BadgeLedger, id: BadgeFamilyId, value: number): BadgeLedger {
  if (!Number.isFinite(value) || value <= (ledger.best[id] ?? 0)) return ledger;
  return { ...ledger, best: { ...ledger.best, [id]: value } };
}

/** Whole local days between a dream's saving and now; 0 on the day it was saved. */
function daysSinceSaved(dream: BadgeDreamRef, now: number): number {
  if (!Number.isFinite(dream.id) || !Number.isFinite(now)) return 0;
  return Math.max(0, differenceInCalendarDays(now, dream.id));
}

/** Folds one successful action into the ledger. Repeating it changes nothing. */
export function applyBadgeEvent(ledger: BadgeLedger, event: BadgeEvent): BadgeLedger {
  switch (event.type) {
    case 'dream_saved': {
      if (event.input === 'text') return addDream(ledger, 'ink-dreamer', event.dream);
      if (event.input === 'voice') return addDream(ledger, 'night-voice', event.dream);
      return ledger;
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

export type JournalReading = {
  saved: string[][];
  days: Set<string>;
  weeks: Set<string>;
  months: Set<string>;
  remembered: string[][];
  favorites: string[][];
  pictured: string[][];
};

/** What the journal itself tells, read again on every pass. */
export function readBadgeJournal(dreams: readonly DreamAnalysis[]): JournalReading {
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

/** A family's value from what the ledger itself holds: its longest gap, dreams or keys. */
function storedProgress(ledger: BadgeLedger, family: BadgeFamily): number {
  if (family.unit === 'max_days') return ledger.best[family.id] ?? 0;
  if (family.unit === 'dream') return countDistinctDreams(storedGroups(ledger, family.id));
  return (ledger.keys[family.id] ?? []).length;
}

/** Every family's value from the ledger and a journal already read. */
export function progressFromJournal(ledger: BadgeLedger, reading: JournalReading): Record<BadgeFamilyId, number> {
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
    const kept = family.fromJournal ? ledger.best[family.id] ?? 0 : 0;
    progress[family.id] = Math.max(fromJournal[family.id] ?? 0, storedProgress(ledger, family), kept);
  }
  return progress;
}

/** Every family's current value, from the ledger and the journal as they are now. */
export function computeBadgeProgress(
  ledger: BadgeLedger,
  dreams: readonly DreamAnalysis[],
): Record<BadgeFamilyId, number> {
  return progressFromJournal(ledger, readBadgeJournal(dreams));
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
  const reading = readBadgeJournal(dreams);
  let next = ledger;
  // Keep identities as well as maxima: disjoint devices and later-deleted dreams must
  // contribute once when their histories meet. A maximum alone cannot be added safely.
  next = addDreamAliases(next, 'night-journal', reading.saved);
  for (const key of reading.days) next = addKey(next, 'gentle-rhythm', key);
  for (const key of reading.weeks) next = addKey(next, 'night-thread', key);
  for (const key of reading.months) next = addKey(next, 'moon-cycles', key);
  next = addDreamAliases(next, 'memory-keeper', reading.remembered);
  next = addDreamAliases(next, 'treasure-keeper', reading.favorites);
  next = addDreamAliases(next, 'dream-painter', reading.pictured);
  const progress = progressFromJournal(next, reading);
  for (const family of BADGE_FAMILIES) {
    if (family.fromJournal) next = raiseBest(next, family.id, progress[family.id]);
    next = stamp(next, family, progress[family.id], now);
  }
  return next;
}

function stamp(ledger: BadgeLedger, family: BadgeFamily, value: number, now: number): BadgeLedger {
  const earned = ledger.earned[family.id] ?? [];
  const reached = tierForProgress(family.thresholds, value);
  if (reached <= earned.length) return ledger;
  const stamps = [...earned];
  while (stamps.length < reached) stamps.push(now);
  return { ...ledger, earned: { ...ledger.earned, [family.id]: stamps } };
}

/**
 * Stamps the tiers that actions alone earn (readings, searches, edits), the moment they are
 * earned: those families never wait for the journal to change.
 */
export function stampActionTiers(ledger: BadgeLedger, now: number): BadgeLedger {
  let next = ledger;
  for (const family of BADGE_FAMILIES) {
    if (!family.fromJournal) next = stamp(next, family, storedProgress(ledger, family), now);
  }
  return next;
}

/** Marks a family's tiers as unveiled up to the one the collection showed. */
export function revealBadgeFamily(ledger: BadgeLedger, id: BadgeFamilyId, shown: BadgeTierLevel): BadgeLedger {
  if ((ledger.revealed[id] ?? 0) >= shown) return ledger;
  return { ...ledger, revealed: { ...ledger.revealed, [id]: shown } };
}

/**
 * What a guest ledger may hand to an account: its actions only. What the guest journal told
 * is read again from the account's own journal, which holds the dreams that really moved.
 */
export function actionsOnly(ledger: BadgeLedger): BadgeLedger {
  const keep = <T,>(record: Partial<Record<BadgeFamilyId, T>>) => Object.fromEntries(
    Object.entries(record).filter(([id]) => !getBadgeFamily(id)?.fromJournal),
  ) as Partial<Record<BadgeFamilyId, T>>;
  return {
    version: ledger.version,
    keys: keep(ledger.keys),
    best: keep(ledger.best),
    earned: keep(ledger.earned),
    revealed: keep(ledger.revealed),
  };
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

/** How far along the way from the tier held to the next one, in percent; 100 once gold is held. */
export function nextTierPercent(state: BadgeFamilyState): number {
  if (state.nextThreshold == null) return 100;
  const previous = state.tier === 0 ? 0 : state.family.thresholds[state.tier - 1];
  return ((state.progress - previous) / Math.max(1, state.nextThreshold - previous)) * 100;
}

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
    const tier = Math.max(earnedAt.length, tierForProgress(family.thresholds, value)) as BadgeTierLevel;
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

/**
 * Reads a stored ledger, keeping every well-formed family and dropping the rest. Anything
 * that is not a ledger of this version gives null: an empty ledger in its place would let
 * a write lose every tier it holds.
 */
export function parseBadgeLedger(raw: unknown): BadgeLedger | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<Record<keyof BadgeLedger, unknown>>;
  if (value.version !== BADGE_LEDGER_VERSION) return null;
  const ledger = createEmptyBadgeLedger();
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
    const family = getBadgeFamily(id);
    if (!family) continue;
    if (family.unit === 'dream') next = addDreamAliases(next, id, keys.map(splitAliases));
    else for (const key of keys) next = addKey(next, id, key);
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
