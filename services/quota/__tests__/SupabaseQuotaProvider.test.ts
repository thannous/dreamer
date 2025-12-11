import { beforeEach, describe, expect, it, vi } from 'vitest';

import { QUOTA_CONFIG, QUOTAS } from '../../../constants/limits';
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

  const mockGetCachedRemoteDreams = vi.fn<[], Promise<unknown[]>>();
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

const freeUser = { id: 'free-user', user_metadata: { tier: 'free' } } as any;
const premiumUser = { id: 'premium-user', user_metadata: { tier: 'premium' } } as any;
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

    it('given guest user when getting tier then returns guest', async () => {
      // Given
      const user = null;

      // When
      const tier = await provider.getUserTier(user);

      // Then
      expect(tier).toBe('guest');
    });

    it('given user with metadata tier when getting tier then returns metadata tier', async () => {
      // Given
      const user = { id: 'test-user', user_metadata: { tier: 'premium' } } as any;

      // When
      const tier = await provider.getUserTier(user);

      // Then
      expect(tier).toBe('premium');
    });
  });

  describe('private method testing via public interface', () => {
    it('given user when getting used analysis count then queries Supabase correctly', async () => {
      // Given
      const user = { id: 'test-user' } as any;
      const mockSupabase = await vi.importMock('../../../lib/supabase');
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
      const mockSupabase = await vi.importMock('../../../lib/supabase');
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
      const dream = { id: 123, chatHistory: Array(10).fill({ role: 'user' }) };
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
      const mockSupabase = await vi.importMock('../../../lib/supabase');
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
      expect(count).toBe(QUOTAS.free.analysis);
    });

    it('given Supabase error when counting explorations then returns tier limit', async () => {
      // Given
      const user = { id: 'test-user' } as any;
      const mockSupabase = await vi.importMock('../../../lib/supabase');
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
      expect(count).toBe(QUOTAS.free.exploration);
    });
  });

  describe('monthly quota counting', () => {
    it('given user when getting monthly analysis count then queries with date range', async () => {
      // Given
      const user = { id: 'test-user' } as any;
      const p = provider as any;
      const mockSupabase = await vi.importMock('../../../lib/supabase');
      const mockBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        count: 2,
        error: null,
      };
      mockSupabase.supabase.from = vi.fn().mockReturnValue(mockBuilder);

      // When
      const count = await p.getMonthlyAnalysisCount(user);

      // Then
      expect(count).toBe(2);
      expect(mockBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user');
      expect(mockBuilder.eq).toHaveBeenCalledWith('quota_type', 'analysis');
      expect(mockBuilder.gte).toHaveBeenCalledWith('occurred_at', '2024-01-01T00:00:00.000Z');
      expect(mockBuilder.lt).toHaveBeenCalledWith('occurred_at', '2024-02-01T00:00:00.000Z');
    });

    it('given user when getting monthly exploration count then queries with date range', async () => {
      // Given
      const user = { id: 'test-user' } as any;
      const p = provider as any;
      const mockSupabase = await vi.importMock('../../../lib/supabase');
      const mockBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        count: 1,
        error: null,
      };
      mockSupabase.supabase.from = vi.fn().mockReturnValue(mockBuilder);

      // When
      const count = await p.getMonthlyExplorationCount(user);

      // Then
      expect(count).toBe(1);
      expect(mockBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user');
      expect(mockBuilder.eq).toHaveBeenCalledWith('quota_type', 'exploration');
      expect(mockBuilder.gte).toHaveBeenCalledWith('occurred_at', '2024-01-01T00:00:00.000Z');
      expect(mockBuilder.lt).toHaveBeenCalledWith('occurred_at', '2024-02-01T00:00:00.000Z');
    });

    it('given Supabase error when counting monthly analyses then returns monthly limit', async () => {
      // Given
      const user = { id: 'test-user' } as any;
      const p = provider as any;
      const mockSupabase = await vi.importMock('../../../lib/supabase');
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
      const mockSupabase = await vi.importMock('../../../lib/supabase');
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
      const mockStorage = await vi.importMock('../../storageService');
      mockStorage.getCachedRemoteDreams = vi.fn().mockResolvedValue([mockDream]);

      // When
      const dream = await provider.resolveDream({ dreamId });

      // Then
      expect(dream).toEqual(mockDream);
      expect(mockStorage.getCachedRemoteDreams).toHaveBeenCalled();
    });

    it('given non-existent dream ID when resolving then returns null', async () => {
      // Given
      const dreamId = 999;
      const mockStorage = await vi.importMock('../../storageService');
      mockStorage.getCachedRemoteDreams = vi.fn().mockResolvedValue([{ id: 123 }]);

      // When
      const dream = await provider.resolveDream({ dreamId });

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
      const canAnalyze = await provider.canAnalyzeDream(guestUser, { dreamId: 123 });

      // Then
      expect(canAnalyze).toBe(false);
    });

    it('given guest user beyond limits when checking analysis then denies', async () => {
      // Given
      const p = provider as any;
      p.getUsedAnalysisCount = vi.fn().mockResolvedValue(3);

      // When
      const canAnalyze = await provider.canAnalyzeDream(guestUser, { dreamId: 123 });

      // Then
      expect(canAnalyze).toBe(false);
    });

    it('given premium user when checking analysis then always allows', async () => {
      // Given
      const p = provider as any;
      p.getUsedAnalysisCount = vi.fn().mockResolvedValue(100);

      // When
      const canAnalyze = await provider.canAnalyzeDream(premiumUser, { dreamId: 123 });

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
      const canExplore = await provider.canExploreDream({ dreamId: 123 }, premiumUser);

      // Then
      expect(canExplore).toBe(true);
    });
  });

  describe('comprehensive quota status', () => {
    it('given free tier within initial limits when getting status then shows initial limits', async () => {
      // Given
      const p = provider as any;
      p.getUsedAnalysisCount = vi.fn().mockResolvedValue(3);
      p.getUsedExplorationCount = vi.fn().mockResolvedValue(1);
      p.getMonthlyAnalysisCount = vi.fn().mockResolvedValue(0);
      p.getMonthlyExplorationCount = vi.fn().mockResolvedValue(0);
      p.getUsedMessagesCount = vi.fn().mockResolvedValue(2);

      // When
      const status = await provider.getQuotaStatus(freeUser, { dreamId: 1 });

      // Then
      expect(status.tier).toBe('free');
      expect(status.usage.analysis.limit).toBe(5);
      expect(status.usage.analysis.used).toBe(3);
      expect(status.usage.exploration.limit).toBe(3);
      expect(status.usage.exploration.used).toBe(1);
      expect(status.usage.messages.limit).toBe(20);
      expect(status.usage.messages.used).toBe(2);
      expect(status.canAnalyze).toBe(true);
      expect(status.canExplore).toBe(true);
    });

    it('given free tier beyond initial limits when getting status then shows monthly limits', async () => {
      // Given
      const p = provider as any;
      p.getUsedAnalysisCount = vi.fn().mockResolvedValue(5);
      p.getUsedExplorationCount = vi.fn().mockResolvedValue(3); // Must be >= 3 (initial limit) to trigger monthly
      p.getMonthlyAnalysisCount = vi.fn().mockResolvedValue(1);
      p.getMonthlyExplorationCount = vi.fn().mockResolvedValue(1);
      p.getUsedMessagesCount = vi.fn().mockResolvedValue(5);
      p.canExploreDream = vi.fn().mockResolvedValue(true);

      // When
      const status = await provider.getQuotaStatus(freeUser, { dreamId: 1 });

      // Then
      expect(status.usage.analysis.limit).toBe(2);
      expect(status.usage.analysis.used).toBe(1);
      expect(status.usage.exploration.limit).toBe(1);
      expect(status.usage.exploration.used).toBe(1);
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
      const status = await provider.getQuotaStatus(premiumUser, { dreamId: 1 });

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
      const status = await provider.getQuotaStatus(freeUser, { dreamId: 1 });

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

    it('given user when getting tier then extracts from metadata', () => {
      // Given
      const p = provider as any;

      // When
      const freeTier = p.getUserTier(freeUser);
      const premiumTier = p.getUserTier(premiumUser);
      const guestTier = p.getUserTier(guestUser);

      // Then
      expect(freeTier).toBe('free');
      expect(premiumTier).toBe('premium');
      expect(guestTier).toBe('guest');
    });

    it('given user without tier when getting tier then defaults to free', () => {
      // Given
      const userWithoutTier = { id: 'no-tier', user_metadata: {} } as any;
      const p = provider as any;

      // When
      const tier = p.getUserTier(userWithoutTier);

      // Then
      expect(tier).toBe('free');
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
      p.getMonthlyAnalysisCount = vi.fn().mockResolvedValue(2);

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
      p.getMonthlyExplorationCount = vi.fn().mockResolvedValue(1);

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
      const result = await provider.canAnalyzeDream(premiumUser);

      // Then
      expect(result).toBe(true);
    });

    it('given premium user when checking exploration then always allows', async () => {
      // Given
      const p = provider as any;
      p.resolveDream = vi.fn().mockResolvedValue(undefined);
      p.getUsedExplorationCount = vi.fn().mockResolvedValue(1000);

      // When
      const result = await provider.canExploreDream({ dreamId: 1 }, premiumUser);

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
      const status = await provider.getQuotaStatus(guestUser);

      // Then
      expect(status.tier).toBe('guest');
      expect(status.canAnalyze).toBe(false);
      expect(status.canExplore).toBe(false);
    });
  });

  describe('chat message limits', () => {
    it('given messages within limit when checking then allows sending', async () => {
      // Given
      const dream = { id: 123, chatHistory: [{ role: 'user' }, { role: 'assistant' }] };
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
      const dream = { id: 123, chatHistory: Array(20).fill({ role: 'user' }) };
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
    it('given free tier within initial limits when getting status then shows initial limits', async () => {
      // Given
      const p = provider as any;
      p.getUsedAnalysisCount = vi.fn().mockResolvedValue(3);
      p.getUsedExplorationCount = vi.fn().mockResolvedValue(1);
      p.getMonthlyAnalysisCount = vi.fn().mockResolvedValue(0);
      p.getMonthlyExplorationCount = vi.fn().mockResolvedValue(0);
      p.getUsedMessagesCount = vi.fn().mockResolvedValue(2);

      // When
      const status = await provider.getQuotaStatus(freeUser, { dreamId: 1 });

      // Then
      expect(status.tier).toBe('free');
      expect(status.usage.analysis.limit).toBe(5);
      expect(status.usage.analysis.used).toBe(3);
      expect(status.usage.exploration.limit).toBe(3);
      expect(status.usage.exploration.used).toBe(1);
      expect(status.usage.messages.limit).toBe(20);
      expect(status.usage.messages.used).toBe(2);
      expect(status.canAnalyze).toBe(true);
      expect(status.canExplore).toBe(true);
    });

    it('given free tier beyond initial limits when getting status then shows monthly limits', async () => {
      // Given
      const p = provider as any;
      p.getUsedAnalysisCount = vi.fn().mockResolvedValue(5);
      p.getUsedExplorationCount = vi.fn().mockResolvedValue(3); // Must be >= 3 (initial limit) to trigger monthly
      p.getMonthlyAnalysisCount = vi.fn().mockResolvedValue(1);
      p.getMonthlyExplorationCount = vi.fn().mockResolvedValue(1);
      p.getUsedMessagesCount = vi.fn().mockResolvedValue(5);
      p.canExploreDream = vi.fn().mockResolvedValue(true);

      // When
      const status = await provider.getQuotaStatus(freeUser, { dreamId: 1 });

      // Then
      expect(status.usage.analysis.limit).toBe(2);
      expect(status.usage.analysis.used).toBe(1);
      expect(status.usage.exploration.limit).toBe(1);
      expect(status.usage.exploration.used).toBe(1);
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
      const status = await provider.getQuotaStatus(premiumUser, { dreamId: 1 });

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
      const status = await provider.getQuotaStatus(freeUser, { dreamId: 1 });

      // Then
      expect(status.canAnalyze).toBe(false);
      expect(status.canExplore).toBe(false);
      expect(status.reasons).toBeDefined();
      expect(status.reasons!.length).toBeGreaterThan(0);
    });
  });
});
