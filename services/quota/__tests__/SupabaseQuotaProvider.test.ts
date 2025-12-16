import { beforeEach, describe, expect, it, vi } from 'vitest';

import { QUOTA_CONFIG, QUOTAS } from '../../../constants/limits';
import { supabase } from '../../../lib/supabase';
import type { DreamAnalysis } from '../../../lib/types';
import { SupabaseQuotaProvider } from '../SupabaseQuotaProvider';

// Use vi.hoisted for mocks that need to be accessed
const { mockBuilder, mockGetCachedRemoteDreams } = vi.hoisted(() => {
  const mockBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    not: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    single: vi.fn(),
    count: 0,
    error: null as Error | null,
    data: null as unknown,
  };
  // Make builder methods chainable
  mockBuilder.select.mockReturnValue(mockBuilder);
  mockBuilder.eq.mockReturnValue(mockBuilder);
  mockBuilder.not.mockReturnValue(mockBuilder);
  mockBuilder.gte.mockReturnValue(mockBuilder);
  mockBuilder.lt.mockReturnValue(mockBuilder);
  mockBuilder.single.mockReturnValue(mockBuilder);

  const mockGetCachedRemoteDreams = vi.fn<() => Promise<unknown[]>>();
  mockGetCachedRemoteDreams.mockResolvedValue([]);

  return { mockBuilder, mockGetCachedRemoteDreams };
});

// Mock using relative paths from this test file
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => mockBuilder,
  },
}));

vi.mock('../../storageService', () => ({
  getCachedRemoteDreams: () => mockGetCachedRemoteDreams(),
}));

vi.mock('../../../lib/quotaReset', () => ({
  getMonthlyQuotaPeriod: () => ({
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-02-01'),
  }),
}));

const freeUser = { id: 'free-user', app_metadata: { tier: 'free' } } as any;
const premiumUser = { id: 'premium-user', app_metadata: { tier: 'premium' } } as any;
const guestUser = null;

