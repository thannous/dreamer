import { describe, expect, it } from '@jest/globals';

import { BADGE_CARD_COUNT, BADGE_FAMILIES, getBadgeFamily } from '@/lib/badges/catalog';
import {
  applyBadgeEvent,
  buildBadgeCollection,
  computeBadgeProgress,
  countDistinctDreams,
  createEmptyBadgeLedger,
  countStoryWords,
  mergeBadgeLedgers,
  parseBadgeLedger,
  revealBadgeFamily,
  settleBadgeLedger,
  stampActionTiers,
  type BadgeEvent,
  type BadgeLedger,
} from '@/lib/badges/ledger';
import type { DreamAnalysis } from '@/lib/types';

const DAY = 24 * 60 * 60 * 1000;
// Local noon keeps every fixture on its own local day whatever the test runner's zone.
const at = (date: string) => new Date(`${date}T12:00:00`).getTime();

const dream = (id: number, extra: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id,
  clientRequestId: `req-${id}`,
  transcript: 'A quiet sea under a lantern.',
  title: 'Sea',
  interpretation: '',
  shareableQuote: '',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  ...extra,
});

const fold = (events: BadgeEvent[], ledger: BadgeLedger = createEmptyBadgeLedger()) =>
  events.reduce(applyBadgeEvent, ledger);

const progressOf = (ledger: BadgeLedger, dreams: DreamAnalysis[] = []) => computeBadgeProgress(ledger, dreams);

const note = (createdAt: number) => ({ id: `note-${createdAt}`, text: 'Seen again.', createdAt, updatedAt: createdAt });
const stateOf = (ledger: BadgeLedger, dreams: DreamAnalysis[], id: string) =>
  buildBadgeCollection(ledger, progressOf(ledger, dreams)).families.find((entry) => entry.family.id === id)!;

describe('badge catalogue', () => {
  it('holds nine families of three or five rising tiers and six cards earned once', () => {
    expect(BADGE_FAMILIES).toHaveLength(15);
    expect(new Set(BADGE_FAMILIES.map((family) => family.id)).size).toBe(15);
    for (const family of BADGE_FAMILIES) {
      expect([1, 3, 5]).toContain(family.thresholds.length);
      expect(family.thresholds[0]).toBeGreaterThan(0);
      family.thresholds.slice(1).forEach((threshold, index) => expect(threshold).toBeGreaterThan(family.thresholds[index]));
      expect(family.thresholds.length === 1).toBe(family.chapter === 'firsts');
    }
    expect(BADGE_FAMILIES.filter((family) => family.thresholds.length === 5).map((family) => family.id))
      .toEqual(['night-journal', 'moon-cycles', 'dream-reader', 'time-traveler', 'symbol-explorer']);
    expect(BADGE_CARD_COUNT).toBe(43);
    // The gold card of the guides asks for every one of the eight guides.
    expect(getBadgeFamily('night-scholar')?.thresholds).toEqual([1, 4, 8]);
  });
});

