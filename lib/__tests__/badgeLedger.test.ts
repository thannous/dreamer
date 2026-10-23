import { describe, expect, it } from '@jest/globals';

import { BADGE_FAMILIES, getBadgeFamily } from '@/lib/badges/catalog';
import {
  applyBadgeEvent,
  buildBadgeCollection,
  computeBadgeProgress,
  countDistinctDreams,
  createEmptyBadgeLedger,
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

describe('badge catalogue', () => {
  it('holds twenty families of three strictly rising tiers, with the eight guides as gold', () => {
    expect(BADGE_FAMILIES).toHaveLength(20);
    expect(new Set(BADGE_FAMILIES.map((family) => family.id)).size).toBe(20);
    for (const family of BADGE_FAMILIES) {
      const [bronze, silver, gold] = family.thresholds;
      expect(bronze).toBeGreaterThan(0);
      expect(silver).toBeGreaterThan(bronze);
      expect(gold).toBeGreaterThan(silver);
    }
    expect(getBadgeFamily('night-scholar')?.thresholds).toEqual([2, 4, 8]);
  });
});

describe('badge ledger', () => {
  it('counts a retried save, the same dream after sync and a repeated reading once', () => {
    const saved = dream(at('2026-10-01'));
    const synced = { ...saved, id: saved.id + 5000, remoteId: 42 };
    const ledger = fold([
      { type: 'dream_saved', dream: saved, input: 'text' },
      { type: 'dream_saved', dream: saved, input: 'text' },
      { type: 'dream_saved', dream: synced, input: 'text' },
      { type: 'symbol_viewed', symbolId: 'water' },
      { type: 'symbol_viewed', symbolId: 'water' },
      { type: 'guide_viewed', guideId: 'dream-journal' },
      { type: 'guide_viewed', guideId: 'dream-journal' },
    ]);
    const progress = progressOf(ledger);
    expect(progress['ink-dreamer']).toBe(1);
    expect(progress['night-voice']).toBe(0);
    expect(progress['symbol-explorer']).toBe(1);
    expect(progress['night-scholar']).toBe(1);
  });

  it('tells a spoken dream from a written one', () => {
    const ledger = fold([
      { type: 'dream_saved', dream: dream(1), input: 'voice' },
      { type: 'dream_saved', dream: dream(2), input: 'text' },
      // A restored draft alone says neither.
      { type: 'dream_saved', dream: dream(3), input: null },
    ]);
    expect(progressOf(ledger)['night-voice']).toBe(1);
    expect(progressOf(ledger)['ink-dreamer']).toBe(1);
  });

  it('counts a reading only from the day after saving and keeps the longest gap', () => {
    const saved = dream(at('2026-09-01'), { isFavorite: true });
    const sameDay = fold([{ type: 'dream_reopened', dream: saved, now: saved.id + 3 * 60 * 60 * 1000 }]);
    expect(progressOf(sameDay)['dream-reader']).toBe(0);

    const ledger = fold([
      { type: 'dream_reopened', dream: saved, now: at('2026-10-01') },
      { type: 'dream_reopened', dream: saved, now: at('2026-09-03') },
    ]);
    const progress = progressOf(ledger);
    expect(progress['dream-reader']).toBe(1);
    expect(progress['favorite-echoes']).toBe(1);
    expect(progress['time-traveler']).toBe(30);
  });

  it('counts days, not consecutive days, for searches, filters and trends', () => {
    const ledger = fold([
      { type: 'journal_result_opened', searched: true, filtered: false, now: at('2026-10-01') },
      { type: 'journal_result_opened', searched: true, filtered: true, now: at('2026-10-01') + 60_000 },
      { type: 'journal_result_opened', searched: true, filtered: false, now: at('2026-10-09') },
      { type: 'trends_explored', now: at('2026-10-02') },
      { type: 'trends_explored', now: at('2026-10-20') },
    ]);
    const progress = progressOf(ledger);
    expect(progress['dream-seeker']).toBe(2);
    expect(progress['path-finder']).toBe(1);
    expect(progress.observatory).toBe(2);
  });

  it('reads the journal it was given: dreams, days, weeks, months, memories and images', () => {
    const dreams = [
      dream(at('2026-01-05')),
      dream(at('2026-01-05') + 60_000),
      dream(at('2026-01-07')),
      dream(at('2026-03-15'), { memory: { origin: 'remembered', createdFrom: 'journal' } }),
      // A dream handed over by Lucid is not an old memory written down as such.
      dream(at('2026-03-16'), { memory: { origin: 'remembered', createdFrom: 'lucid_trainer' } }),
      dream(at('2026-03-17'), { imageSource: 'user', imageUrl: 'file:///kept.webp', syncState: 'clean' }),
      // An upload still pending, or stripped after failing, is not an added image yet.
      dream(at('2026-03-18'), { imageSource: 'user', imageUrl: 'file:///pending.webp', syncState: 'pending' }),
      dream(at('2026-03-19'), { imageSource: 'user', imageUrl: '' }),
    ];
    const progress = progressOf(createEmptyBadgeLedger(), dreams);
    expect(progress['night-journal']).toBe(8);
    expect(progress['gentle-rhythm']).toBe(7);
    // Sunday 15 March closes one week; Monday 16 opens the next.
    expect(progress['night-thread']).toBe(3);
    expect(progress['moon-cycles']).toBe(2);
    expect(progress['memory-keeper']).toBe(1);
    expect(progress['dream-painter']).toBe(1);
  });

  it('keeps earned tiers, favourites and counts after dreams are deleted or unmarked', () => {
    const dreams = Array.from({ length: 25 }, (_, index) => dream(at('2026-02-01') + index * DAY, { isFavorite: index < 5 }));
    const settled = settleBadgeLedger(createEmptyBadgeLedger(), dreams, at('2026-03-01'));
    expect(settled.earned['night-journal']).toEqual([at('2026-03-01'), at('2026-03-01')]);

    // After a long pause, with most dreams gone and no favourite left:
    const remaining = dreams.slice(0, 2).map((entry) => ({ ...entry, isFavorite: false }));
    const later = settleBadgeLedger(settled, remaining, at('2026-09-01'));
    const collection = buildBadgeCollection(later, progressOf(later, remaining));
    const state = (id: string) => collection.families.find((entry) => entry.family.id === id)!;
    expect(state('night-journal')).toMatchObject({ tier: 2, progress: 25, nextThreshold: 100 });
    expect(state('treasure-keeper')).toMatchObject({ tier: 2, progress: 5 });
    expect(later.earned['night-journal']).toEqual([at('2026-03-01'), at('2026-03-01')]);
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
    const read = fold([1, 2, 3].map((index) => ({ type: 'symbol_viewed', symbolId: `s${index}` }) as BadgeEvent));
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

  it('survives a corrupt store and keeps both sides when a guest ledger joins an account', () => {
    expect(parseBadgeLedger('not json')).toBeNull();
    expect(parseBadgeLedger({ version: 2, keys: {} })).toBeNull();
    expect(parseBadgeLedger({ version: 1, keys: { 'night-voice': 'x', unknown: ['a'] }, earned: { 'night-voice': [1, 'b'] } }))
      .toEqual(createEmptyBadgeLedger());

    const guest = fold([{ type: 'symbol_viewed', symbolId: 'moon' }, { type: 'dream_saved', dream: dream(1), input: 'voice' }]);
    const account = fold([{ type: 'symbol_viewed', symbolId: 'water' }, { type: 'dream_saved', dream: dream(1), input: 'voice' }]);
    const merged = mergeBadgeLedgers(
      { ...account, earned: { 'night-voice': [200] } },
      { ...guest, earned: { 'night-voice': [100] } },
    );
    expect(progressOf(merged)['symbol-explorer']).toBe(2);
    expect(progressOf(merged)['night-voice']).toBe(1);
    expect(merged.earned['night-voice']).toEqual([100]);
    expect(parseBadgeLedger(JSON.parse(JSON.stringify(merged)))).toEqual(merged);
  });
});
