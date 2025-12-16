import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DreamAnalysis } from '@/lib/types';
import type { User } from '@supabase/supabase-js';
import { MockQuotaProvider } from '../MockQuotaProvider';

// Use vi.hoisted to ensure mock is available during module loading
const { mockGetSavedDreams, mockQuotaEventStore } = vi.hoisted(() => ({
  mockGetSavedDreams: vi.fn<() => Promise<DreamAnalysis[]>>(),
  mockQuotaEventStore: {
    analysisCount: 0,
    explorationCount: 0,
    analyzedDreamIds: [] as number[],
    exploredDreamIds: [] as number[],
  },
}));

// Mock using the relative path from this test file to storageService
vi.mock('../../storageService', () => ({
  getSavedDreams: () => mockGetSavedDreams(),
}));

// Mock MockQuotaEventStore to avoid AsyncStorage access
vi.mock('../MockQuotaEventStore', () => ({
  getMockAnalysisCount: vi.fn().mockImplementation(async () => mockQuotaEventStore.analysisCount),
  getMockExplorationCount: vi.fn().mockImplementation(async () => mockQuotaEventStore.explorationCount),
  isDreamAnalyzedMock: vi.fn().mockImplementation(async (dreamId?: number) => {
    return dreamId ? mockQuotaEventStore.analyzedDreamIds.includes(dreamId) : false;
  }),
  isDreamExploredMock: vi.fn().mockImplementation(async (dreamId?: number) => {
    return dreamId ? mockQuotaEventStore.exploredDreamIds.includes(dreamId) : false;
  }),
  recordMockAnalysis: vi.fn().mockImplementation(async (dreamId: number) => {
    mockQuotaEventStore.analysisCount++;
    if (dreamId && !mockQuotaEventStore.analyzedDreamIds.includes(dreamId)) {
      mockQuotaEventStore.analyzedDreamIds.push(dreamId);
    }
  }),
  recordMockExploration: vi.fn().mockImplementation(async (dreamId: number) => {
    mockQuotaEventStore.explorationCount++;
    if (dreamId && !mockQuotaEventStore.exploredDreamIds.includes(dreamId)) {
      mockQuotaEventStore.exploredDreamIds.push(dreamId);
    }
  }),
  invalidateMockQuotaCache: vi.fn(),
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
    // Reset mock quota state
    mockQuotaEventStore.analysisCount = 0;
    mockQuotaEventStore.explorationCount = 0;
    mockQuotaEventStore.analyzedDreamIds = [];
    mockQuotaEventStore.exploredDreamIds = [];
  });

  it('Guest: 2 analyses, 2 explorations, 10 messages per dream', async () => {
    // Set up quota state: 2 analyses used
    mockQuotaEventStore.analysisCount = 2;

    const dreams: DreamAnalysis[] = [
      buildDream({ id: 1, isAnalyzed: true, analyzedAt: Date.now() }),
      buildDream({ id: 2, isAnalyzed: true, analyzedAt: Date.now() }),
      buildDream({ id: 3 }),
    ];
    mockGetSavedDreams.mockResolvedValueOnce(dreams);

    // Set up mock state to reflect 2 analyses already done
    mockQuotaEventStore.analysisCount = 2;
    mockQuotaEventStore.analyzedDreamIds = [1, 2];

    const provider = new MockQuotaProvider();
    await expect(provider.canAnalyzeDream(null, 'guest')).resolves.toBe(false);

    // Exploration: allow for already explored dream
    mockQuotaEventStore.exploredDreamIds = [10];
    const explored = buildDream({ id: 10, explorationStartedAt: Date.now() });
    mockGetSavedDreams.mockResolvedValueOnce([explored, ...dreams]);
    mockQuotaEventStore.exploredDreamIds = [10];
    await expect(provider.canExploreDream({ dreamId: explored.id }, null, 'guest')).resolves.toBe(true);

    // (Messages per dream covered in MockQuotaProvider.test.ts)
  });

  it('Free: 3 analyses per month, 2 explorations per month', async () => {
    // Start with 2 analyses used
    mockQuotaEventStore.analysisCount = 2;

    const base: DreamAnalysis[] = [
      buildDream({ id: 100, isAnalyzed: true, analyzedAt: Date.now() }),
      buildDream({ id: 101, isAnalyzed: true, analyzedAt: Date.now() }),
    ];

    // Set mock state: 2 analyses done
    mockQuotaEventStore.analysisCount = 2;
    mockQuotaEventStore.analyzedDreamIds = [100, 101];

    mockGetSavedDreams.mockResolvedValueOnce(base);
    const provider = new MockQuotaProvider();
    await expect(provider.canAnalyzeDream(userFree, 'free')).resolves.toBe(true);

    // Use 1 more => total 3 (limit for free tier)
    mockQuotaEventStore.analysisCount = 3;
    const five: DreamAnalysis[] = [
      ...base,
      buildDream({ id: 102, isAnalyzed: true, analyzedAt: Date.now() }),
    ];

    // Set mock state: 3 analyses done
    mockQuotaEventStore.analysisCount = 3;
    mockQuotaEventStore.analyzedDreamIds = [100, 101, 102];

    const provider2 = new MockQuotaProvider();
    mockGetSavedDreams.mockResolvedValueOnce(five);
    await expect(provider2.canAnalyzeDream(userFree, 'free')).resolves.toBe(false);

    // Explorations: two dreams explored already (limit for free tier)
    mockQuotaEventStore.explorationCount = 2;
    mockQuotaEventStore.exploredDreamIds = [200, 201];
    const now2 = Date.now();
    const threeExplored: DreamAnalysis[] = [
      buildDream({ id: 200, explorationStartedAt: now2, chatHistory: [{ id: 'm1', role: 'user', text: 'hi' }] }),
      buildDream({ id: 201, explorationStartedAt: now2, chatHistory: [{ id: 'm1', role: 'user', text: 'hi2' }] }),
    ];
    const provider3 = new MockQuotaProvider();
    mockGetSavedDreams.mockResolvedValueOnce(threeExplored);
    await expect(provider3.canExploreDream({ dreamId: 999 }, userFree, 'free')).resolves.toBe(false);

    // But for those same explored dreams, allow continuing the chat
    const provider4 = new MockQuotaProvider();
    mockGetSavedDreams.mockResolvedValueOnce(threeExplored);
    await expect(provider4.getUsedExplorationCount(userFree)).resolves.toBe(2);
    await expect(provider4.canExploreDream({ dreamId: 200 }, userFree, 'free')).resolves.toBe(true);
  });

  it('Premium: unlimited analyses, explorations, and messages', async () => {
    const heavy: DreamAnalysis[] = Array.from({ length: 50 }).map((_, i) =>
      buildDream({
        id: i + 1000,
        isAnalyzed: true,
        analyzedAt: Date.now(),
        explorationStartedAt: Date.now(),
        chatHistory: Array.from({ length: 200 }, (_, j) => ({
          id: `m${j}`,
          role: j % 2 === 0 ? 'user' : 'model',
          text: 'x',
        })),
      })
    );
    mockGetSavedDreams.mockResolvedValue(heavy);

    const provider = new MockQuotaProvider();
    await expect(provider.canAnalyzeDream(userPremium, 'premium')).resolves.toBe(true);
    await expect(provider.canExploreDream({ dreamId: 12345 }, userPremium, 'premium')).resolves.toBe(true);
    await expect(provider.canSendChatMessage({ dreamId: heavy[0].id }, userPremium, 'premium')).resolves.toBe(true);
    const status = await provider.getQuotaStatus(userPremium, 'premium');
    expect(status.usage.analysis.limit).toBeNull();
    expect(status.usage.exploration.limit).toBeNull();
    expect(status.usage.messages.limit).toBeNull();
  });
});
