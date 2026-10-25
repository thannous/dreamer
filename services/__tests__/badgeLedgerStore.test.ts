import { describe, expect, it, beforeEach } from '@jest/globals';

import { computeBadgeProgress, createEmptyBadgeLedger } from '@/lib/badges/ledger';
import {
  activateBadgeScope,
  forgetBadgeLedger,
  mergeRemoteBadgeLedger,
  flushBadgeLedgerWritesForTests,
  getBadgeLedgerSnapshot,
  recordBadgeEvent,
  resetBadgeLedgerStoreForTests,
  settleBadges,
} from '@/services/badgeLedgerStore';
import type { DreamAnalysis } from '@/lib/types';

const mockStore = new Map<string, string>();
let mockWriteFails = false;
let mockReadFailures = 0;
let mockDeferredRead: { key: string; started: () => void; result: Promise<string | null> } | null = null;
jest.mock('@/services/lucidKeyValueStorage', () => ({
  getLucidKeyValueStorage: () => ({
    getItem: async (key: string) => {
      if (mockDeferredRead?.key === key) {
        const deferred = mockDeferredRead;
        mockDeferredRead = null;
        deferred.started();
        return deferred.result;
      }
      if (mockReadFailures > 0) {
        mockReadFailures -= 1;
        throw new Error('database is locked');
      }
      return mockStore.get(key) ?? null;
    },
    setItem: async (key: string, value: string) => {
      if (mockWriteFails) throw new Error('storage full');
      mockStore.set(key, value);
    },
    removeItem: async (key: string) => {
      mockStore.delete(key);
    },
  }),
}));

const KEY = 'noctalia_badge_ledger_v2:';
const LEGACY_KEY = 'noctalia_badge_ledger_v1:';
function deferRead(scope: string) {
  let resolve!: (raw: string | null) => void;
  let reject!: (error: Error) => void;
  let started!: () => void;
  const reading = new Promise<void>(done => { started = done; });
  const result = new Promise<string | null>((done, fail) => { resolve = done; reject = fail; });
  mockDeferredRead = { key: `${KEY}${scope}`, started, result };
  return { reading, resolve, reject };
}
const stored = (scope: string) => {
  const raw = mockStore.get(`${KEY}${scope}`);
  return raw ? JSON.parse(raw) : null;
};
const progressIn = (scope: string) => computeBadgeProgress(stored(scope) ?? createEmptyBadgeLedger(), []);

const dream = (id: number): DreamAnalysis => ({
  id, clientRequestId: `req-${id}`, transcript: 'x', title: 'x', interpretation: '', shareableQuote: '',
  imageUrl: '', chatHistory: [], dreamType: 'Symbolic Dream',
});

