/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { DreamAnalysis, DreamMutation, PendingImageJob, QuotaStatus } from '../../lib/types';
import { QuotaError, QuotaErrorCode } from '../../lib/errors';

// Hoist mock functions
const {
  mockGetSavedDreams,
  mockSaveDreams,
  mockGetCachedRemoteDreams,
  mockSaveCachedRemoteDreams,
  mockGetPendingDreamMutations,
  mockSavePendingDreamMutations,
  mockGetPendingImageJobs,
  mockSavePendingImageJobs,
  mockCreateDreamInSupabase,
  mockUpdateDreamInSupabase,
  mockDeleteDreamFromSupabase,
  mockFetchDreamsFromSupabase,
  mockAnalyzeDreamText,
  mockSubmitImageGenerationJob,
  mockGetImageGenerationJobStatus,
  mockGetQuotaStatus,
  mockInvalidateQuota,
  mockGetThumbnailUrl,
  mockIncrementLocalAnalysisCount,
  mockSyncWithServerCount,
  mockGuestDreamCounterState,
  mockUseAuth,
  mockGetAccessToken,
  mockMarkMockAnalysis,
} = ((factory: any) => factory())(() => ({
  mockGetSavedDreams: jest.fn<() => Promise<DreamAnalysis[]>>(),
  mockSaveDreams: jest.fn<(dreams: DreamAnalysis[]) => Promise<void>>(),
  mockGetCachedRemoteDreams: jest.fn<() => Promise<DreamAnalysis[]>>(),
  mockSaveCachedRemoteDreams: jest.fn<(dreams: DreamAnalysis[]) => Promise<void>>(),
  mockGetPendingDreamMutations: jest.fn<() => Promise<DreamMutation[]>>(),
  mockSavePendingDreamMutations: jest.fn<(mutations: DreamMutation[]) => Promise<void>>(),
  mockGetPendingImageJobs: jest.fn<() => Promise<PendingImageJob[]>>(),
  mockSavePendingImageJobs: jest.fn<(jobs: PendingImageJob[]) => Promise<void>>(),
  mockCreateDreamInSupabase: jest.fn<(dream: DreamAnalysis, userId: string) => Promise<DreamAnalysis>>(),
  mockUpdateDreamInSupabase: jest.fn<(dream: DreamAnalysis) => Promise<DreamAnalysis>>(),
  mockDeleteDreamFromSupabase: jest.fn<(remoteId: number) => Promise<void>>(),
  mockFetchDreamsFromSupabase: jest.fn<() => Promise<DreamAnalysis[]>>(),
  mockAnalyzeDreamText: jest.fn<(transcript: string, lang?: string, fingerprint?: string) => Promise<unknown>>(),
  mockSubmitImageGenerationJob: jest.fn<(request: unknown) => Promise<unknown>>(),
  mockGetImageGenerationJobStatus: jest.fn<(jobId: string) => Promise<unknown>>(),
  mockGetQuotaStatus: jest.fn<(user: unknown, tier: string, target?: unknown) => Promise<QuotaStatus>>(),
  mockInvalidateQuota: jest.fn<(user: unknown) => void>(),
  mockGetThumbnailUrl: jest.fn<(url: string | undefined) => string | undefined>(),
  mockIncrementLocalAnalysisCount: jest.fn<() => Promise<number>>(),
  mockSyncWithServerCount: jest.fn<(count: number, quotaType: 'analysis' | 'exploration') => Promise<number>>(),
  mockGuestDreamCounterState: { count: 0 },
  mockUseAuth: jest.fn<
    () => { user: { id: string; app_metadata?: Record<string, unknown> } | null; sessionReady: boolean }
  >(),
  mockGetAccessToken: jest.fn<() => Promise<string | null>>(),
  mockMarkMockAnalysis: jest.fn<() => Promise<number>>(),
}));

let mockSubscriptionStatus: any = { tier: 'free' };

// Mock dependencies
jest.mock('expo-network', () => ({
  useNetworkState: () => ({
    isInternetReachable: true,
    isConnected: true,
  }),
}));

jest.mock('expo-localization', () => ({
  useLocales: () => [
    {
      languageTag: 'en-US',
      languageCode: 'en',
      regionCode: 'US',
      textDirection: 'ltr',
    },
  ],
  getLocales: () => [
    {
      languageTag: 'en-US',
      languageCode: 'en',
      regionCode: 'US',
      textDirection: 'ltr',
    },
  ],
}));

