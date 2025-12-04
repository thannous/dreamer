import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DreamAnalysis } from '@/lib/types';
import { MockQuotaProvider } from '../MockQuotaProvider';
import type { User } from '@supabase/supabase-js';

// Use vi.hoisted to ensure mock is available during module loading
const { mockGetSavedDreams } = vi.hoisted(() => ({
  mockGetSavedDreams: vi.fn<[], Promise<DreamAnalysis[]>>(),
}));

// Mock using the relative path from this test file to storageService
vi.mock('../../storageService', () => ({
  getSavedDreams: () => mockGetSavedDreams(),
}));

const buildDream = (overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id: Date.now() + Math.floor(Math.random() * 1000),
  transcript: 'Dream',
  title: 'Title',
  interpretation: '',
  shareableQuote: '',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  isAnalyzed: false,
  ...overrides,
});

const userFree = { id: 'u1', user_metadata: { tier: 'free' } } as unknown as User;
const userPremium = { id: 'u2', user_metadata: { tier: 'premium' } } as unknown as User;

describe('Quota rules by user tier (MockQuotaProvider)', () => {
  beforeEach(() => {
    mockGetSavedDreams.mockReset();
  });

  it('Guest: 2 analyses, 2 explorations, 20 messages per dream', async () => {
    const dreams: DreamAnalysis[] = [
      buildDream({ id: 1, isAnalyzed: true, analyzedAt: Date.now() }),
      buildDream({ id: 2, isAnalyzed: true, analyzedAt: Date.now() }),
      buildDream({ id: 3 }),
    ];
    mockGetSavedDreams.mockResolvedValueOnce(dreams);

    const provider = new MockQuotaProvider();
    await expect(provider.canAnalyzeDream(null)).resolves.toBe(false);

    // Exploration: allow for already explored, block new third one
    const explored = buildDream({ id: 10, explorationStartedAt: Date.now() });
    mockGetSavedDreams.mockResolvedValueOnce([explored, ...dreams]);
    await expect(provider.canExploreDream({ dreamId: explored.id }, null)).resolves.toBe(true);

    // (Messages per dream covered in MockQuotaProvider.test.ts)
  });

  it('Free: 5 analyses total (including guest), 2 explorations total', async () => {
    // Already used 2 analyses as guest
    const base: DreamAnalysis[] = [
      buildDream({ id: 100, isAnalyzed: true, analyzedAt: Date.now() }),
      buildDream({ id: 101, isAnalyzed: true, analyzedAt: Date.now() }),
    ];

    mockGetSavedDreams.mockResolvedValueOnce(base);
    const provider = new MockQuotaProvider();
    await expect(provider.canAnalyzeDream(userFree)).resolves.toBe(true);

    // Use 3 more => total 5
    const five: DreamAnalysis[] = [
      ...base,
      buildDream({ id: 102, isAnalyzed: true, analyzedAt: Date.now() }),
      buildDream({ id: 103, isAnalyzed: true, analyzedAt: Date.now() }),
      buildDream({ id: 104, isAnalyzed: true, analyzedAt: Date.now() }),
    ];
    const provider2 = new MockQuotaProvider();
    mockGetSavedDreams.mockResolvedValueOnce(five);
    await expect(provider2.canAnalyzeDream(userFree)).resolves.toBe(false);

    // Explorations: two dreams explored already
    const now2 = Date.now();
    const twoExplored: DreamAnalysis[] = [
      buildDream({ id: 200, explorationStartedAt: now2, chatHistory: [{ role: 'user', text: 'hi' }] }),
      buildDream({ id: 201, explorationStartedAt: now2, chatHistory: [{ role: 'user', text: 'hi2' }] }),
    ];
    const provider3 = new MockQuotaProvider();
    mockGetSavedDreams.mockResolvedValueOnce(twoExplored);
    await expect(provider3.canExploreDream({ dreamId: 999 }, userFree)).resolves.toBe(false);

    // But for those same explored dreams, allow continuing the chat
    const provider4 = new MockQuotaProvider();
    mockGetSavedDreams.mockResolvedValueOnce(twoExplored);
    await expect(provider4.getUsedExplorationCount(userFree)).resolves.toBe(2);
    await expect(provider4.canExploreDream({ dreamId: 200 }, userFree)).resolves.toBe(true);
  });

  it('Premium: unlimited analyses, explorations, and messages', async () => {
    const heavy: DreamAnalysis[] = Array.from({ length: 50 }).map((_, i) =>
      buildDream({ id: i + 1000, isAnalyzed: true, analyzedAt: Date.now(), explorationStartedAt: Date.now(), chatHistory: Array.from({ length: 200 }, (_, j) => ({ role: j % 2 === 0 ? 'user' : 'model', text: 'x' })) })
    );
    mockGetSavedDreams.mockResolvedValue(heavy);

    const provider = new MockQuotaProvider();
    await expect(provider.canAnalyzeDream(userPremium)).resolves.toBe(true);
    await expect(provider.canExploreDream({ dreamId: 12345 }, userPremium)).resolves.toBe(true);
    await expect(provider.canSendChatMessage({ dreamId: heavy[0].id }, userPremium)).resolves.toBe(true);
    const status = await provider.getQuotaStatus(userPremium);
    expect(status.usage.analysis.limit).toBeNull();
    expect(status.usage.exploration.limit).toBeNull();
    expect(status.usage.messages.limit).toBeNull();
  });
});