describe('badge ledger store', () => {
  beforeEach(() => {
    mockStore.clear();
    mockWriteFails = false;
    mockReadFailures = 0;
    mockDeferredRead = null;
    resetBadgeLedgerStoreForTests();
  });

  it('keeps an action finished while the ledger is still being read', async () => {
    mockStore.set(`${KEY}user:a`, JSON.stringify({ ...createEmptyBadgeLedger(), keys: { 'symbol-explorer': ['moon'] } }));
    const opening = activateBadgeScope('user:a');
    recordBadgeEvent({ type: 'symbol_read', symbolId: 'water' });
    await opening;
    await flushBadgeLedgerWritesForTests();
    expect(stored('user:a').keys['symbol-explorer']).toEqual(['moon', 'water']);
  });

  it('saves an action to A when its delayed read finishes after B opens', async () => {
    const saved = JSON.stringify({ ...createEmptyBadgeLedger(), keys: { 'symbol-explorer': ['moon'] } });
    mockStore.set(`${KEY}user:a`, saved);
    const delayed = deferRead('user:a');
    const openingA = activateBadgeScope('user:a');
    await delayed.reading;
    recordBadgeEvent({ type: 'symbol_read', symbolId: 'water' });
    const openingB = activateBadgeScope('user:b');
    recordBadgeEvent({ type: 'symbol_read', symbolId: 'sun' });
    delayed.resolve(saved);
    await Promise.all([openingA, openingB]);
    await flushBadgeLedgerWritesForTests();
    expect(stored('user:a').keys['symbol-explorer']).toEqual(['moon', 'water']);
    expect(stored('user:b').keys['symbol-explorer']).toEqual(['sun']);
    expect(getBadgeLedgerSnapshot().scope).toBe('user:b');
  });

  it('retries A after a read failure without replacing B or making its unreadable ledger writable', async () => {
    jest.useFakeTimers();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const saved = { ...createEmptyBadgeLedger(), keys: { 'symbol-explorer': ['moon'] } };
      mockStore.set(`${KEY}user:a`, JSON.stringify(saved));
      mockStore.set(`${KEY}user:b`, JSON.stringify({ version: 3, future: true }));
      const delayed = deferRead('user:a');
      const openingA = activateBadgeScope('user:a');
      await delayed.reading;
      recordBadgeEvent({ type: 'symbol_read', symbolId: 'water' });
      const openingB = activateBadgeScope('user:b');
      delayed.reject(new Error('database is locked'));
      await Promise.all([openingA, openingB]);
      expect(stored('user:a')).toEqual(saved);

      await jest.advanceTimersByTimeAsync(1_000);
      await flushBadgeLedgerWritesForTests();
      recordBadgeEvent({ type: 'symbol_read', symbolId: 'sun' });
      await flushBadgeLedgerWritesForTests();
      expect(stored('user:a').keys['symbol-explorer']).toEqual(['moon', 'water']);
      expect(stored('user:b')).toEqual({ version: 3, future: true });
      expect(getBadgeLedgerSnapshot().scope).toBe('user:b');
      expect(getBadgeLedgerSnapshot().ledger.keys['symbol-explorer']).toEqual(['sun']);
    } finally {
      warn.mockRestore();
      jest.useRealTimers();
    }
  });

  it('preserves an unreadable A ledger during a switch and retains its pending action only in A memory', async () => {
    const saved = JSON.stringify({ version: 3, future: true });
    mockStore.set(`${KEY}user:a`, saved);
    const delayed = deferRead('user:a');
    const openingA = activateBadgeScope('user:a');
    await delayed.reading;
    recordBadgeEvent({ type: 'symbol_read', symbolId: 'water' });
    const openingB = activateBadgeScope('user:b');
    recordBadgeEvent({ type: 'symbol_read', symbolId: 'sun' });
    delayed.resolve(saved);
    await Promise.all([openingA, openingB]);
    expect(stored('user:a')).toEqual({ version: 3, future: true });
    expect(stored('user:b').keys['symbol-explorer']).toEqual(['sun']);
    await activateBadgeScope('user:a');
    expect(getBadgeLedgerSnapshot().ledger.keys['symbol-explorer']).toEqual(['water']);
    expect(stored('user:a')).toEqual({ version: 3, future: true });
  });

  it('retries a failed initial write to A after switching without losing either account action', async () => {
    jest.useFakeTimers();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const delayed = deferRead('user:a');
      const openingA = activateBadgeScope('user:a');
      await delayed.reading;
      recordBadgeEvent({ type: 'symbol_read', symbolId: 'water' });
      const openingB = activateBadgeScope('user:b');
      mockWriteFails = true;
      delayed.resolve(null);
      await Promise.all([openingA, openingB]);
      expect(stored('user:a')).toBeNull();
      mockWriteFails = false;
      recordBadgeEvent({ type: 'symbol_read', symbolId: 'sun' });
      await jest.advanceTimersByTimeAsync(1_000);
      await flushBadgeLedgerWritesForTests();
      expect(stored('user:a').keys['symbol-explorer']).toEqual(['water']);
      expect(stored('user:b').keys['symbol-explorer']).toEqual(['sun']);
      expect(getBadgeLedgerSnapshot().scope).toBe('user:b');
    } finally {
      warn.mockRestore();
      jest.useRealTimers();
    }
  });

  it('does not recreate a deleted A ledger when its read completes after switching to B', async () => {
    const saved = { ...createEmptyBadgeLedger(), keys: { 'symbol-explorer': ['moon'] } };
    mockStore.set(`${KEY}user:a`, JSON.stringify(saved));
    const delayed = deferRead('user:a');
    const openingA = activateBadgeScope('user:a');
    await delayed.reading;
    recordBadgeEvent({ type: 'symbol_read', symbolId: 'water' });
    const openingB = activateBadgeScope('user:b');
    recordBadgeEvent({ type: 'symbol_read', symbolId: 'sun' });
    const deletingA = forgetBadgeLedger('a');
    delayed.resolve(JSON.stringify(saved));
    await Promise.all([openingA, openingB, deletingA]);
    mergeRemoteBadgeLedger('user:a', saved);
    await activateBadgeScope('user:a');
    await flushBadgeLedgerWritesForTests();
    expect(stored('user:a')).toBeNull();
    expect(stored('user:b').keys['symbol-explorer']).toEqual(['sun']);
    expect(getBadgeLedgerSnapshot().scope).toBe('user:b');
  });

  it('keeps an action finished at launch, before any account is known, for the first ledger opened', async () => {
    recordBadgeEvent({ type: 'guide_completed', guideId: 'dream-journal' });
    await activateBadgeScope('user:a');
    await flushBadgeLedgerWritesForTests();
    expect(progressIn('user:a')['night-scholar']).toBe(1);

    await activateBadgeScope('user:b');
    await flushBadgeLedgerWritesForTests();
    expect(progressIn('user:b')['night-scholar']).toBe(0);
  });

  it('never writes over a ledger the storage could not give, and opens it once it can', async () => {
    jest.useFakeTimers();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const saved = { ...createEmptyBadgeLedger(), keys: { 'symbol-explorer': ['moon', 'sea', 'fox'] }, earned: { 'symbol-explorer': [1] } };
      mockStore.set(`${KEY}user:a`, JSON.stringify(saved));
      mockReadFailures = 1;
      await activateBadgeScope('user:a');
      recordBadgeEvent({ type: 'symbol_read', symbolId: 'water' });
      await flushBadgeLedgerWritesForTests();
      expect(getBadgeLedgerSnapshot().ready).toBe(false);
      expect(stored('user:a')).toEqual(saved);

      await jest.advanceTimersByTimeAsync(1_000);
      await flushBadgeLedgerWritesForTests();
      expect(getBadgeLedgerSnapshot().ready).toBe(true);
      expect(stored('user:a').keys['symbol-explorer']).toEqual(['moon', 'sea', 'fox', 'water']);
      expect(stored('user:a').earned['symbol-explorer']).toEqual([1]);
    } finally {
      warn.mockRestore();
      jest.useRealTimers();
    }
  });

  it('keeps a ledger it cannot read untouched, counting meanwhile only in memory', async () => {
    mockStore.set(`${KEY}user:a`, JSON.stringify({ version: 3, future: true }));
    await activateBadgeScope('user:a');
    recordBadgeEvent({ type: 'symbol_read', symbolId: 'water' });
    await flushBadgeLedgerWritesForTests();
    expect(stored('user:a')).toEqual({ version: 3, future: true });
    expect(getBadgeLedgerSnapshot().ledger.keys['symbol-explorer']).toEqual(['water']);
  });

  it('stamps a tier earned by actions alone the moment it is earned', async () => {
    await activateBadgeScope('user:a');
    for (const guideId of ['dream-journal', 'lucid-dreaming']) recordBadgeEvent({ type: 'guide_completed', guideId });
    await flushBadgeLedgerWritesForTests();
    expect(stored('user:a').earned['night-scholar']).toHaveLength(1);
  });

  it('gives what a guest did to the first account that opens, which earns its cards then', async () => {
    const days = ['2026-10-01T08:00:00', '2026-10-02T08:00:00', '2026-10-03T08:00:00'].map(Date.parse);
    const [first, second, third] = days.map(dream);
    await activateBadgeScope('guest');
    for (const guideId of ['dream-journal', 'lucid-dreaming']) recordBadgeEvent({ type: 'guide_completed', guideId });
    settleBadges([{ ...first, isFavorite: true }, second, third], days[2]);
    await flushBadgeLedgerWritesForTests();

    // The favourite is let go and the third dream deleted before the account opens: both
    // still count once, and the cards are earned when the account opens, not before.
    const signUp = Date.parse('2026-10-20T09:00:00');
    jest.spyOn(Date, 'now').mockReturnValue(signUp);
    try {
      await activateBadgeScope('user:a');
      await flushBadgeLedgerWritesForTests();
    } finally {
      jest.restoreAllMocks();
    }
    settleBadges([{ ...first, remoteId: 11 }, { ...second, remoteId: 12 }], signUp + 1000);
    await flushBadgeLedgerWritesForTests();
    const account = stored('user:a');
    for (const id of ['night-journal', 'treasure-keeper', 'night-scholar']) {
      expect(account.earned[id]).toEqual([signUp]);
    }
    expect(progressIn('user:a')['night-journal']).toBe(3);
    expect(account.revealed).toEqual({});
    expect(stored('guest')).toBeNull();

    await activateBadgeScope('user:b');
    await flushBadgeLedgerWritesForTests();
    expect(progressIn('user:b')['night-scholar']).toBe(0);
    expect(progressIn('user:b')['night-journal']).toBe(0);
  });

  it('stamps an earned tier once and keeps it after the journal empties', async () => {
    await activateBadgeScope('user:a');
    settleBadges([dream(Date.parse('2026-10-01T12:00:00'))], Date.parse('2026-10-01T12:00:00'));
    await flushBadgeLedgerWritesForTests();
    const earned = stored('user:a').earned['night-journal'];
    expect(earned).toHaveLength(1);

    settleBadges([], Date.parse('2026-12-01T12:00:00'));
    await flushBadgeLedgerWritesForTests();
    expect(stored('user:a').earned['night-journal']).toEqual(earned);
  });

  it('does not let a failed write block the next one', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await activateBadgeScope('user:a');
    mockWriteFails = true;
    recordBadgeEvent({ type: 'symbol_read', symbolId: 'moon' });
    await flushBadgeLedgerWritesForTests();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    mockWriteFails = false;
    recordBadgeEvent({ type: 'symbol_read', symbolId: 'water' });
    await flushBadgeLedgerWritesForTests();
    expect(stored('user:a').keys['symbol-explorer']).toEqual(['moon', 'water']);
  });
});