// Ensure EXPO_PUBLIC_MOCK_MODE is not set (to avoid mock mode being enabled)
((key: string, value: unknown) => { Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); })('process', {
  ...process,
  env: {
    ...process.env,
    EXPO_PUBLIC_MOCK_MODE: '',
  },
});

// Mock AuthContext with hoisted mock function
jest.mock('../../context/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

// Mock useSubscription
jest.mock('../useSubscription', () => ({
  useSubscription: () => {
    return {
      status: mockSubscriptionStatus,
      loading: false,
    };
  },
}));

// Mock storageService
jest.mock('../../services/storageService', () => ({
  getSavedDreams: mockGetSavedDreams,
  saveDreams: mockSaveDreams,
  getCachedRemoteDreams: mockGetCachedRemoteDreams,
  saveCachedRemoteDreams: mockSaveCachedRemoteDreams,
  getPendingDreamMutations: mockGetPendingDreamMutations,
  savePendingDreamMutations: mockSavePendingDreamMutations,
  getPendingImageJobs: mockGetPendingImageJobs,
  savePendingImageJobs: mockSavePendingImageJobs,
}));

// Mock supabaseDreamService
jest.mock('../../services/supabaseDreamService', () => ({
  createDreamInSupabase: mockCreateDreamInSupabase,
  updateDreamInSupabase: mockUpdateDreamInSupabase,
  deleteDreamFromSupabase: mockDeleteDreamFromSupabase,
  fetchDreamsFromSupabase: mockFetchDreamsFromSupabase,
}));

// Mock geminiService
jest.mock('../../services/geminiService', () => ({
  analyzeDream: mockAnalyzeDreamText,
  submitImageGenerationJob: mockSubmitImageGenerationJob,
  getImageGenerationJobStatus: mockGetImageGenerationJobStatus,
}));

// Mock quotaService
jest.mock('../../services/quotaService', () => ({
  quotaService: {
    getQuotaStatus: mockGetQuotaStatus,
    invalidate: mockInvalidateQuota,
  },
}));

// Mock imageUtils
jest.mock('../../lib/imageUtils', () => ({
  getThumbnailUrl: mockGetThumbnailUrl,
}));

jest.mock('../../lib/auth', () => ({
  getAccessToken: mockGetAccessToken,
}));

// Mock GuestAnalysisCounter
jest.mock('../../services/quota/GuestAnalysisCounter', () => ({
  incrementLocalAnalysisCount: mockIncrementLocalAnalysisCount,
  syncWithServerCount: mockSyncWithServerCount,
}));

jest.mock('../../services/quota/MockQuotaEventStore', () => ({
  markMockAnalysis: mockMarkMockAnalysis,
}));

// Mock GuestDreamCounter (avoid persisting between tests)
jest.mock('../../services/quota/GuestDreamCounter', () => ({
  getGuestRecordedDreamCount: async (currentDreamCount: number) => Math.max(mockGuestDreamCounterState.count, currentDreamCount),
  incrementLocalDreamRecordingCount: async () => {
    mockGuestDreamCounterState.count += 1;
    return mockGuestDreamCounterState.count;
  },
  withGuestDreamRecordingLock: async (fn: () => Promise<unknown>) => fn(),
}));

// Mock logger
jest.mock('../../lib/logger', () => {
  const scopedLogger = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  };
  return {
    logger: scopedLogger,
    createScopedLogger: jest.fn(() => scopedLogger),
  };
});

// Import after mocks
const { useDreamJournal } = require('../useDreamJournal');

const buildDream = (overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id: Date.now(),
  transcript: 'Test dream transcript',
  title: 'Test Dream',
  interpretation: 'Test interpretation',
  shareableQuote: 'Test quote',
  imageUrl: 'https://example.com/image.jpg',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  dreamType: 'Symbolic Dream',
  theme: 'surreal',
  chatHistory: [],
  isAnalyzed: true,
  analyzedAt: Date.now(),
  analysisStatus: 'done',
  ...overrides,
});

const buildQuotaStatus = (overrides: Partial<QuotaStatus> = {}): QuotaStatus => ({
  tier: 'guest',
  canAnalyze: true,
  canExplore: true,
  usage: {
    analysis: { used: 0, limit: 3, remaining: 3 },
    exploration: { used: 0, limit: 1, remaining: 1 },
    messages: { used: 0, limit: 20, remaining: 20 },
  },
  reasons: [],
  ...overrides,
});

