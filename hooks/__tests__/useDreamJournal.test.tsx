/**
 * @vitest-environment happy-dom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DreamAnalysis, DreamMutation } from '../../lib/types';
import { QuotaError, QuotaErrorCode } from '../../lib/errors';

// Hoist mock functions
const {
  mockGetSavedDreams,
  mockSaveDreams,
  mockGetCachedRemoteDreams,
  mockSaveCachedRemoteDreams,
  mockGetPendingDreamMutations,
  mockSavePendingDreamMutations,
  mockCreateDreamInSupabase,
  mockUpdateDreamInSupabase,
  mockDeleteDreamFromSupabase,
  mockFetchDreamsFromSupabase,
  mockAnalyzeDreamText,
  mockGenerateImageFromTranscript,
  mockCanAnalyzeDream,
  mockInvalidateQuota,
  mockGetThumbnailUrl,
  mockIncrementLocalAnalysisCount,
  mockSyncWithServerCount,
  mockGuestDreamCounterState,
  mockUseAuth,
} = vi.hoisted(() => ({
  mockGetSavedDreams: vi.fn<() => Promise<DreamAnalysis[]>>(),
  mockSaveDreams: vi.fn<(dreams: DreamAnalysis[]) => Promise<void>>(),
  mockGetCachedRemoteDreams: vi.fn<() => Promise<DreamAnalysis[]>>(),
  mockSaveCachedRemoteDreams: vi.fn<(dreams: DreamAnalysis[]) => Promise<void>>(),
  mockGetPendingDreamMutations: vi.fn<() => Promise<DreamMutation[]>>(),
  mockSavePendingDreamMutations: vi.fn<(mutations: DreamMutation[]) => Promise<void>>(),
  mockCreateDreamInSupabase: vi.fn<(dream: DreamAnalysis, userId: string) => Promise<DreamAnalysis>>(),
  mockUpdateDreamInSupabase: vi.fn<(dream: DreamAnalysis) => Promise<DreamAnalysis>>(),
  mockDeleteDreamFromSupabase: vi.fn<(remoteId: number) => Promise<void>>(),
  mockFetchDreamsFromSupabase: vi.fn<() => Promise<DreamAnalysis[]>>(),
  mockAnalyzeDreamText: vi.fn<(transcript: string, lang?: string, fingerprint?: string) => Promise<unknown>>(),
  mockGenerateImageFromTranscript: vi.fn<(transcript: string, previousImageUrl?: string) => Promise<string>>(),
  mockCanAnalyzeDream: vi.fn<(user: unknown, tier: string) => Promise<boolean>>(),
  mockInvalidateQuota: vi.fn<(user: unknown) => void>(),
  mockGetThumbnailUrl: vi.fn<(url: string | undefined) => string | undefined>(),
  mockIncrementLocalAnalysisCount: vi.fn<() => Promise<number>>(),
  mockSyncWithServerCount: vi.fn<(count: number, quotaType: 'analysis' | 'exploration') => Promise<number>>(),
  mockGuestDreamCounterState: { count: 0 },
  mockUseAuth: vi.fn<
    () => { user: { id: string; app_metadata?: Record<string, unknown> } | null }
  >(),
}));

let mockSubscriptionStatus: any = { tier: 'free' };

// Mock dependencies
vi.mock('expo-network', () => ({
  useNetworkState: () => ({
    isInternetReachable: true,
    isConnected: true,
  }),
}));

// Ensure EXPO_PUBLIC_MOCK_MODE is not set (to avoid mock mode being enabled)
vi.stubGlobal('process', {
  ...process,
  env: {
    ...process.env,
    EXPO_PUBLIC_MOCK_MODE: '',
  },
});

// Mock AuthContext with hoisted mock function
vi.mock('../../context/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

// Mock useSubscription
vi.mock('../useSubscription', () => ({
  useSubscription: () => {
    return {
      status: mockSubscriptionStatus,
      loading: false,
    };
  },
}));

// Mock storageService
vi.mock('../../services/storageService', () => ({
  getSavedDreams: mockGetSavedDreams,
  saveDreams: mockSaveDreams,
  getCachedRemoteDreams: mockGetCachedRemoteDreams,
  saveCachedRemoteDreams: mockSaveCachedRemoteDreams,
  getPendingDreamMutations: mockGetPendingDreamMutations,
  savePendingDreamMutations: mockSavePendingDreamMutations,
}));

// Mock supabaseDreamService
vi.mock('../../services/supabaseDreamService', () => ({
  createDreamInSupabase: mockCreateDreamInSupabase,
  updateDreamInSupabase: mockUpdateDreamInSupabase,
  deleteDreamFromSupabase: mockDeleteDreamFromSupabase,
  fetchDreamsFromSupabase: mockFetchDreamsFromSupabase,
}));

// Mock geminiService
vi.mock('../../services/geminiService', () => ({
  analyzeDream: mockAnalyzeDreamText,
  generateImageFromTranscript: mockGenerateImageFromTranscript,
}));

// Mock quotaService
vi.mock('../../services/quotaService', () => ({
  quotaService: {
    canAnalyzeDream: mockCanAnalyzeDream,
    invalidate: mockInvalidateQuota,
  },
}));

// Mock imageUtils
vi.mock('../../lib/imageUtils', () => ({
  getThumbnailUrl: mockGetThumbnailUrl,
}));

// Mock GuestAnalysisCounter
vi.mock('../../services/quota/GuestAnalysisCounter', () => ({
  incrementLocalAnalysisCount: mockIncrementLocalAnalysisCount,
  syncWithServerCount: mockSyncWithServerCount,
}));

// Mock GuestDreamCounter (avoid persisting between tests)
vi.mock('../../services/quota/GuestDreamCounter', () => ({
  getGuestRecordedDreamCount: async (currentDreamCount: number) => Math.max(mockGuestDreamCounterState.count, currentDreamCount),
  incrementLocalDreamRecordingCount: async () => {
    mockGuestDreamCounterState.count += 1;
    return mockGuestDreamCounterState.count;
  },
  withGuestDreamRecordingLock: async (fn: () => Promise<unknown>) => fn(),
}));

// Mock logger
vi.mock('../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks
const { useDreamJournal } = await import('../useDreamJournal');

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

// Helper to set mock user for tests
const setMockUser = (user: { id: string; app_metadata?: Record<string, unknown> } | null) => {
  mockUseAuth.mockReturnValue({ user });
};

describe('useDreamJournal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscriptionStatus = { tier: 'free' };
    setMockUser(null);
    mockGuestDreamCounterState.count = 0;
    mockGetSavedDreams.mockResolvedValue([]);
    mockSaveDreams.mockResolvedValue(undefined);
    mockGetCachedRemoteDreams.mockResolvedValue([]);
    mockSaveCachedRemoteDreams.mockResolvedValue(undefined);
    mockGetPendingDreamMutations.mockResolvedValue([]);
    mockSavePendingDreamMutations.mockResolvedValue(undefined);
    mockFetchDreamsFromSupabase.mockResolvedValue([]);
    mockGetThumbnailUrl.mockImplementation((url) => url ? `${url}-thumb` : undefined);
    mockIncrementLocalAnalysisCount.mockResolvedValue(1);
    mockSyncWithServerCount.mockResolvedValue(1);
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
      mockCanAnalyzeDream.mockResolvedValue(true);
      mockAnalyzeDreamText.mockResolvedValue({
        title: 'Analyzed Title',
        interpretation: 'Deep meaning',
        shareableQuote: 'Insightful quote',
        theme: 'surreal',
        dreamType: 'Lucid Dream',
        imagePrompt: 'A surreal landscape',
      });
      mockGenerateImageFromTranscript.mockResolvedValue('https://example.com/new-image.jpg');
    });

    it('checks quota before analyzing', async () => {
      mockCanAnalyzeDream.mockResolvedValue(false);
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

      expect(mockCanAnalyzeDream).toHaveBeenCalledWith(null, 'guest');
    });

    it('treats Supabase plus users as plus before RevenueCat resolves', async () => {
      setMockUser({ id: 'user-1', app_metadata: { tier: 'plus' } });
      mockSubscriptionStatus = null;
      mockCanAnalyzeDream.mockResolvedValue(false);

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

      expect(mockCanAnalyzeDream).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' }),
        'plus'
      );
    });

    it('analyzes dream and generates image in parallel', async () => {
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
      expect(mockGenerateImageFromTranscript).toHaveBeenCalledWith('My dream transcript', '');
      expect(mockInvalidateQuota).toHaveBeenCalled();
      expect(mockIncrementLocalAnalysisCount).toHaveBeenCalled();

      const analyzedDream = result.current.dreams[0];
      expect(analyzedDream.title).toBe('Analyzed Title');
      expect(analyzedDream.interpretation).toBe('Deep meaning');
      expect(analyzedDream.imageUrl).toBe('https://example.com/new-image.jpg');
      expect(analyzedDream.isAnalyzed).toBe(true);
      expect(analyzedDream.analysisStatus).toBe('done');
      expect(analyzedDream.analyzedAt).toBeDefined();
    });

    it('marks image as failed if generation fails but analysis succeeds', async () => {
      const existingDream = buildDream({
        id: 1,
        isAnalyzed: false,
        analysisStatus: 'none',
        imageUrl: '',
      });
      mockGetSavedDreams.mockResolvedValue([existingDream]);
      mockGenerateImageFromTranscript.mockRejectedValue(new Error('Image generation failed'));

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
