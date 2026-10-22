import { describe, expect, it, beforeEach } from '@jest/globals';

import { computeBadgeProgress, createEmptyBadgeLedger } from '@/lib/badges/ledger';
import {
  activateBadgeScope,
  flushBadgeLedgerWritesForTests,
  recordBadgeEvent,
  resetBadgeLedgerStoreForTests,
  settleBadges,
} from '@/services/badgeLedgerStore';
import type { DreamAnalysis } from '@/lib/types';

const mockStore = new Map<string, string>();
let mockWriteFails = false;
jest.mock('@/services/lucidKeyValueStorage', () => ({
  getLucidKeyValueStorage: () => ({
    getItem: async (key: string) => mockStore.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (mockWriteFails) throw new Error('storage full');
      mockStore.set(key, value);
    },
    removeItem: async (key: string) => {
      mockStore.delete(key);
    },
  }),
}));

const KEY = 'noctalia_badge_ledger_v1:';
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
    resetBadgeLedgerStoreForTests();
  });

  it('keeps an action finished while the ledger is still being read', async () => {
    mockStore.set(`${KEY}user:a`, JSON.stringify({ ...createEmptyBadgeLedger(), keys: { 'symbol-explorer': ['moon'] } }));
    const opening = activateBadgeScope('user:a');
    recordBadgeEvent({ type: 'symbol_viewed', symbolId: 'water' });
    await opening;
    await flushBadgeLedgerWritesForTests();
    expect(stored('user:a').keys['symbol-explorer']).toEqual(['moon', 'water']);
  });

  it('keeps an action finished at launch, before any account is known, for the first ledger opened', async () => {
    recordBadgeEvent({ type: 'guide_viewed', guideId: 'dream-journal' });
    await activateBadgeScope('user:a');
    await flushBadgeLedgerWritesForTests();
    expect(progressIn('user:a')['night-scholar']).toBe(1);

    await activateBadgeScope('user:b');
    await flushBadgeLedgerWritesForTests();
    expect(progressIn('user:b')['night-scholar']).toBe(0);
  });

  it('gives a guest ledger to the first account that opens, once, and keeps accounts apart', async () => {
    await activateBadgeScope('guest');
    recordBadgeEvent({ type: 'guide_viewed', guideId: 'dream-journal' });
    await flushBadgeLedgerWritesForTests();

    await activateBadgeScope('user:a');
    await flushBadgeLedgerWritesForTests();
    expect(progressIn('user:a')['night-scholar']).toBe(1);
    expect(stored('guest')).toBeNull();

    await activateBadgeScope('user:b');
    await flushBadgeLedgerWritesForTests();
    expect(progressIn('user:b')['night-scholar']).toBe(0);
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
    recordBadgeEvent({ type: 'symbol_viewed', symbolId: 'moon' });
    await flushBadgeLedgerWritesForTests();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    mockWriteFails = false;
    recordBadgeEvent({ type: 'symbol_viewed', symbolId: 'water' });
    await flushBadgeLedgerWritesForTests();
    expect(stored('user:a').keys['symbol-explorer']).toEqual(['moon', 'water']);
  });
});