// Helper to set mock user for tests
const setMockUser = (user: { id: string; app_metadata?: Record<string, unknown> } | null) => {
  mockUseAuth.mockReturnValue({ user, sessionReady: Boolean(user) });
};

describe('useDreamJournal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscriptionStatus = { tier: 'free' };
    setMockUser(null);
    mockGuestDreamCounterState.count = 0;
    mockGetSavedDreams.mockResolvedValue([]);
    mockSaveDreams.mockResolvedValue(undefined);
    mockGetCachedRemoteDreams.mockResolvedValue([]);
    mockSaveCachedRemoteDreams.mockResolvedValue(undefined);
    mockGetPendingDreamMutations.mockResolvedValue([]);
    mockSavePendingDreamMutations.mockResolvedValue(undefined);
    mockGetPendingImageJobs.mockResolvedValue([]);
    mockSavePendingImageJobs.mockResolvedValue(undefined);
    mockFetchDreamsFromSupabase.mockResolvedValue([]);
    mockGetThumbnailUrl.mockImplementation((url) => url ? `${url}-thumb` : undefined);
    mockIncrementLocalAnalysisCount.mockResolvedValue(1);
    mockSyncWithServerCount.mockResolvedValue(1);
    mockGetAccessToken.mockResolvedValue('test-token');
    mockMarkMockAnalysis.mockResolvedValue(1);
    mockSubmitImageGenerationJob.mockResolvedValue({
      jobId: 'job-1',
      status: 'queued',
      clientRequestId: 'image-job-request-1',
    });
    mockGetImageGenerationJobStatus.mockResolvedValue({
      jobId: 'job-1',
      status: 'queued',
      clientRequestId: 'image-job-request-1',
    });
    mockGetQuotaStatus.mockResolvedValue(buildQuotaStatus());
  });

  describe('initialization and loading', () => {
    it('loads local dreams when not authenticated', async () => {
      const localDreams = [buildDream({ id: 1 }), buildDream({ id: 2 })];
      mockGetSavedDreams.mockResolvedValue(localDreams);

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      expect(result.current.dreams).toHaveLength(2);
      expect(mockGetSavedDreams).toHaveBeenCalled();
      expect(mockFetchDreamsFromSupabase).not.toHaveBeenCalled();
    });

    it('loads remote dreams when authenticated', async () => {
      setMockUser({ id: 'user-1' });
      const remoteDreams = [buildDream({ id: 1, remoteId: 101 })];
      mockFetchDreamsFromSupabase.mockResolvedValue(remoteDreams);

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      expect(result.current.dreams).toHaveLength(1);
      expect(mockFetchDreamsFromSupabase).toHaveBeenCalled();
      expect(mockSaveCachedRemoteDreams).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 1 })])
      );
    });

    it('falls back to cached dreams when remote fetch fails', async () => {
      setMockUser({ id: 'user-1' });
      const cachedDreams = [buildDream({ id: 1 })];
      mockFetchDreamsFromSupabase.mockRejectedValue(new Error('Network error'));
      mockGetCachedRemoteDreams.mockResolvedValue(cachedDreams);

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      expect(result.current.dreams).toHaveLength(1);
      expect(mockGetCachedRemoteDreams).toHaveBeenCalled();
    });

    it('applies pending mutations on top of remote dreams', async () => {
      setMockUser({ id: 'user-1' });
      const remoteDreams = [buildDream({ id: 1, remoteId: 101 })];
      const pendingMutations: DreamMutation[] = [
        {
          id: 'mut-1',
          type: 'create',
          createdAt: Date.now(),
          dream: buildDream({ id: 2 }),
        },
      ];

      mockFetchDreamsFromSupabase.mockResolvedValue(remoteDreams);
      mockGetPendingDreamMutations.mockResolvedValue(pendingMutations);

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      expect(result.current.dreams).toHaveLength(2);
      expect(result.current.dreams.some((d) => d.id === 2)).toBe(true);
    });

    it('normalizes dream images with thumbnails', async () => {
      const dreamWithImage = buildDream({
        id: 1,
        imageUrl: 'https://example.com/image.jpg',
        thumbnailUrl: undefined,
      });
      mockGetSavedDreams.mockResolvedValue([dreamWithImage]);

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      const dream = result.current.dreams[0];
      expect(dream.thumbnailUrl).toBe('https://example.com/image.jpg-thumb');
      expect(mockGetThumbnailUrl).toHaveBeenCalledWith('https://example.com/image.jpg');
    });
  });

  describe('addDream - local mode', () => {
    it('adds dream to local storage when not authenticated', async () => {
      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      const newDream = buildDream({ id: 1 });

      await act(async () => {
        await result.current.addDream(newDream);
      });

      expect(result.current.dreams).toHaveLength(1);
      expect(result.current.dreams[0].id).toBe(1);
      expect(mockSaveDreams).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 1 })])
      );
    });

    it('sorts dreams by id descending', async () => {
      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      await act(async () => {
        await result.current.addDream(buildDream({ id: 1 }));
      });

      await act(async () => {
        await result.current.addDream(buildDream({ id: 3 }));
      });

      await expect(result.current.addDream(buildDream({ id: 2 }))).rejects.toBeInstanceOf(QuotaError);
      await expect(result.current.addDream(buildDream({ id: 2 }))).rejects.toMatchObject({
        code: QuotaErrorCode.GUEST_LIMIT_REACHED,
      });
      expect(result.current.dreams.map((d) => d.id)).toEqual([3, 1]);
    });
  });

  describe('addDream - remote mode', () => {
    beforeEach(() => {
      setMockUser({ id: 'user-1' });
    });

    it('creates dream in Supabase when authenticated and online', async () => {
      const remoteDream = buildDream({ id: 1, remoteId: 101 });
      mockCreateDreamInSupabase.mockResolvedValue(remoteDream);

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      const newDream = buildDream({ id: 1 });

      await act(async () => {
        const saved = await result.current.addDream(newDream);
        expect(saved.remoteId).toBe(101);
      });

      expect(mockCreateDreamInSupabase).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
        'user-1'
      );
      expect(mockSaveCachedRemoteDreams).toHaveBeenCalled();
    });

    it('queues dream when Supabase create fails', async () => {
      mockCreateDreamInSupabase.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      const newDream = buildDream({ id: 1 });

      await act(async () => {
        const saved = await result.current.addDream(newDream);
        expect(saved.pendingSync).toBe(true);
      });

      expect(mockSavePendingDreamMutations).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'create',
            dream: expect.objectContaining({ id: 1, pendingSync: true }),
          }),
        ])
      );
    });
  });

  describe('updateDream', () => {
    it('updates dream locally when not authenticated', async () => {
      const existingDream = buildDream({ id: 1, title: 'Original' });
      mockGetSavedDreams.mockResolvedValue([existingDream]);

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      const updatedDream = { ...existingDream, title: 'Updated' };

      await act(async () => {
        await result.current.updateDream(updatedDream);
      });

      expect(result.current.dreams[0].title).toBe('Updated');
      expect(mockSaveDreams).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ title: 'Updated' })])
      );
    });

    it('updates dream in Supabase when authenticated', async () => {
      setMockUser({ id: 'user-1' });
      const existingDream = buildDream({ id: 1, remoteId: 101 });
      mockFetchDreamsFromSupabase.mockResolvedValue([existingDream]);
      mockUpdateDreamInSupabase.mockResolvedValue({ ...existingDream, title: 'Updated' });

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      const updatedDream = { ...existingDream, title: 'Updated' };

      await act(async () => {
        await result.current.updateDream(updatedDream);
      });

      expect(mockUpdateDreamInSupabase).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Updated', remoteId: 101 })
      );
    });

    it('skips Supabase update when dream is unchanged', async () => {
      setMockUser({ id: 'user-1' });
      const existingDream = buildDream({ id: 1, remoteId: 101 });
      mockFetchDreamsFromSupabase.mockResolvedValue([existingDream]);

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      await act(async () => {
        await result.current.updateDream({ ...existingDream });
      });

      expect(mockUpdateDreamInSupabase).not.toHaveBeenCalled();
    });

    it('queues update when Supabase update fails', async () => {
      setMockUser({ id: 'user-1' });
      const existingDream = buildDream({ id: 1, remoteId: 101 });
      mockFetchDreamsFromSupabase.mockResolvedValue([existingDream]);
      mockUpdateDreamInSupabase.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      await act(async () => {
        await result.current.updateDream({ ...existingDream, title: 'Updated' });
      });

      expect(mockSavePendingDreamMutations).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'update',
            dream: expect.objectContaining({ pendingSync: true }),
          }),
        ])
      );
    });
  });

  describe('deleteDream', () => {
    it('deletes dream locally when not authenticated', async () => {
      const existingDream = buildDream({ id: 1 });
      mockGetSavedDreams.mockResolvedValue([existingDream]);

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      await act(async () => {
        await result.current.deleteDream(1);
      });

      expect(result.current.dreams).toHaveLength(0);
      expect(mockSaveDreams).toHaveBeenCalledWith([]);
    });

    it('deletes dream from Supabase when authenticated', async () => {
      setMockUser({ id: 'user-1' });
      const existingDream = buildDream({ id: 1, remoteId: 101 });
      mockFetchDreamsFromSupabase.mockResolvedValue([existingDream]);
      mockDeleteDreamFromSupabase.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      await act(async () => {
        await result.current.deleteDream(1);
      });

      expect(mockDeleteDreamFromSupabase).toHaveBeenCalledWith(101);
      expect(result.current.dreams).toHaveLength(0);
    });

    it('queues delete when Supabase delete fails', async () => {
      setMockUser({ id: 'user-1' });
      const existingDream = buildDream({ id: 1, remoteId: 101 });
      mockFetchDreamsFromSupabase.mockResolvedValue([existingDream]);
      mockDeleteDreamFromSupabase.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      await act(async () => {
        await result.current.deleteDream(1);
      });

      expect(mockSavePendingDreamMutations).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'delete',
            dreamId: 1,
            remoteId: 101,
          }),
        ])
      );
      expect(result.current.dreams).toHaveLength(0);
    });
  });

  describe('toggleFavorite', () => {
    it('toggles favorite locally when not authenticated', async () => {
      const existingDream = buildDream({ id: 1, isFavorite: false });
      mockGetSavedDreams.mockResolvedValue([existingDream]);

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      await act(async () => {
        await result.current.toggleFavorite(1);
      });

      expect(result.current.dreams[0].isFavorite).toBe(true);

      await act(async () => {
        await result.current.toggleFavorite(1);
      });

      expect(result.current.dreams[0].isFavorite).toBe(false);
    });

    it('updates favorite in Supabase when authenticated', async () => {
      setMockUser({ id: 'user-1' });
      const existingDream = buildDream({ id: 1, remoteId: 101, isFavorite: false });
      mockFetchDreamsFromSupabase.mockResolvedValue([existingDream]);
      mockUpdateDreamInSupabase.mockResolvedValue({ ...existingDream, isFavorite: true });

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      await act(async () => {
        await result.current.toggleFavorite(1);
      });

      expect(mockUpdateDreamInSupabase).toHaveBeenCalledWith(
        expect.objectContaining({ isFavorite: true, remoteId: 101 })
      );
      expect(result.current.dreams[0].isFavorite).toBe(true);
    });

    it('does nothing when dream not found', async () => {
      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      await act(async () => {
        await result.current.toggleFavorite(999);
      });

      expect(mockSaveDreams).not.toHaveBeenCalled();
    });
  });

  describe('analyzeDream', () => {
    beforeEach(() => {
      mockGetQuotaStatus.mockResolvedValue(buildQuotaStatus({ canAnalyze: true }));
      mockAnalyzeDreamText.mockResolvedValue({
        title: 'Analyzed Title',
        interpretation: 'Deep meaning',
        shareableQuote: 'Insightful quote',
        theme: 'surreal',
        dreamType: 'Lucid Dream',
        imagePrompt: 'A surreal landscape',
      });
      mockSubmitImageGenerationJob.mockResolvedValue({
        jobId: 'job-queued',
        status: 'queued',
        clientRequestId: 'image-job-request-queued',
      });
    });

    it('checks quota before analyzing', async () => {
      mockGetQuotaStatus.mockResolvedValue(buildQuotaStatus({ canAnalyze: false }));
      const existingDream = buildDream({ id: 1, isAnalyzed: false, analysisStatus: 'none' });
      mockGetSavedDreams.mockResolvedValue([existingDream]);

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      await expect(async () => {
        await act(async () => {
          await result.current.analyzeDream(1, 'My dream transcript');
        });
      }).rejects.toThrow(QuotaError);

      expect(mockGetQuotaStatus).toHaveBeenCalledWith(null, 'guest');
    });

    it('treats Supabase plus users as plus before RevenueCat resolves', async () => {
      setMockUser({ id: 'user-1', app_metadata: { tier: 'plus' } });
      mockSubscriptionStatus = null;
      mockGetQuotaStatus.mockResolvedValue(buildQuotaStatus({ tier: 'plus', canAnalyze: false }));

      const existingDream = buildDream({ id: 1, isAnalyzed: false, analysisStatus: 'none' });
      mockGetSavedDreams.mockResolvedValue([existingDream]);

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      await expect(async () => {
        await act(async () => {
          await result.current.analyzeDream(1, 'My dream transcript');
        });
      }).rejects.toThrow(QuotaError);

      expect(mockGetQuotaStatus).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' }),
        'plus'
      );
    });

    it('analyzes dream and queues image generation in parallel', async () => {
      const existingDream = buildDream({
        id: 1,
        isAnalyzed: false,
        analysisStatus: 'none',
        imageUrl: '',
      });
      mockGetSavedDreams.mockResolvedValue([existingDream]);

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      await act(async () => {
        await result.current.analyzeDream(1, 'My dream transcript');
      });

      expect(mockAnalyzeDreamText).toHaveBeenCalledWith('My dream transcript', undefined, 'mock-hash-fingerprint');
      expect(mockSubmitImageGenerationJob).toHaveBeenCalledWith(
        expect.objectContaining({
          transcript: 'My dream transcript',
          previousImageUrl: '',
        })
      );
      expect(mockInvalidateQuota).toHaveBeenCalled();
      expect(mockIncrementLocalAnalysisCount).toHaveBeenCalled();

      const analyzedDream = result.current.dreams[0];
      expect(analyzedDream.title).toBe('Analyzed Title');
      expect(analyzedDream.interpretation).toBe('Deep meaning');
      expect(analyzedDream.imageUrl).toBe('');
      expect(analyzedDream.isAnalyzed).toBe(true);
      expect(analyzedDream.analysisStatus).toBe('done');
      expect(analyzedDream.imageJobId).toBe('job-queued');
      expect(analyzedDream.imageJobStatus).toBe('queued');
      expect(analyzedDream.analyzedAt).toBeDefined();
    });

    it('marks image as failed if job submission fails and there is no existing image', async () => {
      const existingDream = buildDream({
        id: 1,
        isAnalyzed: false,
        analysisStatus: 'none',
        imageUrl: '',
      });
      mockGetSavedDreams.mockResolvedValue([existingDream]);
      mockSubmitImageGenerationJob.mockRejectedValue(new Error('Image generation failed'));

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      await act(async () => {
        await result.current.analyzeDream(1, 'My dream transcript');
      });

      const analyzedDream = result.current.dreams[0];
      expect(analyzedDream.isAnalyzed).toBe(true);
      expect(analyzedDream.imageGenerationFailed).toBe(true);
      expect(analyzedDream.imageJobId).toBeUndefined();
    });

    it('marks analysis as failed if analysis throws error', async () => {
      const existingDream = buildDream({
        id: 1,
        isAnalyzed: false,
        analysisStatus: 'none',
      });
      mockGetSavedDreams.mockResolvedValue([existingDream]);
      mockAnalyzeDreamText.mockRejectedValue(new Error('Analysis failed'));

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      let thrownError: Error | undefined;
      await act(async () => {
        try {
          await result.current.analyzeDream(1, 'My dream transcript');
        } catch (error) {
          thrownError = error as Error;
        }
      });

      expect(thrownError?.message).toBe('Analysis failed');

      // Wait for state update after error
      await waitFor(() => {
        const failedDream = result.current.dreams[0];
        expect(failedDream.analysisStatus).toBe('failed');
      });

      const failedDream = result.current.dreams[0];
      expect(failedDream.isAnalyzed).toBe(false);
    });

    it('passes language option to analysis', async () => {
      const existingDream = buildDream({
        id: 1,
        isAnalyzed: false,
        analysisStatus: 'none',
      });
      mockGetSavedDreams.mockResolvedValue([existingDream]);

      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      await act(async () => {
        await result.current.analyzeDream(1, 'Mon rêve', { lang: 'fr' });
      });

      expect(mockAnalyzeDreamText).toHaveBeenCalledWith('Mon rêve', 'fr', 'mock-hash-fingerprint');
    });

    it('throws error when dream not found', async () => {
      const { result } = renderHook(() => useDreamJournal());

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      await expect(async () => {
        await act(async () => {
          await result.current.analyzeDream(999, 'My dream transcript');
        });
      }).rejects.toThrow('Dream with id 999 not found');
    });
  });
});