describe('badge ledger store across the collection change', () => {
  beforeEach(() => {
    mockStore.clear();
    mockWriteFails = false;
    mockReadFailures = 0;
    mockDeferredRead = null;
    resetBadgeLedgerStoreForTests();
  });

  const legacy = {
    version: 1,
    keys: { 'night-journal': ['c:a|l:1'], 'symbol-explorer': ['moon', 'sea', 'fox'] },
    best: {},
    earned: { 'night-journal': [10], 'symbol-explorer': [20], 'path-finder': [5], 'dream-reader': [15] },
    revealed: { 'night-journal': 1 },
  };

  it('brings a first-collection ledger to the new key once, and leaves the old one untouched', async () => {
    mockStore.set(`${LEGACY_KEY}user:a`, JSON.stringify(legacy));
    await activateBadgeScope('user:a');
    await flushBadgeLedgerWritesForTests();
    expect(stored('user:a')).toMatchObject({
      version: 2,
      earned: { 'night-journal': [10], 'symbol-explorer': [20], 'dream-seeker': [5] },
      revealed: { 'night-journal': 1 },
    });
    expect(JSON.parse(mockStore.get(`${LEGACY_KEY}user:a`)!)).toEqual(legacy);
  });

  it('gives a first-collection guest ledger to the first account, then forgets both of its keys', async () => {
    mockStore.set(`${LEGACY_KEY}guest`, JSON.stringify(legacy));
    const signUp = Date.parse('2026-10-20T09:00:00');
    jest.spyOn(Date, 'now').mockReturnValue(signUp);
    try {
      await activateBadgeScope('user:a');
      await flushBadgeLedgerWritesForTests();
    } finally {
      jest.restoreAllMocks();
    }
    // Everything moves, journal facts included. The tiers it held stay, Dream Reader's too
    // although its rule changed, and like the others they are earned when the account opens.
    expect(stored('user:a').earned).toEqual({
      'night-journal': [signUp], 'symbol-explorer': [signUp], 'dream-seeker': [signUp], 'dream-reader': [signUp],
    });
    expect(mockStore.has(`${LEGACY_KEY}guest`)).toBe(false);
    await forgetBadgeLedger('a');
    expect(mockStore.size).toBe(0);
  });
});

// These schedules cannot be made deterministic through UI E2E alone.
it('ignores a late account response and clears only the deleted account after pending writes', async () => {
  mockStore.clear();
  resetBadgeLedgerStoreForTests();
  await activateBadgeScope('user:a');
  recordBadgeEvent({ type: 'symbol_read', symbolId: 'water' });
  await flushBadgeLedgerWritesForTests();
  const a = stored('user:a');
  await activateBadgeScope('user:b');
  mergeRemoteBadgeLedger('user:a', a);
  recordBadgeEvent({ type: 'symbol_read', symbolId: 'moon' });
  await forgetBadgeLedger('a');
  await flushBadgeLedgerWritesForTests();
  expect(stored('user:a')).toBeNull();
  expect(stored('user:b').keys['symbol-explorer']).toEqual(['moon']);
});