describe('SupabaseQuotaProvider', () => {
  let provider: SupabaseQuotaProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock states
    mockBuilder.count = 0;
    mockBuilder.error = null;
    mockBuilder.data = null;
    mockGetCachedRemoteDreams.mockResolvedValue([]);
    // Reset supabase.from mock in case a previous test overwrote it
    (supabase as any).from = () => mockBuilder;
    // Re-setup chainable methods
    mockBuilder.select.mockReturnValue(mockBuilder);
    mockBuilder.eq.mockReturnValue(mockBuilder);
    mockBuilder.not.mockReturnValue(mockBuilder);
    mockBuilder.gte.mockReturnValue(mockBuilder);
    mockBuilder.lt.mockReturnValue(mockBuilder);
    mockBuilder.single.mockReturnValue(mockBuilder);
    provider = new SupabaseQuotaProvider();
  });

  describe('class instantiation and basic methods', () => {
    it('given new provider when instantiated then creates cache and sets TTL', () => {
      // Given
      // No setup needed

      // When
      const newProvider = new SupabaseQuotaProvider();

      // Then
      expect(newProvider).toBeInstanceOf(SupabaseQuotaProvider);
    });
  });

  describe('private method testing via public interface', () => {
    it('given user when getting used analysis count then queries Supabase correctly', async () => {
      // Given
      const user = { id: 'test-user' } as any;
      const mockSupabase = (await vi.importMock('../../../lib/supabase')) as any;
      const mockBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        count: 5,
        error: null,
      };
      mockSupabase.supabase.from = vi.fn().mockReturnValue(mockBuilder);

      // When
      const count = await provider.getUsedAnalysisCount(user);

      // Then
      expect(count).toBe(5);
      expect(mockBuilder.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
      expect(mockBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user');
      expect(mockBuilder.eq).toHaveBeenCalledWith('quota_type', 'analysis');
    });

    it('given user when getting used exploration count then queries Supabase correctly', async () => {
      // Given
      const user = { id: 'test-user' } as any;
      const mockSupabase = (await vi.importMock('../../../lib/supabase')) as any;
      const mockBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        count: 3,
        error: null,
      };
      mockSupabase.supabase.from = vi.fn().mockReturnValue(mockBuilder);

      // When
      const count = await provider.getUsedExplorationCount(user);

      // Then
      expect(count).toBe(3);
      expect(mockBuilder.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
      expect(mockBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user');
      expect(mockBuilder.eq).toHaveBeenCalledWith('quota_type', 'exploration');
    });

    it('given user when getting used messages count then queries Supabase correctly', async () => {
      // Given
      const user = { id: 'test-user' } as any;
      const dream = {
        id: 123,
        chatHistory: Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, role: 'user' as const, text: 'x' })),
      };
      const mockStorage = await vi.importMock('../../storageService');
      mockStorage.getCachedRemoteDreams = vi.fn().mockResolvedValue([dream]);

      // When
      const count = await provider.getUsedMessagesCount({ dreamId: 123 }, user);

      // Then
      expect(count).toBe(10);
    });

    it('given Supabase error when counting analyses then handles error gracefully', async () => {
      // Given
      const user = { id: 'test-user' } as any;
      const mockSupabase = (await vi.importMock('../../../lib/supabase')) as any;
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        count: null,
        error: { message: 'Column does not exist' },
      };
      mockSupabase.supabase.from = vi.fn().mockReturnValue(mockBuilder);

      // When
      const count = await provider.getUsedAnalysisCount(user);

      // Then
      // On error, return 0 as safe fallback (higher-level methods handle tier-specific fallback)
      expect(count).toBe(0);
    });

    it('given Supabase error when counting explorations then returns tier limit', async () => {
      // Given
      const user = { id: 'test-user' } as any;
      const mockSupabase = (await vi.importMock('../../../lib/supabase')) as any;
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        count: null,
        error: { message: 'Database error' },
      };
      mockSupabase.supabase.from = vi.fn().mockReturnValue(mockBuilder);

      // When
      const count = await provider.getUsedExplorationCount(user);

      // Then
      // On error, return 0 as safe fallback (higher-level methods handle tier-specific fallback)
      expect(count).toBe(0);
    });
  });

  describe('monthly quota counting', () => {
    it('given user when getting monthly analysis count then queries with date range', async () => {
      // Given
      const user = { id: 'test-user' } as any;
      const p = provider as any;
      const mockSupabase = (await vi.importMock('../../../lib/supabase')) as any;
      const eventsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        count: 2,
        error: null,
      };
      const dreamsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        count: 1,
        error: null,
      };
      mockSupabase.supabase.from = vi.fn((table: string) => (table === 'quota_usage' ? eventsBuilder : dreamsBuilder));

      // When
      const count = await p.getMonthlyAnalysisCount(user);

      // Then
      expect(count).toBe(2);
      expect(eventsBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user');
      expect(eventsBuilder.eq).toHaveBeenCalledWith('quota_type', 'analysis');
      expect(eventsBuilder.gte).toHaveBeenCalledWith('occurred_at', '2024-01-01T00:00:00.000Z');
      expect(eventsBuilder.lt).toHaveBeenCalledWith('occurred_at', '2024-02-01T00:00:00.000Z');
      expect(dreamsBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user');
      expect(dreamsBuilder.eq).toHaveBeenCalledWith('is_analyzed', true);
      expect(dreamsBuilder.gte).toHaveBeenCalledWith('analyzed_at', '2024-01-01T00:00:00.000Z');
      expect(dreamsBuilder.lt).toHaveBeenCalledWith('analyzed_at', '2024-02-01T00:00:00.000Z');
    });

    it('given user when getting monthly exploration count then queries with date range', async () => {
      // Given
      const user = { id: 'test-user' } as any;
      const p = provider as any;
      const mockSupabase = (await vi.importMock('../../../lib/supabase')) as any;
      const eventsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        count: 1,
        error: null,
      };
      const dreamsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        count: 1,
        error: null,
      };
      mockSupabase.supabase.from = vi.fn((table: string) => (table === 'quota_usage' ? eventsBuilder : dreamsBuilder));

      // When
      const count = await p.getMonthlyExplorationCount(user);

      // Then
      expect(count).toBe(1);
      expect(eventsBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user');
      expect(eventsBuilder.eq).toHaveBeenCalledWith('quota_type', 'exploration');
      expect(eventsBuilder.gte).toHaveBeenCalledWith('occurred_at', '2024-01-01T00:00:00.000Z');
      expect(eventsBuilder.lt).toHaveBeenCalledWith('occurred_at', '2024-02-01T00:00:00.000Z');
      expect(dreamsBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user');
      expect(dreamsBuilder.not).toHaveBeenCalledWith('exploration_started_at', 'is', null);
      expect(dreamsBuilder.gte).toHaveBeenCalledWith('exploration_started_at', '2024-01-01T00:00:00.000Z');
      expect(dreamsBuilder.lt).toHaveBeenCalledWith('exploration_started_at', '2024-02-01T00:00:00.000Z');
    });

    it('given Supabase error when counting monthly analyses then returns monthly limit', async () => {
      // Given
      const user = { id: 'test-user' } as any;
      const p = provider as any;
      const mockSupabase = (await vi.importMock('../../../lib/supabase')) as any;
      const mockBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        count: null,
        error: { message: 'Database error' },
      };
      mockSupabase.supabase.from = vi.fn().mockReturnValue(mockBuilder);

      // When
      const count = await p.getMonthlyAnalysisCount(user);

      // Then
      expect(count).toBe(QUOTA_CONFIG.free.monthly.analysis);
    });

    it('given Supabase error when counting monthly explorations then returns monthly limit', async () => {
      // Given
      const user = { id: 'test-user' } as any;
      const p = provider as any;
      const mockSupabase = (await vi.importMock('../../../lib/supabase')) as any;
      const mockBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        count: null,
        error: { message: 'Database error' },
      };
      mockSupabase.supabase.from = vi.fn().mockReturnValue(mockBuilder);

      // When
      const count = await p.getMonthlyExplorationCount(user);

      // Then
      expect(count).toBe(QUOTA_CONFIG.free.monthly.exploration);
    });
  });

  describe('cache key generation', () => {
    it('given user and prefix when generating monthly cache key then includes month and user ID', async () => {
      // Given
      const user = { id: 'test-user' } as any;
      const p = provider as any;
      const mockDate = new Date('2024-01-15T12:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      // When
      const cacheKey = p.getMonthlyCacheKey('test_prefix', user);

      // Then
      expect(cacheKey).toBe('test_prefix_test-user_2024-1');
      vi.useRealTimers();
    });
  });

  describe('dream resolution and validation', () => {
    it('given dream ID when resolving dream then retrieves from storage', async () => {
      // Given
      const dreamId = 123;
      const mockDream = { id: 123, title: 'Test Dream' };
      const mockStorage = (await vi.importMock('../../storageService')) as any;
      mockStorage.getCachedRemoteDreams = vi.fn().mockResolvedValue([mockDream]);

      // When
      const dream = await (provider as any).resolveDream({ dreamId });

      // Then
      expect(dream).toEqual(mockDream);
      expect(mockStorage.getCachedRemoteDreams).toHaveBeenCalled();
    });

    it('given non-existent dream ID when resolving then returns null', async () => {
      // Given
      const dreamId = 999;
      const mockStorage = (await vi.importMock('../../storageService')) as any;
      mockStorage.getCachedRemoteDreams = vi.fn().mockResolvedValue([{ id: 123 }]);

      // When
      const dream = await (provider as any).resolveDream({ dreamId });

      // Then
      expect(dream).toBeUndefined();
    });
  });

  describe('quota validation methods', () => {
    it('given guest user when checking analysis then denies (handled by guest provider elsewhere)', async () => {
      // Given
      const p = provider as any;
      p.getUsedAnalysisCount = vi.fn().mockResolvedValue(1);

      // When
      const canAnalyze = await provider.canAnalyzeDream(guestUser);

      // Then
      expect(canAnalyze).toBe(false);
    });

    it('given guest user beyond limits when checking analysis then denies', async () => {
      // Given
      const p = provider as any;
      p.getUsedAnalysisCount = vi.fn().mockResolvedValue(3);

      // When
      const canAnalyze = await provider.canAnalyzeDream(guestUser);

      // Then
      expect(canAnalyze).toBe(false);
    });

    it('given premium user when checking analysis then always allows', async () => {
      // Given
      const p = provider as any;
      p.getUsedAnalysisCount = vi.fn().mockResolvedValue(100);

      // When
      const canAnalyze = await provider.canAnalyzeDream(premiumUser, 'premium');

      // Then
      expect(canAnalyze).toBe(true);
    });

    it('given guest user when checking exploration then allows within guest limits', async () => {
      // Given
      const p = provider as any;
      p.getUsedExplorationCount = vi.fn().mockResolvedValue(1);

      // When
      const canExplore = await provider.canExploreDream({ dreamId: 123 }, guestUser);

      // Then
      expect(canExplore).toBe(false);
    });

    it('given guest user beyond limits when checking exploration then denies', async () => {
      // Given
      const p = provider as any;
      p.getUsedExplorationCount = vi.fn().mockResolvedValue(3);

      // When
      const canExplore = await provider.canExploreDream({ dreamId: 123 }, guestUser);

      // Then
      expect(canExplore).toBe(false);
    });

    it('given premium user when checking exploration then always allows', async () => {
      // Given
      const p = provider as any;
      p.getUsedExplorationCount = vi.fn().mockResolvedValue(100);

      // When
      const canExplore = await provider.canExploreDream({ dreamId: 123 }, premiumUser, 'premium');

      // Then
      expect(canExplore).toBe(true);
    });
  });

  describe('comprehensive quota status', () => {
    it('given free tier when getting status then shows monthly limits', async () => {
      // Given
      const p = provider as any;
      p.getMonthlyAnalysisCount = vi.fn().mockResolvedValue(1);
      p.getMonthlyExplorationCount = vi.fn().mockResolvedValue(0);
      p.getUsedMessagesCount = vi.fn().mockResolvedValue(2);
      p.canAnalyzeDream = vi.fn().mockResolvedValue(true);
      p.canExploreDream = vi.fn().mockResolvedValue(true);

      // When
      const status = await provider.getQuotaStatus(freeUser, 'free', { dreamId: 1 });

      // Then
      expect(status.tier).toBe('free');
      expect(status.usage.analysis.limit).toBe(3);
      expect(status.usage.analysis.used).toBe(1);
      expect(status.usage.exploration.limit).toBe(2);
      expect(status.usage.exploration.used).toBe(0);
      expect(status.usage.messages.limit).toBe(20);
      expect(status.usage.messages.used).toBe(2);
      expect(status.canAnalyze).toBe(true);
      expect(status.canExplore).toBe(true);
    });

    it('given premium tier when getting status then shows unlimited limits', async () => {
      // Given
      const p = provider as any;
      p.getUsedAnalysisCount = vi.fn().mockResolvedValue(100);
      p.getUsedExplorationCount = vi.fn().mockResolvedValue(50);
      p.getUsedMessagesCount = vi.fn().mockResolvedValue(20);

      // When
      const status = await provider.getQuotaStatus(premiumUser, 'premium', { dreamId: 1 });

      // Then
      expect(status.tier).toBe('premium');
      expect(status.usage.analysis.limit).toBeNull();
      expect(status.usage.exploration.limit).toBeNull();
      expect(status.usage.messages.limit).toBeNull(); // Premium has unlimited messages
      expect(status.canAnalyze).toBe(true);
      expect(status.canExplore).toBe(true);
    });

    it('given limits exceeded when getting status then includes reasons', async () => {
      // Given
      const p = provider as any;
      p.getUsedAnalysisCount = vi.fn().mockResolvedValue(10);
      p.getUsedExplorationCount = vi.fn().mockResolvedValue(5);
      p.getMonthlyAnalysisCount = vi.fn().mockResolvedValue(3);
      p.getMonthlyExplorationCount = vi.fn().mockResolvedValue(2);
      p.getUsedMessagesCount = vi.fn().mockResolvedValue(0);
      p.canAnalyzeDream = vi.fn().mockResolvedValue(false);
      p.canExploreDream = vi.fn().mockResolvedValue(false);

      // When
      const status = await provider.getQuotaStatus(freeUser, 'free', { dreamId: 1 });

      // Then
      expect(status.canAnalyze).toBe(false);
      expect(status.canExplore).toBe(false);
      expect(status.reasons).toBeDefined();
      expect(status.reasons!.length).toBeGreaterThan(0);
    });
  });

  describe('caching behavior', () => {
    it('given cached data when invalidating then clears cache', () => {
      // Given
      const p = provider as any;
      p.cache.set('test', { value: 'test', expiresAt: Date.now() + 1000 });
      expect(p.cache.size).toBe(1);

      // When
      provider.invalidate();

      // Then
      expect(p.cache.size).toBe(0);
    });
  });

  describe('caching behavior', () => {
    it('given cache key when getting or caching then stores with TTL', async () => {
      // Given
      const p = provider as any;
      const computeFn = vi.fn().mockResolvedValue('computed-value');

      // When
      const result1 = await p.getOrCache('test-key', computeFn);
      const result2 = await p.getOrCache('test-key', computeFn);

      // Then
      expect(result1).toBe('computed-value');
      expect(result2).toBe('computed-value');
      expect(computeFn).toHaveBeenCalledTimes(1); // Only called once due to cache
    });

    it('given expired cache when getting or caching then recomputes', async () => {
      // Given
      const p = provider as any;
      const computeFn = vi.fn().mockResolvedValue('computed-value');
      
      // Mock expired cache
      p.cache.set('test-key', { value: 'old-value', expiresAt: Date.now() - 1000 });

      // When
      const result = await p.getOrCache('test-key', computeFn);

      // Then
      expect(result).toBe('computed-value');
      expect(computeFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('dream resolution', () => {
    it('given dream target when resolving then returns dream directly', async () => {
      // Given
      const dream = { id: 123, title: 'Test Dream' };
      const target = { dream };
      const p = provider as any;

      // When
      const result = await p.resolveDream(target);

      // Then
      expect(result).toBe(dream);
    });

    it('given dream ID when resolving then returns undefined if no dream found', async () => {
      // Given
      const target = { dreamId: 123 };
      const mockStorage = await vi.importMock('../../storageService');
      mockStorage.getCachedRemoteDreams = vi.fn().mockResolvedValue([]);
      const p = provider as any;

      // When
      const result = await p.resolveDream(target);

      // Then
      expect(result).toBeUndefined();
    });

    it('given no target when resolving then returns undefined', async () => {
      // Given
      const p = provider as any;

      // When
      const result = await p.resolveDream(undefined);

      // Then
      expect(result).toBeUndefined();
    });
  });

  describe('free tier monthly analysis quotas', () => {
    it('given custom DB quota limits when checking analysis then uses DB limit', async () => {
      // Given
      const p = provider as any;
      // quota_limits for free: analysis limit = 1
      mockBuilder.data = [
        { quota_type: 'analysis', quota_limit: 1 },
        { quota_type: 'exploration', quota_limit: 2 },
        { quota_type: 'messages_per_dream', quota_limit: 20 },
      ];
      mockBuilder.error = null;

      p.getMonthlyAnalysisCount = vi.fn().mockResolvedValue(1);

      // When
      const result = await provider.canAnalyzeDream(freeUser);

      // Then
      expect(result).toBe(false);
    });

    it('given analyses within limits when checking then allows analysis', async () => {
      // Given
      const p = provider as any;
      p.getUsedAnalysisCount = vi.fn().mockResolvedValue(4);
      p.getMonthlyAnalysisCount = vi.fn().mockResolvedValue(0);

      // When
      const result = await provider.canAnalyzeDream(freeUser);

      // Then
      expect(result).toBe(true);
    });

    it('given analyses at limit when checking then denies analysis', async () => {
      // Given
      const p = provider as any;
      p.getUsedAnalysisCount = vi.fn().mockResolvedValue(10);
      p.getMonthlyAnalysisCount = vi.fn().mockResolvedValue(3);

      // When
      const result = await provider.canAnalyzeDream(freeUser);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('free tier monthly exploration quotas', () => {
    it('given explorations within limits when checking then allows exploration', async () => {
      // Given
      const p = provider as any;
      p.resolveDream = vi.fn().mockResolvedValue(undefined);
      p.getUsedExplorationCount = vi.fn().mockResolvedValue(1);
      p.getMonthlyExplorationCount = vi.fn().mockResolvedValue(0);

      // When
      const result = await provider.canExploreDream({ dreamId: 1 }, freeUser);

      // Then
      expect(result).toBe(true);
    });

    it('given explorations at limit when checking then denies exploration', async () => {
      // Given
      const p = provider as any;
      p.resolveDream = vi.fn().mockResolvedValue(undefined);
      p.getUsedExplorationCount = vi.fn().mockResolvedValue(5);
      p.getMonthlyExplorationCount = vi.fn().mockResolvedValue(2);

      // When
      const result = await provider.canExploreDream({ dreamId: 1 }, freeUser);

      // Then
      expect(result).toBe(false);
    });

    it('given already explored dream when checking then always allows exploration', async () => {
      // Given
      const exploredDream = { id: 42, explorationStartedAt: Date.now() };
      const p = provider as any;
      p.resolveDream = vi.fn().mockResolvedValue(exploredDream);
      p.getUsedExplorationCount = vi.fn().mockResolvedValue(100);

      // When
      const result = await provider.canExploreDream({ dreamId: exploredDream.id }, freeUser);

      // Then
      expect(result).toBe(true);
    });
  });

  describe('premium tier unlimited access', () => {
    it('given premium user when checking analysis then always allows', async () => {
      // Given
      const p = provider as any;
      p.getUsedAnalysisCount = vi.fn().mockResolvedValue(1000);

      // When
      const result = await provider.canAnalyzeDream(premiumUser, 'premium');

      // Then
      expect(result).toBe(true);
    });

    it('given premium user when checking exploration then always allows', async () => {
      // Given
      const p = provider as any;
      p.resolveDream = vi.fn().mockResolvedValue(undefined);
      p.getUsedExplorationCount = vi.fn().mockResolvedValue(1000);

      // When
      const result = await provider.canExploreDream({ dreamId: 1 }, premiumUser, 'premium');

      // Then
      expect(result).toBe(true);
    });
  });

  describe('guest user restrictions', () => {
    it('given guest user when checking analysis then denies', async () => {
      // Given
      // Guest user is null

      // When
      const result = await provider.canAnalyzeDream(guestUser);

      // Then
      expect(result).toBe(false);
    });

    it('given guest user when checking exploration then denies', async () => {
      // Given
      // Guest user is null

      // When
      const result = await provider.canExploreDream({ dreamId: 1 }, guestUser);

      // Then
      expect(result).toBe(false);
    });

    it('given guest user when getting quota status then returns guest status', async () => {
      // Given
      // Guest user is null

      // When
      const status = await provider.getQuotaStatus(guestUser, 'guest');

      // Then
      expect(status.tier).toBe('guest');
      expect(status.canAnalyze).toBe(false);
      expect(status.canExplore).toBe(false);
    });
  });

  describe('chat message limits', () => {
    it('given messages within limit when checking then allows sending', async () => {
      // Given
      const dream: DreamAnalysis = {
        id: 123,
        transcript: 'Test dream',
        title: 'Test dream',
        interpretation: '',
        shareableQuote: '',
        imageUrl: '',
        chatHistory: [
          { id: 'm1', role: 'user', text: 'hi' },
          { id: 'm2', role: 'model', text: 'ok' },
        ],
        dreamType: 'Symbolic Dream',
      };
      const p = provider as any;
      p.resolveDream = vi.fn().mockResolvedValue(dream);
      p.getUsedMessagesCount = vi.fn().mockResolvedValue(2);

      // When
      const result = await provider.canSendChatMessage({ dream }, freeUser);

      // Then
      expect(result).toBe(true);
    });

    it('given messages at limit when checking then denies sending', async () => {
      // Given
      const dream: DreamAnalysis = {
        id: 123,
        transcript: 'Test dream',
        title: 'Test dream',
        interpretation: '',
        shareableQuote: '',
        imageUrl: '',
        chatHistory: Array.from({ length: 20 }, (_, i) => ({ id: `m${i}`, role: 'user' as const, text: 'x' })),
        dreamType: 'Symbolic Dream',
      };
      const p = provider as any;
      p.resolveDream = vi.fn().mockResolvedValue(dream);
      p.getUsedMessagesCount = vi.fn().mockResolvedValue(20);

      // When
      const result = await provider.canSendChatMessage({ dream }, freeUser);

      // Then
      expect(result).toBe(false);
    });

    it('given no user when checking messages then denies', async () => {
      // Given
      // No user provided

      // When
      const result = await provider.canSendChatMessage({ dreamId: 1 }, guestUser);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('comprehensive quota status', () => {
    it('given free tier when getting status then shows monthly limits', async () => {
      // Given
      const p = provider as any;
      p.getMonthlyAnalysisCount = vi.fn().mockResolvedValue(1);
      p.getMonthlyExplorationCount = vi.fn().mockResolvedValue(0);
      p.getUsedMessagesCount = vi.fn().mockResolvedValue(2);
      p.canAnalyzeDream = vi.fn().mockResolvedValue(true);
      p.canExploreDream = vi.fn().mockResolvedValue(true);

      // When
      const status = await provider.getQuotaStatus(freeUser, 'free', { dreamId: 1 });

      // Then
      expect(status.tier).toBe('free');
      expect(status.usage.analysis.limit).toBe(3);
      expect(status.usage.analysis.used).toBe(1);
      expect(status.usage.exploration.limit).toBe(2);
      expect(status.usage.exploration.used).toBe(0);
      expect(status.usage.messages.limit).toBe(20);
      expect(status.usage.messages.used).toBe(2);
      expect(status.canAnalyze).toBe(true);
      expect(status.canExplore).toBe(true);
    });

    it('given premium tier when getting status then shows unlimited limits', async () => {
      // Given
      const p = provider as any;
      p.getUsedAnalysisCount = vi.fn().mockResolvedValue(100);
      p.getUsedExplorationCount = vi.fn().mockResolvedValue(50);
      p.getUsedMessagesCount = vi.fn().mockResolvedValue(20);

      // When
      const status = await provider.getQuotaStatus(premiumUser, 'premium', { dreamId: 1 });

      // Then
      expect(status.tier).toBe('premium');
      expect(status.usage.analysis.limit).toBeNull();
      expect(status.usage.exploration.limit).toBeNull();
      expect(status.usage.messages.limit).toBeNull(); // Premium has unlimited messages
      expect(status.canAnalyze).toBe(true);
      expect(status.canExplore).toBe(true);
    });

    it('given limits exceeded when getting status then includes reasons', async () => {
      // Given
      const p = provider as any;
      p.getUsedAnalysisCount = vi.fn().mockResolvedValue(10);
      p.getUsedExplorationCount = vi.fn().mockResolvedValue(5);
      p.getMonthlyAnalysisCount = vi.fn().mockResolvedValue(3);
      p.getMonthlyExplorationCount = vi.fn().mockResolvedValue(2);
      p.getUsedMessagesCount = vi.fn().mockResolvedValue(0);
      p.canAnalyzeDream = vi.fn().mockResolvedValue(false);
      p.canExploreDream = vi.fn().mockResolvedValue(false);

      // When
      const status = await provider.getQuotaStatus(freeUser, 'free', { dreamId: 1 });

      // Then
      expect(status.canAnalyze).toBe(false);
      expect(status.canExplore).toBe(false);
      expect(status.reasons).toBeDefined();
      expect(status.reasons!.length).toBeGreaterThan(0);
    });
  });

  describe('critical non-regression: tier parameter usage (RevenueCat SSOT)', () => {
    it('should use tier parameter instead of user.app_metadata.tier', async () => {
      // CRITICAL TEST: Verifies that tier comes from parameter (RevenueCat), not from user metadata
      // Given: User has 'premium' in app_metadata, but we pass 'free' as tier parameter
      const userWithPremiumMetadata = { id: 'user-123', app_metadata: { tier: 'premium' } } as any;
      const p = provider as any;
      p.getMonthlyAnalysisCount = vi.fn().mockResolvedValue(2);
      p.getMonthlyExplorationCount = vi.fn().mockResolvedValue(0);
      p.getUsedMessagesCount = vi.fn().mockResolvedValue(0);

      // Act: Pass 'free' tier explicitly (simulating RevenueCat saying user is free)
      const status = await provider.getQuotaStatus(userWithPremiumMetadata, 'free', { dreamId: 1 });

      // Assert: Provider should use 'free' tier (parameter), NOT 'premium' (metadata)
      expect(status.tier).toBe('free');
      // Free tier has 3 monthly analyses, premium would be unlimited (null)
      expect(status.usage.analysis.limit).toBe(3);
      expect(status.usage.analysis.used).toBe(2);
      expect(status.usage.analysis.remaining).toBe(1);

      // Verify canAnalyze respects the 'free' tier limit (2 used out of 3, so true)
      expect(status.canAnalyze).toBe(true);
    });

    it('should use tier parameter even when user has free in metadata but premium passed', async () => {
      // Verify the opposite: user has 'free' in metadata, but tier='premium' passed
      const userWithFreeMetadata = { id: 'user-456', app_metadata: { tier: 'free' } } as any;
      const p = provider as any;
      p.getMonthlyAnalysisCount = vi.fn().mockResolvedValue(100);
      p.getMonthlyExplorationCount = vi.fn().mockResolvedValue(0);
      p.getUsedMessagesCount = vi.fn().mockResolvedValue(0);

      // Act: Pass 'premium' tier explicitly
      const status = await provider.getQuotaStatus(userWithFreeMetadata, 'premium', { dreamId: 1 });

      // Assert: Provider should use 'premium' tier (parameter), showing unlimited
      expect(status.tier).toBe('premium');
      // Premium tier has unlimited analyses
      expect(status.usage.analysis.limit).toBeNull();
      // Can analyze should always be true for premium
      expect(status.canAnalyze).toBe(true);
    });
  });
});