describe('badge ledger', () => {
  it('counts a retried save, the same dream after sync and a repeated reading once', () => {
    const saved = dream(at('2026-10-01'));
    const synced = { ...saved, id: saved.id + 5000, remoteId: 42 };
    const ledger = fold([
      { type: 'dream_shared', dream: saved },
      { type: 'dream_shared', dream: saved },
      { type: 'dream_shared', dream: synced },
      { type: 'symbol_read', symbolId: 'water' },
      { type: 'symbol_read', symbolId: 'water' },
      { type: 'guide_completed', guideId: 'dream-journal' },
      { type: 'guide_completed', guideId: 'dream-journal' },
    ]);
    const progress = progressOf(ledger);
    expect(progress['night-echoes']).toBe(1);
    expect(progress['symbol-explorer']).toBe(1);
    expect(progress['night-scholar']).toBe(1);
  });

  it('discovers the voice and the assistant only through what the capture did', () => {
    const ledger = fold([
      { type: 'dream_saved', dream: dream(1), voiced: true, answered: false },
      { type: 'dream_saved', dream: dream(2), voiced: false, answered: true },
      // A restored draft alone says neither.
      { type: 'dream_saved', dream: dream(3), voiced: false, answered: false },
    ]);
    expect(progressOf(ledger)['night-voice']).toBe(1);
    expect(progressOf(ledger)['dream-questions']).toBe(1);
    const nothing = fold([{ type: 'dream_saved', dream: dream(3), voiced: false, answered: false }]);
    expect(progressOf(nothing)['night-voice']).toBe(0);
    expect(progressOf(nothing)['dream-questions']).toBe(0);
  });

  it('counts a story completed by at least twenty words, once per dream', () => {
    expect(countStoryWords('  a quiet\nsea  under the moon ')).toBe(6);
    const ledger = fold([
      { type: 'narrative_enriched', dream: dream(1), addedWords: 19 },
      { type: 'narrative_enriched', dream: dream(2), addedWords: 20 },
      { type: 'narrative_enriched', dream: dream(2), addedWords: 40 },
    ]);
    expect(progressOf(ledger)['dream-weaver']).toBe(1);
  });

  it('counts a note only from the day after its dream, keeps the longest gap and survives the note', () => {
    const saved = at('2026-09-01');
    const sameDay = [dream(saved, { personalNotes: [note(saved + 3 * 60 * 60 * 1000)] })];
    expect(progressOf(createEmptyBadgeLedger(), sameDay)['dream-reader']).toBe(0);

    const dreams = [
      dream(saved, { personalNotes: [note(at('2026-09-03')), note(at('2026-10-01'))] }),
      dream(at('2026-09-10'), { personalNotes: [note(at('2026-09-12'))] }),
    ];
    const progress = progressOf(createEmptyBadgeLedger(), dreams);
    expect(progress['dream-reader']).toBe(2);
    expect(progress['time-traveler']).toBe(30);
    // Deleted notes take nothing back once the ledger has seen them.
    const settled = settleBadgeLedger(createEmptyBadgeLedger(), dreams, at('2026-10-02'));
    const withoutNotes = dreams.map((entry) => ({ ...entry, personalNotes: [] }));
    expect(progressOf(settled, withoutNotes)).toMatchObject({ 'dream-reader': 2, 'time-traveler': 30 });
    expect(settled.earned['time-traveler']).toEqual([at('2026-10-02'), at('2026-10-02')]);
  });

  it('counts days, not consecutive days, for a first search or a first look at Trends', () => {
    const ledger = fold([
      { type: 'journal_result_opened', now: at('2026-10-01') },
      { type: 'journal_result_opened', now: at('2026-10-01') + 60_000 },
      { type: 'trends_opened', now: at('2026-10-02') },
    ]);
    const progress = progressOf(ledger);
    expect(progress['dream-seeker']).toBe(1);
    expect(progress.observatory).toBe(1);
    expect(stampActionTiers(ledger, 7).earned).toMatchObject({ 'dream-seeker': [7], observatory: [7] });
  });

  it('reads the journal it was given: dreams, months, memories, favourites and images', () => {
    const dreams = [
      dream(at('2026-01-05')),
      dream(at('2026-01-05') + 60_000),
      dream(at('2026-03-15'), { memory: { origin: 'remembered', createdFrom: 'journal' } }),
      // The same memories as the journal's own filter, a Lucid hand-over included.
      dream(at('2026-03-16'), { memory: { origin: 'remembered', createdFrom: 'lucid_trainer' } }),
      dream(at('2026-03-17'), { imageSource: 'user', imageUrl: 'file:///kept.webp', syncState: 'clean', isFavorite: true }),
      // An upload still pending, or stripped after failing, is not an added image yet.
      dream(at('2026-03-18'), { imageSource: 'user', imageUrl: 'file:///pending.webp', syncState: 'pending' }),
      dream(at('2026-03-19'), { imageSource: 'user', imageUrl: '' }),
    ];
    const progress = progressOf(createEmptyBadgeLedger(), dreams);
    expect(progress['night-journal']).toBe(7);
    expect(progress['moon-cycles']).toBe(2);
    expect(progress['memory-keeper']).toBe(2);
    expect(progress['treasure-keeper']).toBe(1);
    expect(progress['dream-painter']).toBe(1);
  });

  it('keeps earned tiers, favourites and counts past the stored identities after dreams are deleted', () => {
    const dreams = Array.from({ length: 160 }, (_, index) => dream(at('2026-02-01') + index * 60_000, { isFavorite: index < 2 }));
    const settled = settleBadgeLedger(createEmptyBadgeLedger(), dreams, at('2026-03-01'));
    expect(settled.earned['night-journal']).toHaveLength(5);
    // At most 150 identities are kept; the count above them is the family's best.
    expect(settled.keys['night-journal']).toHaveLength(150);

    // After a long pause, with most dreams gone and no favourite left:
    const remaining = dreams.slice(0, 2).map((entry) => ({ ...entry, isFavorite: false }));
    const later = settleBadgeLedger(settled, remaining, at('2026-09-01'));
    expect(stateOf(later, remaining, 'night-journal')).toMatchObject({ tier: 5, progress: 160, nextThreshold: null });
    expect(stateOf(later, remaining, 'treasure-keeper')).toMatchObject({ tier: 1, nextThreshold: null });
    expect(later.earned['night-journal']).toEqual(settled.earned['night-journal']);
  });

  it('reaches the diamond with dreams written after others were deleted', () => {
    const first = Array.from({ length: 100 }, (_, index) => dream(at('2026-02-01') + index * 60_000));
    const settled = settleBadgeLedger(createEmptyBadgeLedger(), first, at('2026-03-01'));
    const others = Array.from({ length: 50 }, (_, index) => dream(at('2026-05-01') + index * 60_000));
    const later = settleBadgeLedger(settled, others, at('2026-06-01'));
    expect(stateOf(later, others, 'night-journal')).toMatchObject({ tier: 5, progress: 150, nextThreshold: null });
  });

  it('counts families by tier and the first steps apart', () => {
    const dreams = Array.from({ length: 10 }, (_, index) => dream(at('2026-02-01') + index * DAY, { isFavorite: index === 0 }));
    const settled = settleBadgeLedger(createEmptyBadgeLedger(), dreams, at('2026-03-01'));
    const collection = buildBadgeCollection(settled, progressOf(settled, dreams));
    expect(collection.counts).toEqual({ bronze: 1, silver: 1, gold: 0, platinum: 0, diamond: 0 });
    expect(collection.firsts).toBe(1);
    expect(collection.earnedCards).toBe(3);
  });

  it('counts the same dream once across its local, client and server names', () => {
    expect(countDistinctDreams([['c:a', 'l:1'], ['r:9', 'l:2'], ['c:a', 'r:9'], ['c:b']])).toBe(2);
  });

  it('settles to the same ledger when nothing changed, and unveils earned tiers once', () => {
    const dreams = [dream(at('2026-10-01'))];
    const settled = settleBadgeLedger(createEmptyBadgeLedger(), dreams, at('2026-10-01'));
    expect(settleBadgeLedger(settled, dreams, at('2026-10-02'))).toBe(settled);
    expect(buildBadgeCollection(settled, progressOf(settled, dreams)).unrevealedCards).toBe(1);
    const revealed = revealBadgeFamily(settled, 'night-journal', 1);
    expect(buildBadgeCollection(revealed, progressOf(revealed, dreams)).unrevealedCards).toBe(0);
    expect(revealBadgeFamily(revealed, 'night-journal', 1)).toBe(revealed);
  });

  it('stamps a tier earned by actions without a journal, and keeps a card turned at the tier it showed', () => {
    const read = fold([1, 2, 3].map((index) => ({ type: 'symbol_read', symbolId: `s${index}` }) as BadgeEvent));
    expect(stampActionTiers(read, 42).earned['symbol-explorer']).toEqual([42]);
    // A tier the album showed from progress, before the journal stamped it, stays turned over.
    // A remote silver award arriving while bronze is open must remain unrevealed.
    // This interleaving is isolated because it cannot be scheduled reliably in browser E2E.
    const ahead = { ...createEmptyBadgeLedger(), earned: { 'night-journal': [1, 2] } };
    expect(revealBadgeFamily(ahead, 'night-journal', 1).revealed['night-journal']).toBe(1);
    const shown = revealBadgeFamily(createEmptyBadgeLedger(), 'night-journal', 1);
    const settled = settleBadgeLedger(shown, [dream(at('2026-10-01'))], at('2026-10-01'));
    expect(buildBadgeCollection(settled, progressOf(settled, [dream(at('2026-10-01'))])).unrevealedCards).toBe(0);
  });

  it('survives a corrupt store, drops tiers a family does not have, and keeps both sides of a guest join', () => {
    expect(parseBadgeLedger('not json')).toBeNull();
    expect(parseBadgeLedger({ version: 3, keys: {} })).toBeNull();
    expect(parseBadgeLedger({ version: 2, keys: { 'night-voice': 'x', unknown: ['a'] }, earned: { 'night-voice': [1, 2] } }))
      .toEqual(createEmptyBadgeLedger());

    const guest = fold([{ type: 'symbol_read', symbolId: 'moon' }, { type: 'dream_shared', dream: dream(1) }]);
    const account = fold([{ type: 'symbol_read', symbolId: 'water' }, { type: 'dream_shared', dream: dream(1) }]);
    const merged = mergeBadgeLedgers(
      { ...account, earned: { 'night-echoes': [200] } },
      { ...guest, earned: { 'night-echoes': [100] } },
    );
    expect(progressOf(merged)['symbol-explorer']).toBe(2);
    expect(progressOf(merged)['night-echoes']).toBe(1);
    expect(merged.earned['night-echoes']).toEqual([100]);
    expect(parseBadgeLedger(JSON.parse(JSON.stringify(merged)))).toEqual(merged);
  });

  it('brings a first-collection ledger over without losing a tier of a family that stays', () => {
    const converted = parseBadgeLedger({
      version: 1,
      keys: {
        'night-journal': ['c:a|l:1'], 'moon-cycles': ['2026-09', '2026-10'], 'symbol-explorer': ['water', 'moon', 'sun'],
        'dream-seeker': ['2026-10-01'], 'path-finder': ['2026-09-20', '2026-09-21', '2026-09-22'],
        'gentle-rhythm': ['2026-10-01'], 'ink-dreamer': ['c:a|l:1'],
      },
      best: { 'night-journal': 25, 'time-traveler': 40 },
      earned: {
        'night-journal': [10, 20], 'symbol-explorer': [30], 'path-finder': [5], 'observatory': [8],
        'gentle-rhythm': [3], 'night-voice': [6],
      },
      revealed: { 'night-journal': 2, 'symbol-explorer': 1, 'observatory': 1 },
    })!;
    // Kept whole.
    expect(converted.keys['night-journal']).toEqual(['c:a|l:1']);
    expect(converted.best['night-journal']).toBe(25);
    expect(converted.earned['night-journal']).toEqual([10, 20]);
    expect(converted.revealed['night-journal']).toBe(2);
    // A rule that changed keeps its tiers, not what the old rule counted.
    expect(converted.earned['symbol-explorer']).toEqual([30]);
    expect(converted.revealed['symbol-explorer']).toBe(1);
    expect(converted.keys['symbol-explorer']).toBeUndefined();
    expect(converted.best['time-traveler']).toBeUndefined();
    // A bronze becomes the card earned once, at the earliest date of its families.
    expect(converted.earned['dream-seeker']).toEqual([5]);
    expect(converted.earned['observatory']).toEqual([8]);
    expect(converted.revealed['observatory']).toBe(1);
    expect(converted.earned['night-voice']).toEqual([6]);
    // Retired families leave nothing behind.
    expect(Object.keys(converted.earned)).not.toContain('gentle-rhythm');
    expect(Object.keys(converted.keys)).not.toContain('ink-dreamer');
    expect(converted.version).toBe(2);
  });
});
