/**
 * The collection's memory: what has been done, once per dream, day, month or entry, and the
 * tiers already earned.
 *
 * Nothing in here reads or keeps a dream's words. A dream is remembered by its identity
 * aliases only, a day or a month by its local date, an entry by its id. What the journal
 * itself can tell (how many dreams, in which months, which were noted again, marked or
 * pictured) is read from it again on every pass, so a history kept before the collection
 * existed counts. The other families start from their first recorded action.
 */
import { isRememberedDream } from '@/lib/dreamFilters';
import { getLocalDateKey } from '@/lib/dreamTrends';
import { getDreamSyncState } from '@/lib/dreamUtils';
import { differenceInCalendarDays } from '@/lib/engagementReminders';
import type { DreamAnalysis } from '@/lib/types';

import {
  BADGE_FAMILIES,
  getBadgeFamily,
  isBadgeFamilyId,
  tierCount,
  tierForProgress,
  type BadgeFamily,
  type BadgeFamilyId,
  type BadgeTierLevel,
} from './catalog';

export const BADGE_LEDGER_VERSION = 2;

export type BadgeLedger = {
  version: typeof BADGE_LEDGER_VERSION;
  /**
   * What was counted per family: a dream as its aliases joined by `|`, a day or a month by
   * its local key, an entry by its id. A family stops adding once its last tier is reached.
   */
  keys: Partial<Record<BadgeFamilyId, string[]>>;
  /**
   * The highest value reached: the longest gap a note spanned, and for the families read
   * from the journal, the most they ever counted. A deleted dream lowers nothing.
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

export type BadgeDreamRef = Pick<DreamAnalysis, 'id' | 'remoteId' | 'clientRequestId'>;

/** The fields of a dream an event needs, so a whole dream is not kept with it. */
export const dreamRef = ({ id, remoteId, clientRequestId }: BadgeDreamRef): BadgeDreamRef =>
  ({ id, remoteId, clientRequestId });

/** Words a saved story must gain for the weaver to count it: a detail recalled, not a typo. */
export const NARRATIVE_ENRICHMENT_WORDS = 20;

/** The words of a story, as the weaver counts them. */
export const countStoryWords = (text: string): number => text.split(/\s+/).filter(Boolean).length;

/**
 * A successful action. Notes, favourites, old memories and personal images are not events:
 * the journal shows them once they are durably there, and the ledger keeps what it saw.
 */
export type BadgeEvent =
  /** A new dream reached durable storage: its words told aloud, or completed with the assistant. */
  | { type: 'dream_saved'; dream: BadgeDreamRef; voiced: boolean; answered: boolean }
  /** A saved dream's story was completed by hand; `addedWords` is how many words it gained. */
  | { type: 'narrative_enriched'; dream: BadgeDreamRef; addedWords: number }
  /** A journal result was opened while a search or a filter narrowed the list. */
  | { type: 'journal_result_opened'; now: number }
  /** A dictionary entry was read to its end. */
  | { type: 'symbol_read'; symbolId: string }
  /** A guide was explicitly marked completed. */
  | { type: 'guide_completed'; guideId: string }
  /** Trends opened over at least one dream. */
  | { type: 'trends_opened'; now: number }
  /** The share sheet opened with a dream's card; whether it was then sent cannot be known. */
  | { type: 'dream_shared'; dream: BadgeDreamRef };

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

/** The account copy keeps at most this many keys per family; past it, `best` holds the count. */
const KEY_LIMIT = 100;
const keyCap = (id: BadgeFamilyId) => {
  const thresholds = getBadgeFamily(id)!.thresholds;
  return Math.min(thresholds[thresholds.length - 1], KEY_LIMIT);
};

/** Adds one distinct key; the same ledger comes back when nothing changed. */
function addKey(ledger: BadgeLedger, id: BadgeFamilyId, key: string): BadgeLedger {
  const keys = ledger.keys[id] ?? [];
  if (keys.includes(key) || keys.length >= keyCap(id)) return ledger;
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
      if (keys.length >= keyCap(id) || keys.includes(key)) continue;
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

/** Folds one successful action into the ledger. Repeating it changes nothing. */
export function applyBadgeEvent(ledger: BadgeLedger, event: BadgeEvent): BadgeLedger {
  switch (event.type) {
    case 'dream_saved': {
      let next = ledger;
      if (event.voiced) next = addDream(next, 'night-voice', event.dream);
      if (event.answered) next = addDream(next, 'dream-questions', event.dream);
      return next;
    }
    case 'narrative_enriched':
      return event.addedWords >= NARRATIVE_ENRICHMENT_WORDS ? addDream(ledger, 'dream-weaver', event.dream) : ledger;
    case 'journal_result_opened':
      return addKey(ledger, 'dream-seeker', dayKey(event.now));
    case 'symbol_read':
      return event.symbolId.trim() ? addKey(ledger, 'symbol-explorer', event.symbolId.trim()) : ledger;
    case 'guide_completed':
      return event.guideId.trim() ? addKey(ledger, 'night-scholar', event.guideId.trim()) : ledger;
    case 'trends_opened':
      return addKey(ledger, 'observatory', dayKey(event.now));
    case 'dream_shared':
      return addDream(ledger, 'night-echoes', event.dream);
  }
}

// ------------------------------------------------------------------------------ progress --

/** A personal image that stayed: a failed upload strips it, so only a settled one counts. */
const hasChosenImage = (dream: DreamAnalysis) =>
  dream.imageSource === 'user' && Boolean(dream.imageUrl) && getDreamSyncState(dream) === 'clean';

/** The longest gap, in local days, between a dream and a note added to it; -1 without one. */
function longestNoteGap(dream: DreamAnalysis): number {
  let longest = -1;
  if (!Number.isFinite(dream.id)) return longest;
  for (const note of dream.personalNotes ?? []) {
    if (Number.isFinite(note.createdAt)) longest = Math.max(longest, differenceInCalendarDays(note.createdAt, dream.id));
  }
  return longest;
}

export type JournalReading = {
  saved: string[][];
  months: Set<string>;
  remembered: string[][];
  /** Dreams a note was added to on a later local day than the dream itself. */
  annotated: string[][];
  /** The longest of those gaps, in days; 0 without one. */
  longestGap: number;
  favorites: string[][];
  pictured: string[][];
};

/** What the journal itself tells, read again on every pass. */
export function readBadgeJournal(dreams: readonly DreamAnalysis[]): JournalReading {
  const reading: JournalReading = {
    saved: [],
    months: new Set(),
    remembered: [],
    annotated: [],
    longestGap: 0,
    favorites: [],
    pictured: [],
  };
  for (const dream of dreams) {
    const aliases = dreamAliases(dream);
    if (aliases.length === 0) continue;
    reading.saved.push(aliases);
    if (Number.isFinite(dream.id)) reading.months.add(monthKey(dream.id));
    if (isRememberedDream(dream)) reading.remembered.push(aliases);
    const gap = longestNoteGap(dream);
    if (gap >= 1) {
      reading.annotated.push(aliases);
      reading.longestGap = Math.max(reading.longestGap, gap);
    }
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
  // Noted, marked or pictured once is enough: a note, favourite or image let go since still counts.
  const seen = (id: BadgeFamilyId, groups: string[][]) => countDistinctDreams([...storedGroups(ledger, id), ...groups]);
  const fromJournal: Partial<Record<BadgeFamilyId, number>> = {
    'night-journal': countDistinctDreams(reading.saved),
    'moon-cycles': reading.months.size,
    'memory-keeper': countDistinctDreams(reading.remembered),
    'dream-reader': seen('dream-reader', reading.annotated),
    'time-traveler': reading.longestGap,
    'treasure-keeper': seen('treasure-keeper', reading.favorites),
    'dream-painter': seen('dream-painter', reading.pictured),
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
 * Keeps what the journal showed (its highest counts, each note, favourite and image seen) and
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
  for (const key of reading.months) next = addKey(next, 'moon-cycles', key);
  next = addDreamAliases(next, 'memory-keeper', reading.remembered);
  next = addDreamAliases(next, 'dream-reader', reading.annotated);
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
 * Stamps the tiers that actions alone earn (readings, completed stories, shares), the moment
 * they are earned: those families never wait for the journal to change.
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
 * The tiers of a family whose rule changed go too: the first collection earned them by actions.
 */
export function actionsOnly(ledger: BadgeLedger): BadgeLedger {
  const keep = <T,>(record: Partial<Record<BadgeFamilyId, T>>, earnedByActions = false) => Object.fromEntries(
    Object.entries(record).filter(([id]) =>
      !getBadgeFamily(id)?.fromJournal || (earnedByActions && V1_REDONE.includes(id as BadgeFamilyId))),
  ) as Partial<Record<BadgeFamilyId, T>>;
  return {
    version: ledger.version,
    keys: keep(ledger.keys),
    best: keep(ledger.best),
    earned: keep(ledger.earned, true),
    revealed: keep(ledger.revealed, true),
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
  /** The next threshold, or null once the last tier is earned. */
  nextThreshold: number | null;
  /** Earned tiers the collection has not unveiled yet. */
  unrevealed: number;
};

/** How far along the way from the tier held to the next one, in percent; 100 once complete. */
export function nextTierPercent(state: BadgeFamilyState): number {
  if (state.nextThreshold == null) return 100;
  const previous = state.tier === 0 ? 0 : state.family.thresholds[state.tier - 1];
  return ((state.progress - previous) / Math.max(1, state.nextThreshold - previous)) * 100;
}

export type BadgeCollection = {
  families: BadgeFamilyState[];
  earnedCards: number;
  unrevealedCards: number;
  /** Families holding at least that tier, cards earned once aside. */
  counts: { bronze: number; silver: number; gold: number; platinum: number; diamond: number };
  /** Cards earned once that are held. */
  firsts: number;
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
      nextThreshold: family.thresholds[tier] ?? null,
      unrevealed: Math.max(0, tier - (ledger.revealed[family.id] ?? 0)),
    };
  });
  const tiered = families.filter((state) => state.family.thresholds.length > 1);
  const holding = (level: number) => tiered.filter((state) => state.tier >= level).length;
  return {
    families,
    earnedCards: families.reduce((sum, state) => sum + state.tier, 0),
    unrevealedCards: families.reduce((sum, state) => sum + state.unrevealed, 0),
    counts: { bronze: holding(1), silver: holding(2), gold: holding(3), platinum: holding(4), diamond: holding(5) },
    firsts: families.filter((state) => state.family.thresholds.length === 1 && state.tier >= 1).length,
  };
}

// ------------------------------------------------------------------------- stored ledgers --

type LedgerFields = {
  keys: Record<string, string[]>;
  best: Record<string, number>;
  earned: Record<string, number[]>;
  revealed: Record<string, number>;
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
const entriesOf = (field: unknown) =>
  field && typeof field === 'object' && !Array.isArray(field) ? Object.entries(field as Record<string, unknown>) : [];

/** Reads every well-formed family of a stored ledger and drops the rest. */
function readLedgerFields(
  value: Record<string, unknown>,
  isFamily: (id: string) => boolean,
  keyLimit: (id: string) => number,
  tiers: (id: string) => number,
): LedgerFields {
  const fields: LedgerFields = { keys: {}, best: {}, earned: {}, revealed: {} };
  for (const [id, keys] of entriesOf(value.keys)) {
    if (isFamily(id) && isStringArray(keys)) fields.keys[id] = [...new Set(keys)].slice(0, keyLimit(id));
  }
  for (const [id, best] of entriesOf(value.best)) {
    if (isFamily(id) && typeof best === 'number' && Number.isFinite(best) && best > 0) fields.best[id] = best;
  }
  for (const [id, stamps] of entriesOf(value.earned)) {
    if (isFamily(id) && Array.isArray(stamps) && stamps.length <= tiers(id)
      && stamps.every((item) => typeof item === 'number' && Number.isFinite(item))) fields.earned[id] = stamps;
  }
  for (const [id, level] of entriesOf(value.revealed)) {
    if (isFamily(id) && Number.isInteger(level) && (level as number) >= 1 && (level as number) <= tiers(id)) {
      fields.revealed[id] = level as number;
    }
  }
  return fields;
}

/** The twenty families of the first collection, before it was narrowed on 24 October 2026. */
const V1_FAMILY_IDS = new Set(['night-journal', 'gentle-rhythm', 'night-thread', 'moon-cycles', 'ink-dreamer',
  'night-voice', 'memory-keeper', 'dream-reader', 'time-traveler', 'treasure-keeper', 'favorite-echoes',
  'dream-weaver', 'dream-namer', 'night-cartographer', 'dream-seeker', 'path-finder', 'symbol-explorer',
  'night-scholar', 'observatory', 'dream-painter']);
/** Families kept whole: what they counted still counts the same way. */
const V1_KEPT: readonly BadgeFamilyId[] = ['night-journal', 'moon-cycles', 'memory-keeper', 'night-scholar'];
/** Families whose rule changed: tiers earned and turned over stay, progress starts again. */
const V1_REDONE: readonly BadgeFamilyId[] = ['dream-reader', 'time-traveler', 'dream-weaver', 'symbol-explorer'];
/** Families that became a card earned once: the earliest bronze among them is that card. */
const V1_FIRSTS: readonly [BadgeFamilyId, readonly string[]][] = [
  ['night-voice', ['night-voice']],
  ['treasure-keeper', ['treasure-keeper']],
  ['dream-painter', ['dream-painter']],
  ['dream-seeker', ['dream-seeker', 'path-finder']],
  ['observatory', ['observatory']],
];

/**
 * Brings a first-collection ledger to the current one. Nothing earned in a family that stays
 * is lost; the families retired with it leave no card.
 */
function convertLedgerV1(v1: LedgerFields): BadgeLedger {
  const ledger = createEmptyBadgeLedger();
  for (const id of V1_KEPT) {
    if (v1.keys[id]) ledger.keys[id] = v1.keys[id].slice(0, keyCap(id));
    if (v1.best[id]) ledger.best[id] = v1.best[id];
  }
  for (const id of [...V1_KEPT, ...V1_REDONE]) {
    const tiers = tierCount(getBadgeFamily(id)!);
    if (v1.earned[id]) ledger.earned[id] = v1.earned[id].slice(0, tiers);
    if (v1.revealed[id]) ledger.revealed[id] = Math.min(v1.revealed[id], tiers) as BadgeTierLevel;
  }
  for (const [id, sources] of V1_FIRSTS) {
    const bronzes = sources.map((source) => v1.earned[source]?.[0]).filter((at): at is number => at != null);
    if (bronzes.length) ledger.earned[id] = [Math.min(...bronzes)];
    if (sources.some((source) => (v1.revealed[source] ?? 0) >= 1)) ledger.revealed[id] = 1;
    const seen = sources.map((source) => v1.keys[source]?.[0]).find(Boolean);
    if (seen) ledger.keys[id] = [seen];
  }
  return ledger;
}

/**
 * Reads a stored ledger, keeping every well-formed family and dropping the rest; a ledger of
 * the first collection is brought to the current one. Anything else gives null: an empty
 * ledger in its place would let a write lose every tier it holds.
 */
export function parseBadgeLedger(raw: unknown): BadgeLedger | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (value.version === BADGE_LEDGER_VERSION) {
    const tiers = (id: string) => tierCount(getBadgeFamily(id)!);
    const fields = readLedgerFields(value, isBadgeFamilyId, (id) => keyCap(id as BadgeFamilyId), tiers);
    return { version: BADGE_LEDGER_VERSION, ...fields } as BadgeLedger;
  }
  if (value.version === 1) {
    return convertLedgerV1(readLedgerFields(value, (id) => V1_FAMILY_IDS.has(id), () => KEY_LIMIT, () => 3));
  }
  return null;
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
