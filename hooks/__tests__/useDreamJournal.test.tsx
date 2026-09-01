/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { DreamAnalysis, DreamMutation, PendingImageJob, QuotaStatus } from '../../lib/types';
import { QuotaError, QuotaErrorCode } from '../../lib/errors';
import { getDreamAnalysisFreshness, hashDreamTranscript } from '../../lib/dreamAnalysisFreshness';

type AnyFunction = (...args: any[]) => any;
const typedJestFn = <T extends AnyFunction>() => jest.fn() as jest.MockedFunction<T>;

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
  mockFetchDreamFromSupabase,
  mockFetchDreamsFromSupabase,
  mockAnalyzeDreamText,
  mockSubmitDreamAnalysisJob,
  mockGetDreamAnalysisJobStatus,
  mockSubmitImageGenerationJob,
  mockGetImageGenerationJobStatus,
  mockGetQuotaStatus,
  mockInvalidateQuota,
  mockGetThumbnailUrl,
  mockIncrementLocalAnalysisCount,
  mockIncrementLocalImageCount,
  mockSyncWithServerCount,
  mockGuestDreamCounterState,
  mockUseAuth,
  mockGetAccessToken,
  mockMarkMockAnalysis,
  mockMarkMockImage,
} = ((factory: any) => factory())(() => ({
  mockGetSavedDreams: typedJestFn<() => Promise<DreamAnalysis[]>>(),
  mockSaveDreams: typedJestFn<(dreams: DreamAnalysis[]) => Promise<void>>(),
  mockGetCachedRemoteDreams: typedJestFn<() => Promise<DreamAnalysis[]>>(),
  mockSaveCachedRemoteDreams: typedJestFn<(dreams: DreamAnalysis[]) => Promise<void>>(),
  mockGetPendingDreamMutations: typedJestFn<() => Promise<DreamMutation[]>>(),
  mockSavePendingDreamMutations: typedJestFn<(mutations: DreamMutation[]) => Promise<void>>(),
  mockGetPendingImageJobs: typedJestFn<() => Promise<PendingImageJob[]>>(),
  mockSavePendingImageJobs: typedJestFn<(jobs: PendingImageJob[]) => Promise<void>>(),
  mockCreateDreamInSupabase: typedJestFn<(dream: DreamAnalysis, userId: string) => Promise<DreamAnalysis>>(),
  mockUpdateDreamInSupabase: typedJestFn<(dream: DreamAnalysis) => Promise<DreamAnalysis>>(),
  mockDeleteDreamFromSupabase: typedJestFn<(remoteId: number) => Promise<void>>(),
  mockFetchDreamFromSupabase: typedJestFn<(remoteId: number) => Promise<DreamAnalysis>>(),
  mockFetchDreamsFromSupabase: typedJestFn<() => Promise<DreamAnalysis[]>>(),
  mockAnalyzeDreamText:
    typedJestFn<(transcript: string, lang?: string, fingerprint?: string, context?: unknown) => Promise<unknown>>(),
  mockSubmitDreamAnalysisJob: typedJestFn<(request: unknown) => Promise<unknown>>(),
  mockGetDreamAnalysisJobStatus: typedJestFn<(jobId: string) => Promise<unknown>>(),
  mockSubmitImageGenerationJob: typedJestFn<(request: unknown) => Promise<unknown>>(),
  mockGetImageGenerationJobStatus: typedJestFn<(jobId: string) => Promise<unknown>>(),
  mockGetQuotaStatus: typedJestFn<(user: unknown, tier: string, target?: unknown) => Promise<QuotaStatus>>(),
  mockInvalidateQuota: typedJestFn<(user: unknown) => void>(),
  mockGetThumbnailUrl: typedJestFn<(url: string | undefined) => string | undefined>(),
  mockIncrementLocalAnalysisCount: typedJestFn<() => Promise<number>>(),
  mockIncrementLocalImageCount: typedJestFn<(claim?: { jobId?: string | null }) => Promise<number>>(),
  mockSyncWithServerCount: typedJestFn<(count: number, quotaType: 'analysis' | 'exploration' | 'image') => Promise<number>>(),
  mockGuestDreamCounterState: { count: 0 },
  mockUseAuth: typedJestFn<
    () => { user: { id: string; app_metadata?: Record<string, unknown> } | null; sessionReady: boolean }
  >(),
  mockGetAccessToken: typedJestFn<() => Promise<string | null>>(),
  mockMarkMockAnalysis: typedJestFn<() => Promise<number>>(),
  mockMarkMockImage: typedJestFn<(dream?: { id: number }) => Promise<number>>(),
}));

let mockSubscriptionStatus: any = { tier: 'free' };
const mockEnvState = { analysisJobsEnabled: false, mockMode: false };

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

jest.mock('../../lib/env', () => ({
  ...(jest.requireActual('../../lib/env') as Record<string, unknown>),
  isMockModeEnabled: () => mockEnvState.mockMode,
  isAnalysisJobsEnabled: () => mockEnvState.analysisJobsEnabled,
}));

// Ensure EXPO_PUBLIC_MOCK_MODE is not set (to avoid mock mode being enabled)
((key: string, value: unknown) => { Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); })('process', {
  ...process,
  env: {
    ...process.env,
    EXPO_PUBLIC_MOCK_MODE: '',
    EXPO_PUBLIC_ANALYSIS_JOBS_ENABLED: '',
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
  fetchDreamFromSupabase: mockFetchDreamFromSupabase,
  fetchDreamsFromSupabase: mockFetchDreamsFromSupabase,
}));

// Mock geminiService
jest.mock('../../services/geminiService', () => ({
  analyzeDream: mockAnalyzeDreamText,
  submitDreamAnalysisJob: mockSubmitDreamAnalysisJob,
  getDreamAnalysisJobStatus: mockGetDreamAnalysisJobStatus,
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
  incrementLocalImageCount: mockIncrementLocalImageCount,
  syncWithServerCount: mockSyncWithServerCount,
}));

jest.mock('../../services/quota/MockQuotaEventStore', () => ({
  markMockAnalysis: mockMarkMockAnalysis,
  markMockImage: mockMarkMockImage,
}));

// Mock GuestDreamCounter (avoid persisting between tests)
jest.mock('../../services/quota/GuestDreamCounter', () => ({
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

jest.mock('../../lib/productAnalytics', () => ({
  setProductAnalyticsLocale: jest.fn(),
}));

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

const legacyMutation = (mutation: {
  id: string;
  type: DreamMutation['operation'];
  dream?: DreamAnalysis;
  dreamId?: number;
  remoteId?: number;
  createdAt: number;
}): DreamMutation => mutation as unknown as DreamMutation;

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

const FAST_WAIT_OPTIONS = { interval: 1 } as const;

const renderLoadedDreamJournal = async () => {
  const hook = renderHook(() => useDreamJournal());

  await waitFor(() => {
    expect(hook.result.current.loaded).toBe(true);
  }, FAST_WAIT_OPTIONS);

  return hook;
};

describe('useDreamJournal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscriptionStatus = { tier: 'free' };
    mockEnvState.analysisJobsEnabled = false;
    mockEnvState.mockMode = false;
    setMockUser(null);
    mockGuestDreamCounterState.count = 0;
    process.env.EXPO_PUBLIC_ANALYSIS_JOBS_ENABLED = '';
    mockGetSavedDreams.mockResolvedValue([]);
    mockSaveDreams.mockResolvedValue(undefined);
    mockGetCachedRemoteDreams.mockResolvedValue([]);
    mockSaveCachedRemoteDreams.mockResolvedValue(undefined);
    mockGetPendingDreamMutations.mockResolvedValue([]);
    mockSavePendingDreamMutations.mockResolvedValue(undefined);
    mockGetPendingImageJobs.mockResolvedValue([]);
    mockSavePendingImageJobs.mockResolvedValue(undefined);
    mockFetchDreamsFromSupabase.mockResolvedValue([]);
    mockFetchDreamFromSupabase.mockResolvedValue(buildDream({ remoteId: 101 }));
    mockGetThumbnailUrl.mockImplementation((url: string | undefined) => url ? `${url}-thumb` : undefined);
    mockIncrementLocalAnalysisCount.mockResolvedValue(1);
    mockIncrementLocalImageCount.mockResolvedValue(1);
    mockSyncWithServerCount.mockResolvedValue(1);
    mockGetAccessToken.mockResolvedValue('test-token');
    mockMarkMockAnalysis.mockResolvedValue(1);
    mockMarkMockImage.mockResolvedValue(1);
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
    mockSubmitDreamAnalysisJob.mockResolvedValue({
      jobId: 'analysis-job-1',
      status: 'queued',
      clientRequestId: 'analysis-request-1',
    });
    mockGetDreamAnalysisJobStatus.mockResolvedValue({
      jobId: 'analysis-job-1',
      status: 'succeeded',
      clientRequestId: 'analysis-request-1',
      resultPayload: { dreamId: 101 },
    });
    mockGetQuotaStatus.mockResolvedValue(buildQuotaStatus());
  });

  describe('initialization and loading', () => {
    it('loads local dreams when not authenticated', async () => {
      const localDreams = [buildDream({ id: 1 }), buildDream({ id: 2 })];
      mockGetSavedDreams.mockResolvedValue(localDreams);

      const { result } = await renderLoadedDreamJournal();

      expect(result.current.dreams).toHaveLength(2);
      expect(mockGetSavedDreams).toHaveBeenCalled();
      expect(mockFetchDreamsFromSupabase).not.toHaveBeenCalled();
    });

    it('loads remote dreams when authenticated', async () => {
      setMockUser({ id: 'user-1' });
      const remoteDreams = [buildDream({ id: 1, remoteId: 101 })];
      mockFetchDreamsFromSupabase.mockResolvedValue(remoteDreams);

      const { result } = await renderLoadedDreamJournal();

      expect(result.current.dreams).toHaveLength(1);
      expect(mockFetchDreamsFromSupabase).toHaveBeenCalled();
      expect(mockSaveCachedRemoteDreams).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 1 })]),
        'user:user-1'
      );
    });

    it('falls back to cached dreams when remote fetch fails', async () => {
      setMockUser({ id: 'user-1' });
      const cachedDreams = [buildDream({ id: 1 })];
      mockFetchDreamsFromSupabase.mockRejectedValue(new Error('Network error'));
      mockGetCachedRemoteDreams.mockResolvedValue(cachedDreams);

      const { result } = await renderLoadedDreamJournal();

      expect(result.current.dreams).toHaveLength(1);
      expect(mockGetCachedRemoteDreams).toHaveBeenCalled();
    });

    it('applies pending mutations on top of remote dreams', async () => {
      setMockUser({ id: 'user-1' });
      const remoteDreams = [buildDream({ id: 1, remoteId: 101 })];
      const pendingMutations: DreamMutation[] = [
        legacyMutation({
          id: 'mut-1',
          type: 'create',
          createdAt: Date.now(),
          dream: buildDream({ id: 2 }),
        }),
      ];

      mockFetchDreamsFromSupabase.mockResolvedValue(remoteDreams);
      mockGetPendingDreamMutations.mockResolvedValue(pendingMutations);

      const { result } = await renderLoadedDreamJournal();

      expect(result.current.dreams).toHaveLength(2);
      expect(result.current.dreams.some((d: DreamAnalysis) => d.id === 2)).toBe(true);
    });

    it('normalizes dream images with thumbnails', async () => {
      const dreamWithImage = buildDream({
        id: 1,
        imageUrl: 'https://example.com/image.jpg',
        thumbnailUrl: undefined,
      });
      mockGetSavedDreams.mockResolvedValue([dreamWithImage]);

      const { result } = await renderLoadedDreamJournal();

      const dream = result.current.dreams[0];
      expect(dream.thumbnailUrl).toBe('https://example.com/image.jpg-thumb');
      expect(mockGetThumbnailUrl).toHaveBeenCalledWith('https://example.com/image.jpg');
    });
  });

  describe('addDream - local mode', () => {
    it('adds dream to local storage when not authenticated', async () => {
      const { result } = await renderLoadedDreamJournal();

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
      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.addDream(buildDream({ id: 1 }));
      });

      await act(async () => {
        await result.current.addDream(buildDream({ id: 3 }));
      });

      await act(async () => {
        await result.current.addDream(buildDream({ id: 2 }));
      });

      expect(result.current.dreams.map((d: DreamAnalysis) => d.id)).toEqual([3, 2, 1]);
    });

    it('saves at least 3 guest dreams even when the historical counter exceeds 2', async () => {
      mockGuestDreamCounterState.count = 9;
      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.addDream(buildDream({ id: 1 }));
      });
      await act(async () => {
        await result.current.addDream(buildDream({ id: 2 }));
      });
      await act(async () => {
        await result.current.addDream(buildDream({ id: 3 }));
      });

      expect(result.current.dreams).toHaveLength(3);
      expect(result.current.dreams.map((d: DreamAnalysis) => d.id)).toEqual([3, 2, 1]);
      expect(mockSaveDreams).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 1 }),
          expect.objectContaining({ id: 2 }),
          expect.objectContaining({ id: 3 }),
        ])
      );
      expect(mockGuestDreamCounterState.count).toBe(12);
    });
  });

  describe('addDream - remote mode', () => {
    beforeEach(() => {
      setMockUser({ id: 'user-1' });
    });

    it('persists a 10000-character transcript locally and passes it unchanged to remote create', async () => {
      const longTranscript = 'a'.repeat(10_000);
      const remoteDream = buildDream({ id: 1, remoteId: 101, transcript: longTranscript });
      mockCreateDreamInSupabase.mockResolvedValue(remoteDream);

      const { result } = await renderLoadedDreamJournal();
      const newDream = buildDream({ id: 1, transcript: longTranscript });

      await act(async () => {
        const saved = await result.current.addDream(newDream);
        expect(saved.transcript).toBe(longTranscript);
        expect(saved.transcript).toHaveLength(10_000);
      });

      expect(result.current.dreams[0].transcript).toBe(longTranscript);
      expect(mockSaveCachedRemoteDreams).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 1, transcript: longTranscript }),
        ]),
        'user:user-1'
      );
      expect(mockSavePendingDreamMutations).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            operation: 'create',
            payload: expect.objectContaining({
              dream: expect.objectContaining({ id: 1, transcript: longTranscript }),
            }),
          }),
        ]),
        'user:user-1'
      );

      await waitFor(() => {
        expect(mockCreateDreamInSupabase).toHaveBeenCalledWith(
          expect.objectContaining({ id: 1, transcript: longTranscript }),
          'user-1'
        );
      }, FAST_WAIT_OPTIONS);
    });

    it('persists locally before creating the authenticated dream in Supabase', async () => {
      const remoteDream = buildDream({ id: 1, remoteId: 101 });
      let resolveRemoteCreate: ((dream: DreamAnalysis) => void) | undefined;
      mockCreateDreamInSupabase.mockImplementationOnce(
        () => new Promise((resolve) => {
          resolveRemoteCreate = resolve;
        })
      );

      const { result } = await renderLoadedDreamJournal();

      const newDream = buildDream({ id: 1 });
      let savedDream: DreamAnalysis | undefined;

      await act(async () => {
        savedDream = await result.current.addDream(newDream);
      });

      expect(savedDream).toEqual(expect.objectContaining({ id: 1, pendingSync: true }));
      expect(savedDream?.remoteId).toBeUndefined();

      await waitFor(() => {
        expect(mockCreateDreamInSupabase).toHaveBeenCalledWith(
          expect.objectContaining({ id: 1 }),
          'user-1'
        );
      }, FAST_WAIT_OPTIONS);

      await act(async () => {
        resolveRemoteCreate?.(remoteDream);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.dreams[0].remoteId).toBe(101);
      }, FAST_WAIT_OPTIONS);
    });

    it('preserves remembered dream metadata when the remote create response omits memory', async () => {
      const memory: NonNullable<DreamAnalysis['memory']> = {
        version: 1,
        origin: 'remembered',
        anchorDream: true,
        dejaVu: true,
        rememberedKind: 'recurring',
        approximatePeriod: 'childhood',
        strongestFragment: 'place',
        createdFrom: 'onboarding',
        createdFromOnboarding: true,
      };
      const remoteDream = buildDream({ id: 1, remoteId: 101, memory: undefined });
      mockCreateDreamInSupabase.mockResolvedValue(remoteDream);

      const { result } = await renderLoadedDreamJournal();

      const newDream = buildDream({ id: 1, memory });

      await act(async () => {
        const saved = await result.current.addDream(newDream);
        expect(saved.memory).toEqual(memory);
      });

      await waitFor(() => {
        expect(result.current.dreams[0].memory).toEqual(memory);
      }, FAST_WAIT_OPTIONS);
    });

    it('queues dream when Supabase create fails', async () => {
      mockCreateDreamInSupabase.mockRejectedValue(new Error('Network error'));

      const { result } = await renderLoadedDreamJournal();

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
        ]),
        'user:user-1'
      );
    });
  });

  describe('updateDream', () => {
    it('updates dream locally when not authenticated', async () => {
      const existingDream = buildDream({ id: 1, title: 'Original' });
      mockGetSavedDreams.mockResolvedValue([existingDream]);

      const { result } = await renderLoadedDreamJournal();

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

      const { result } = await renderLoadedDreamJournal();

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

      const { result } = await renderLoadedDreamJournal();

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

      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.updateDream({ ...existingDream, title: 'Updated' });
      });

      expect(mockSavePendingDreamMutations).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'update',
            dream: expect.objectContaining({ pendingSync: true }),
          }),
        ]),
        'user:user-1'
      );
    });

    it('keeps analysis text when the transcript is edited after analysis', async () => {
      const existingDream = buildDream({
        id: 1,
        transcript: 'Original transcript',
        interpretation: 'Kept reading',
        shareableQuote: 'Kept quote',
        isAnalyzed: true,
        analysisStatus: 'done',
        analysisTranscriptHash: hashDreamTranscript('Original transcript'),
      });
      mockGetSavedDreams.mockResolvedValue([existingDream]);

      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.updateDream({
          ...existingDream,
          transcript: 'Edited transcript',
        });
      });

      const updated = result.current.dreams[0];
      expect(updated.transcript).toBe('Edited transcript');
      expect(updated.interpretation).toBe('Kept reading');
      expect(updated.shareableQuote).toBe('Kept quote');
      expect(updated.isAnalyzed).toBe(true);
      expect(updated.analysisStatus).toBe('done');
      expect(updated.analysisTranscriptHash).toBe(hashDreamTranscript('Original transcript'));
      expect(getDreamAnalysisFreshness(updated)).toBe('stale');
    });
  });

  describe('applyDreamCategorization', () => {
    it('enriches the latest unanalyzed dream after it has been saved', async () => {
      const existingDream = buildDream({
        id: 1,
        title: 'Local title',
        analysisStatus: 'none',
        isAnalyzed: false,
      });
      mockGetSavedDreams.mockResolvedValue([existingDream]);

      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.applyDreamCategorization(1, {
          title: 'Enriched title',
          theme: 'mystical',
          dreamType: 'Lucid Dream',
          hasPerson: true,
          hasAnimal: false,
        });
      });

      expect(result.current.dreams[0]).toEqual(
        expect.objectContaining({
          title: 'Enriched title',
          theme: 'mystical',
          dreamType: 'Lucid Dream',
          hasPerson: true,
          hasAnimal: false,
        })
      );
    });

    it('does not let late categorization overwrite pending analysis', async () => {
      const pendingDream = buildDream({
        id: 1,
        title: 'Analysis title',
        analysisStatus: 'pending',
        isAnalyzed: false,
      });
      mockGetSavedDreams.mockResolvedValue([pendingDream]);

      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.applyDreamCategorization(1, {
          title: 'Late title',
          theme: 'noir',
          dreamType: 'Nightmare',
        });
      });

      expect(result.current.dreams[0].title).toBe('Analysis title');
      expect(result.current.dreams[0].analysisStatus).toBe('pending');
    });

    it('preserves the selected type for a remembered dream', async () => {
      const rememberedDream = buildDream({
        id: 1,
        dreamType: 'Recurring Dream',
        memory: { origin: 'remembered' },
        analysisStatus: 'none',
        isAnalyzed: false,
      });
      mockGetSavedDreams.mockResolvedValue([rememberedDream]);

      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.applyDreamCategorization(1, {
          title: 'Enriched memory',
          theme: 'calm',
          dreamType: 'Symbolic Dream',
        });
      });

      expect(result.current.dreams[0].title).toBe('Enriched memory');
      expect(result.current.dreams[0].dreamType).toBe('Recurring Dream');
    });
  });

  describe('deleteDream', () => {
    it('deletes dream locally when not authenticated', async () => {
      const existingDream = buildDream({ id: 1 });
      mockGetSavedDreams.mockResolvedValue([existingDream]);

      const { result } = await renderLoadedDreamJournal();

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

      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.deleteDream(1);
      });

      expect(mockDeleteDreamFromSupabase).toHaveBeenCalledWith(101, undefined);
      expect(result.current.dreams).toHaveLength(0);
    });

    it('queues delete when Supabase delete fails', async () => {
      setMockUser({ id: 'user-1' });
      const existingDream = buildDream({ id: 1, remoteId: 101 });
      mockFetchDreamsFromSupabase.mockResolvedValue([existingDream]);
      mockDeleteDreamFromSupabase.mockRejectedValue(new Error('Network error'));

      const { result } = await renderLoadedDreamJournal();

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
        ]),
        'user:user-1'
      );
      expect(result.current.dreams).toHaveLength(0);
    });
  });

  describe('toggleFavorite', () => {
    it('toggles favorite locally when not authenticated', async () => {
      const existingDream = buildDream({ id: 1, isFavorite: false });
      mockGetSavedDreams.mockResolvedValue([existingDream]);

      const { result } = await renderLoadedDreamJournal();

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

      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.toggleFavorite(1);
      });

      expect(mockUpdateDreamInSupabase).toHaveBeenCalledWith(
        expect.objectContaining({ isFavorite: true, remoteId: 101 })
      );
      expect(result.current.dreams[0].isFavorite).toBe(true);
    });

    it('does nothing when dream not found', async () => {
      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.toggleFavorite(999);
      });

      expect(mockSaveDreams).not.toHaveBeenCalled();
    });
  });

  describe('retryDreamSync', () => {
    it('rebuilds a missing update mutation for a failed remote sync', async () => {
      setMockUser({ id: 'user-1' });
      const failedSyncDream = buildDream({
        id: 1,
        remoteId: 101,
        revisionId: 'revision-1',
        syncState: 'failed',
        lastSyncError: 'Network error',
      });
      mockFetchDreamsFromSupabase.mockResolvedValue([failedSyncDream]);
      mockUpdateDreamInSupabase.mockImplementation(async (dream: DreamAnalysis) => ({
        ...dream,
        syncState: 'clean',
      }));

      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.retryDreamSync(1);
      });

      expect(mockUpdateDreamInSupabase).toHaveBeenCalledWith(
        expect.objectContaining({ remoteId: 101 })
      );
    });
  });

  describe('resolveDreamConflict', () => {
    it('rebases the local version on the latest server revision before syncing it', async () => {
      setMockUser({ id: 'user-1' });
      const staleServerDream = buildDream({
        id: 1,
        remoteId: 101,
        revisionId: 'server-revision-old',
        title: 'Old server title',
      });
      const conflictedDream = buildDream({
        id: 1,
        remoteId: 101,
        revisionId: 'local-revision-stale',
        title: 'Successful local analysis',
        syncState: 'conflict',
        lastSyncError: 'Dream revision conflict',
        conflictRemoteDream: staleServerDream,
      });
      const latestServerDream = buildDream({
        id: 1,
        remoteId: 101,
        revisionId: 'server-revision-latest',
        title: 'Latest server title',
      });
      mockFetchDreamsFromSupabase
        .mockResolvedValueOnce([conflictedDream])
        .mockResolvedValueOnce([latestServerDream]);
      mockUpdateDreamInSupabase.mockImplementation(async (dream: DreamAnalysis) => ({
        ...dream,
        revisionId: 'server-revision-acked',
        syncState: 'clean',
      }));

      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.resolveDreamConflict(1, 'keep_local');
      });

      expect(mockFetchDreamsFromSupabase).toHaveBeenCalledTimes(2);
      expect(mockUpdateDreamInSupabase).toHaveBeenCalledWith(
        expect.objectContaining({
          remoteId: 101,
          revisionId: 'server-revision-latest',
          title: 'Successful local analysis',
        })
      );
    });

    it('loads the latest server version instead of a stale conflict snapshot', async () => {
      setMockUser({ id: 'user-1' });
      const conflictedDream = buildDream({
        id: 1,
        remoteId: 101,
        title: 'Successful local analysis',
        syncState: 'conflict',
        conflictRemoteDream: buildDream({
          id: 1,
          remoteId: 101,
          revisionId: 'server-revision-old',
          title: 'Old server title',
        }),
      });
      const latestServerDream = buildDream({
        id: 1,
        remoteId: 101,
        revisionId: 'server-revision-latest',
        title: 'Latest server title',
      });
      mockFetchDreamsFromSupabase
        .mockResolvedValueOnce([conflictedDream])
        .mockResolvedValueOnce([latestServerDream]);

      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.resolveDreamConflict(1, 'use_server');
      });

      expect(result.current.dreams[0]).toEqual(
        expect.objectContaining({
          revisionId: 'server-revision-latest',
          title: 'Latest server title',
          syncState: 'clean',
        })
      );
      expect(mockUpdateDreamInSupabase).not.toHaveBeenCalled();
    });
  });

  describe('image job reconciliation', () => {
    it('refreshes the worker-owned server revision without sending a redundant image update', async () => {
      setMockUser({ id: 'user-1' });
      const dreamBeforeImageCompletion = buildDream({
        id: 1,
        remoteId: 101,
        revisionId: 'revision-before-image',
        imageUrl: '',
        imageJobId: 'job-succeeded',
        imageJobStatus: 'running',
        imageJobRequestId: 'image-request-1',
      });
      const dreamAfterWorkerUpdate = buildDream({
        id: 1,
        remoteId: 101,
        revisionId: 'revision-after-image',
        imageUrl: 'https://example.com/generated-image.jpg',
        imageGenerationFailed: false,
      });
      mockFetchDreamsFromSupabase.mockResolvedValueOnce([dreamBeforeImageCompletion]);
      mockFetchDreamFromSupabase.mockResolvedValue(dreamAfterWorkerUpdate);
      mockGetPendingImageJobs.mockResolvedValue([
        {
          dreamId: 1,
          remoteDreamId: 101,
          jobId: 'job-succeeded',
          clientRequestId: 'image-request-1',
          status: 'running',
          requestedAt: Date.now(),
        },
      ]);
      mockGetImageGenerationJobStatus.mockResolvedValue({
        jobId: 'job-succeeded',
        status: 'succeeded',
        clientRequestId: 'image-request-1',
        resultPayload: {
          imageUrl: 'https://example.com/generated-image.jpg',
        },
      });

      const { result } = await renderLoadedDreamJournal();

      await waitFor(() => {
        expect(result.current.dreams[0]).toEqual(
          expect.objectContaining({
            revisionId: 'revision-after-image',
            imageUrl: 'https://example.com/generated-image.jpg',
            syncState: 'clean',
            imageJobId: undefined,
            imageJobStatus: undefined,
          })
        );
      }, FAST_WAIT_OPTIONS);

      expect(mockFetchDreamsFromSupabase).toHaveBeenCalledTimes(1);
      expect(mockFetchDreamFromSupabase).toHaveBeenCalledWith(101);
      expect(mockUpdateDreamInSupabase).not.toHaveBeenCalled();
    });

    it('invalidates quota after a terminal image success is reconciled from the server', async () => {
      setMockUser({ id: 'user-1' });
      const pendingDream = buildDream({
        id: 1,
        remoteId: 101,
        imageUrl: '',
        imageJobId: 'job-succeeded',
        imageJobStatus: 'running',
        imageJobRequestId: 'image-request-1',
      });
      mockFetchDreamsFromSupabase.mockResolvedValueOnce([pendingDream]);
      mockFetchDreamFromSupabase.mockResolvedValue({
        ...pendingDream,
        imageUrl: 'https://example.com/generated-image.jpg',
      });
      mockGetPendingImageJobs.mockResolvedValue([
        {
          dreamId: 1,
          remoteDreamId: 101,
          jobId: 'job-succeeded',
          clientRequestId: 'image-request-1',
          status: 'running',
          requestedAt: Date.now(),
        },
      ]);
      mockGetImageGenerationJobStatus.mockResolvedValue({
        jobId: 'job-succeeded',
        status: 'succeeded',
        clientRequestId: 'image-request-1',
        resultPayload: { imageUrl: 'https://example.com/generated-image.jpg' },
      });

      const { result } = await renderLoadedDreamJournal();

      await waitFor(() => {
        expect(result.current.dreams[0].imageUrl).toBe('https://example.com/generated-image.jpg');
      }, FAST_WAIT_OPTIONS);

      expect(mockInvalidateQuota).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }));
    });

    it('invalidates quota after a terminal image success is persisted when server refresh fails', async () => {
      setMockUser({ id: 'user-1' });
      const pendingDream = buildDream({
        id: 1,
        remoteId: 101,
        imageUrl: '',
        imageJobId: 'job-succeeded',
        imageJobStatus: 'running',
        imageJobRequestId: 'image-request-1',
      });
      mockFetchDreamsFromSupabase.mockResolvedValueOnce([pendingDream]);
      mockFetchDreamFromSupabase.mockRejectedValue(new Error('refresh failed'));
      mockGetPendingImageJobs.mockResolvedValue([
        {
          dreamId: 1,
          remoteDreamId: 101,
          jobId: 'job-succeeded',
          clientRequestId: 'image-request-1',
          status: 'running',
          requestedAt: Date.now(),
        },
      ]);
      mockGetImageGenerationJobStatus.mockResolvedValue({
        jobId: 'job-succeeded',
        status: 'succeeded',
        clientRequestId: 'image-request-1',
        resultPayload: { imageUrl: 'https://example.com/local-persist.jpg' },
      });

      const { result } = await renderLoadedDreamJournal();

      await waitFor(() => {
        expect(result.current.dreams[0].imageUrl).toBe('https://example.com/local-persist.jpg');
      }, FAST_WAIT_OPTIONS);

      expect(mockSavePendingImageJobs).toHaveBeenCalledWith([]);
      expect(result.current.dreams[0].imageJobId).toBeUndefined();
      expect(mockInvalidateQuota).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }));
    });

    it('invalidates quota after a terminal image success is persisted locally', async () => {
      const pendingDream = buildDream({
        id: 1,
        imageUrl: '',
        imageJobId: 'job-local-success',
        imageJobStatus: 'queued',
        imageJobRequestId: 'image-request-local',
      });
      mockGetSavedDreams.mockResolvedValue([pendingDream]);
      mockGetPendingImageJobs.mockResolvedValue([
        {
          dreamId: 1,
          jobId: 'job-local-success',
          clientRequestId: 'image-request-local',
          status: 'queued',
          requestedAt: Date.now(),
        },
      ]);
      mockGetImageGenerationJobStatus.mockResolvedValue({
        jobId: 'job-local-success',
        status: 'succeeded',
        clientRequestId: 'image-request-local',
        resultPayload: { imageUrl: 'https://example.com/guest-image.jpg' },
      });

      const { result } = await renderLoadedDreamJournal();

      await waitFor(() => {
        expect(result.current.dreams[0].imageUrl).toBe('https://example.com/guest-image.jpg');
      }, FAST_WAIT_OPTIONS);

      expect(mockInvalidateQuota).toHaveBeenCalledWith(null);
    });

    it('increments guest image quota after a terminal image success', async () => {
      const pendingDream = buildDream({
        id: 1,
        imageUrl: '',
        imageJobId: 'job-guest-image',
        imageJobStatus: 'queued',
        imageJobRequestId: 'image-request-guest',
      });
      mockGetSavedDreams.mockResolvedValue([pendingDream]);
      mockGetPendingImageJobs.mockResolvedValue([
        {
          dreamId: 1,
          jobId: 'job-guest-image',
          clientRequestId: 'image-request-guest',
          status: 'queued',
          requestedAt: Date.now(),
        },
      ]);
      mockGetImageGenerationJobStatus.mockResolvedValue({
        jobId: 'job-guest-image',
        status: 'succeeded',
        clientRequestId: 'image-request-guest',
        resultPayload: { imageUrl: 'https://example.com/guest-image-count.jpg' },
      });

      const { result } = await renderLoadedDreamJournal();

      await waitFor(() => {
        expect(result.current.dreams[0].imageUrl).toBe('https://example.com/guest-image-count.jpg');
      }, FAST_WAIT_OPTIONS);

      expect(mockIncrementLocalImageCount).toHaveBeenCalledTimes(1);
      expect(mockIncrementLocalImageCount).toHaveBeenCalledWith({ jobId: 'job-guest-image' });
      expect(mockInvalidateQuota).toHaveBeenCalledWith(null);
      expect(mockIncrementLocalImageCount.mock.invocationCallOrder[0]).toBeLessThan(
        mockInvalidateQuota.mock.invocationCallOrder[0]
      );
    });

    it('does not increment guest image quota for authenticated users', async () => {
      setMockUser({ id: 'user-1' });
      const pendingDream = buildDream({
        id: 1,
        remoteId: 101,
        imageUrl: '',
        imageJobId: 'job-auth-image',
        imageJobStatus: 'queued',
        imageJobRequestId: 'image-request-auth',
      });
      mockFetchDreamsFromSupabase.mockResolvedValue([pendingDream]);
      mockGetPendingImageJobs.mockResolvedValue([
        {
          dreamId: 1,
          jobId: 'job-auth-image',
          clientRequestId: 'image-request-auth',
          status: 'queued',
          requestedAt: Date.now(),
        },
      ]);
      mockGetImageGenerationJobStatus.mockResolvedValue({
        jobId: 'job-auth-image',
        status: 'succeeded',
        clientRequestId: 'image-request-auth',
        resultPayload: { imageUrl: 'https://example.com/auth-image.jpg' },
      });
      mockFetchDreamFromSupabase.mockResolvedValue({
        ...pendingDream,
        imageUrl: 'https://example.com/auth-image.jpg',
      });

      const { result } = await renderLoadedDreamJournal();

      await waitFor(() => {
        expect(result.current.dreams[0].imageUrl).toBe('https://example.com/auth-image.jpg');
      }, FAST_WAIT_OPTIONS);

      expect(mockIncrementLocalImageCount).not.toHaveBeenCalled();
      expect(mockInvalidateQuota).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }));
    });

    it('keeps the pending image job when guest quota claim fails then counts once on retry', async () => {
      jest.useFakeTimers();
      mockIncrementLocalImageCount
        .mockRejectedValueOnce(new Error('image ledger unavailable'))
        .mockResolvedValueOnce(1);
      const pendingDream = buildDream({
        id: 1,
        imageUrl: '',
        imageJobId: 'job-guest-claim-retry',
        imageJobStatus: 'queued',
        imageJobRequestId: 'image-request-guest-retry',
      });
      mockGetSavedDreams.mockResolvedValue([pendingDream]);
      mockGetPendingImageJobs.mockResolvedValue([
        {
          dreamId: 1,
          jobId: 'job-guest-claim-retry',
          clientRequestId: 'image-request-guest-retry',
          status: 'queued',
          requestedAt: Date.now(),
        },
      ]);
      mockGetImageGenerationJobStatus.mockResolvedValue({
        jobId: 'job-guest-claim-retry',
        status: 'succeeded',
        clientRequestId: 'image-request-guest-retry',
        resultPayload: { imageUrl: 'https://example.com/guest-claim-retry.jpg' },
      });

      try {
        const { result } = await renderLoadedDreamJournal();

        await waitFor(() => {
          expect(result.current.dreams[0].imageUrl).toBe('https://example.com/guest-claim-retry.jpg');
        }, FAST_WAIT_OPTIONS);

        await waitFor(() => {
          expect(mockIncrementLocalImageCount).toHaveBeenCalledTimes(1);
        }, FAST_WAIT_OPTIONS);
        expect(mockSavePendingImageJobs).not.toHaveBeenCalledWith([]);

        await act(async () => {
          jest.advanceTimersByTime(2000);
        });

        await waitFor(() => {
          expect(mockIncrementLocalImageCount).toHaveBeenCalledTimes(2);
        }, FAST_WAIT_OPTIONS);
        await waitFor(() => {
          expect(mockSavePendingImageJobs).toHaveBeenCalledWith([]);
        }, FAST_WAIT_OPTIONS);

        expect(mockIncrementLocalImageCount.mock.calls).toEqual([
          [{ jobId: 'job-guest-claim-retry' }],
          [{ jobId: 'job-guest-claim-retry' }],
        ]);
      } finally {
        jest.useRealTimers();
      }
    });

    it('does not increment guest image quota after a terminal image failure', async () => {
      const pendingDream = buildDream({
        id: 1,
        imageUrl: '',
        imageJobId: 'job-guest-fail',
        imageJobStatus: 'running',
        imageJobRequestId: 'image-request-guest-fail',
      });
      mockGetSavedDreams.mockResolvedValue([pendingDream]);
      mockGetPendingImageJobs.mockResolvedValue([
        {
          dreamId: 1,
          jobId: 'job-guest-fail',
          clientRequestId: 'image-request-guest-fail',
          status: 'running',
          requestedAt: Date.now(),
        },
      ]);
      mockGetImageGenerationJobStatus.mockResolvedValue({
        jobId: 'job-guest-fail',
        status: 'failed',
        clientRequestId: 'image-request-guest-fail',
        errorCode: 'IMAGE_PROVIDER_FAILED',
        errorMessage: 'provider failed',
      });

      const { result } = await renderLoadedDreamJournal();

      await waitFor(() => {
        expect(result.current.dreams[0].imageJobId).toBeUndefined();
      }, FAST_WAIT_OPTIONS);

      expect(mockIncrementLocalImageCount).not.toHaveBeenCalled();
    });

    it('records mock image quota before invalidating on terminal success', async () => {
      mockEnvState.mockMode = true;
      const pendingDream = buildDream({
        id: 1,
        imageUrl: '',
        imageJobId: 'job-mock-success',
        imageJobStatus: 'queued',
        imageJobRequestId: 'image-request-mock',
      });
      mockGetSavedDreams.mockResolvedValue([pendingDream]);
      mockGetPendingImageJobs.mockResolvedValue([
        {
          dreamId: 1,
          jobId: 'job-mock-success',
          clientRequestId: 'image-request-mock',
          status: 'queued',
          requestedAt: Date.now(),
        },
      ]);
      mockGetImageGenerationJobStatus.mockResolvedValue({
        jobId: 'job-mock-success',
        status: 'succeeded',
        clientRequestId: 'image-request-mock',
        resultPayload: { imageUrl: 'https://example.com/mock-image.jpg' },
      });

      const { result } = await renderLoadedDreamJournal();

      await waitFor(() => {
        expect(result.current.dreams[0].imageUrl).toBe('https://example.com/mock-image.jpg');
      }, FAST_WAIT_OPTIONS);

      expect(mockMarkMockImage).toHaveBeenCalledTimes(1);
      expect(mockMarkMockImage).toHaveBeenCalledWith({ id: 1 });
      expect(mockInvalidateQuota).toHaveBeenCalledWith(null);
      expect(mockMarkMockImage.mock.invocationCallOrder[0]).toBeLessThan(
        mockInvalidateQuota.mock.invocationCallOrder[0]
      );
    });

    it('invalidates quota after terminal image success even if markMockImage fails', async () => {
      mockEnvState.mockMode = true;
      mockMarkMockImage.mockRejectedValueOnce(new Error('mock image counter failed'));
      const pendingDream = buildDream({
        id: 1,
        imageUrl: '',
        imageJobId: 'job-mock-counter-fail',
        imageJobStatus: 'queued',
        imageJobRequestId: 'image-request-mock-fail',
      });
      mockGetSavedDreams.mockResolvedValue([pendingDream]);
      mockGetPendingImageJobs.mockResolvedValue([
        {
          dreamId: 1,
          jobId: 'job-mock-counter-fail',
          clientRequestId: 'image-request-mock-fail',
          status: 'queued',
          requestedAt: Date.now(),
        },
      ]);
      mockGetImageGenerationJobStatus.mockResolvedValue({
        jobId: 'job-mock-counter-fail',
        status: 'succeeded',
        clientRequestId: 'image-request-mock-fail',
        resultPayload: { imageUrl: 'https://example.com/mock-counter-fail.jpg' },
      });

      const { result } = await renderLoadedDreamJournal();

      await waitFor(() => {
        expect(result.current.dreams[0].imageUrl).toBe('https://example.com/mock-counter-fail.jpg');
      }, FAST_WAIT_OPTIONS);

      expect(mockMarkMockImage).toHaveBeenCalledWith({ id: 1 });
      expect(mockInvalidateQuota).toHaveBeenCalledWith(null);
    });

    it('invalidates quota after terminal image success even if pending-job cleanup fails', async () => {
      const pendingDream = buildDream({
        id: 1,
        imageUrl: '',
        imageJobId: 'job-cleanup-fail',
        imageJobStatus: 'queued',
        imageJobRequestId: 'image-request-cleanup',
      });
      mockGetSavedDreams.mockResolvedValue([pendingDream]);
      mockGetPendingImageJobs.mockResolvedValue([
        {
          dreamId: 1,
          jobId: 'job-cleanup-fail',
          clientRequestId: 'image-request-cleanup',
          status: 'queued',
          requestedAt: Date.now(),
        },
      ]);
      mockGetImageGenerationJobStatus.mockResolvedValue({
        jobId: 'job-cleanup-fail',
        status: 'succeeded',
        clientRequestId: 'image-request-cleanup',
        resultPayload: { imageUrl: 'https://example.com/cleanup-fail.jpg' },
      });
      mockSavePendingImageJobs.mockRejectedValueOnce(new Error('cleanup failed'));

      const { result } = await renderLoadedDreamJournal();

      await waitFor(() => {
        expect(result.current.dreams[0].imageUrl).toBe('https://example.com/cleanup-fail.jpg');
      }, FAST_WAIT_OPTIONS);

      expect(mockInvalidateQuota).toHaveBeenCalledWith(null);
    });

    it('invalidates quota after a terminal image failure is persisted', async () => {
      const pendingDream = buildDream({
        id: 1,
        imageUrl: '',
        imageJobId: 'job-failed',
        imageJobStatus: 'running',
        imageJobRequestId: 'image-request-failed',
      });
      mockGetSavedDreams.mockResolvedValue([pendingDream]);
      mockGetPendingImageJobs.mockResolvedValue([
        {
          dreamId: 1,
          jobId: 'job-failed',
          clientRequestId: 'image-request-failed',
          status: 'running',
          requestedAt: Date.now(),
        },
      ]);
      mockGetImageGenerationJobStatus.mockResolvedValue({
        jobId: 'job-failed',
        status: 'failed',
        clientRequestId: 'image-request-failed',
        errorCode: 'IMAGE_PROVIDER_FAILED',
        errorMessage: 'illustration failed',
      });

      const { result } = await renderLoadedDreamJournal();

      await waitFor(() => {
        expect(result.current.dreams[0]).toEqual(
          expect.objectContaining({
            imageGenerationFailed: true,
            imageJobErrorCode: 'IMAGE_PROVIDER_FAILED',
            imageJobId: undefined,
          })
        );
      }, FAST_WAIT_OPTIONS);

      expect(mockInvalidateQuota).toHaveBeenCalledWith(null);
    });

    it.each(['queued', 'running'] as const)(
      'does not invalidate quota while an image job is %s',
      async (status: 'queued' | 'running') => {
        const pendingDream = buildDream({
          id: 1,
          imageUrl: '',
          imageJobId: 'job-active',
          imageJobStatus: status,
          imageJobRequestId: 'image-request-active',
        });
        mockGetSavedDreams.mockResolvedValue([pendingDream]);
        mockGetPendingImageJobs.mockResolvedValue([
          {
            dreamId: 1,
            jobId: 'job-active',
            clientRequestId: 'image-request-active',
            status,
            requestedAt: Date.now(),
          },
        ]);
        mockGetImageGenerationJobStatus.mockResolvedValue({
          jobId: 'job-active',
          status,
          clientRequestId: 'image-request-active',
        });

        await renderLoadedDreamJournal();

        await waitFor(() => {
          expect(mockGetImageGenerationJobStatus).toHaveBeenCalledWith('job-active');
        }, FAST_WAIT_OPTIONS);

        await act(async () => {
          await Promise.resolve();
        });

        expect(mockInvalidateQuota).not.toHaveBeenCalled();
      }
    );

    it('merges a fast image response into the latest analyzed dream state', async () => {
      let resolveImageStatus!: (value: {
        jobId: string;
        status: 'succeeded';
        clientRequestId: string;
        resultPayload: { imageUrl: string };
      }) => void;
      const imageStatusPromise = new Promise<{
        jobId: string;
        status: 'succeeded';
        clientRequestId: string;
        resultPayload: { imageUrl: string };
      }>((resolve) => {
        resolveImageStatus = resolve;
      });
      const pendingDream = buildDream({
        id: 1,
        interpretation: '',
        shareableQuote: '',
        imageUrl: '',
        isAnalyzed: false,
        analysisStatus: 'pending',
        imageJobId: 'job-fast',
        imageJobStatus: 'running',
        imageJobRequestId: 'image-request-fast',
      });
      mockGetSavedDreams.mockResolvedValue([pendingDream]);
      mockGetPendingImageJobs.mockResolvedValue([
        {
          dreamId: 1,
          jobId: 'job-fast',
          clientRequestId: 'image-request-fast',
          status: 'running',
          requestedAt: Date.now(),
        },
      ]);
      mockGetImageGenerationJobStatus.mockReturnValue(imageStatusPromise);

      const { result } = await renderLoadedDreamJournal();

      await waitFor(() => {
        expect(mockGetImageGenerationJobStatus).toHaveBeenCalledWith('job-fast');
      }, FAST_WAIT_OPTIONS);

      await act(async () => {
        await result.current.updateDream({
          ...result.current.dreams[0],
          title: 'Completed analysis',
          interpretation: 'The interpretation must survive image completion.',
          shareableQuote: 'Keep the latest state.',
          isAnalyzed: true,
          analysisStatus: 'done',
        });
      });

      await act(async () => {
        resolveImageStatus({
          jobId: 'job-fast',
          status: 'succeeded',
          clientRequestId: 'image-request-fast',
          resultPayload: { imageUrl: 'https://example.com/fast-image.jpg' },
        });
        await imageStatusPromise;
      });

      await waitFor(() => {
        expect(result.current.dreams[0]).toEqual(
          expect.objectContaining({
            title: 'Completed analysis',
            interpretation: 'The interpretation must survive image completion.',
            isAnalyzed: true,
            analysisStatus: 'done',
            imageUrl: 'https://example.com/fast-image.jpg',
          })
        );
      }, FAST_WAIT_OPTIONS);
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

    it('uses the durable server job for an authenticated synced dream', async () => {
      mockEnvState.analysisJobsEnabled = true;
      setMockUser({ id: 'user-1' });
      const requestId = '3f73ab45-9a14-4db9-94a3-d24724457d9e';
      const existingDream = buildDream({
        id: 1,
        remoteId: 101,
        isAnalyzed: false,
        analysisStatus: 'failed',
        analysisRequestId: requestId,
        imageUrl: '',
      });
      const analyzedRemote = buildDream({
        ...existingDream,
        title: 'Server-owned title',
        interpretation: 'Server-owned interpretation',
        isAnalyzed: true,
        analysisStatus: 'done',
      });
      mockFetchDreamsFromSupabase.mockResolvedValue([existingDream]);
      mockUpdateDreamInSupabase.mockImplementation(async (dream: DreamAnalysis) => ({ ...dream }));
      mockFetchDreamFromSupabase.mockResolvedValue(analyzedRemote);
      mockGetDreamAnalysisJobStatus.mockResolvedValue({
        jobId: 'analysis-job-1',
        status: 'succeeded',
        clientRequestId: requestId,
        resultPayload: {
          dreamId: 101,
          imageJob: {
            id: 'image-job-from-analysis',
            status: 'queued',
            client_request_id: requestId,
            dream_id: 101,
          },
        },
      });

      const { result } = await renderLoadedDreamJournal();

      let analyzed: DreamAnalysis | undefined;
      await act(async () => {
        analyzed = await result.current.analyzeDream(1, existingDream.transcript, { lang: 'fr' });
      });

      expect(mockGetQuotaStatus).not.toHaveBeenCalled();
      expect(mockAnalyzeDreamText).not.toHaveBeenCalled();
      expect(mockSubmitImageGenerationJob).not.toHaveBeenCalled();
      expect(mockSubmitDreamAnalysisJob).toHaveBeenCalledWith({
        dreamId: 101,
        analysisRequestId: requestId,
        lang: 'fr',
        replaceExistingImage: false,
      });
      expect(mockGetDreamAnalysisJobStatus).toHaveBeenCalledWith('analysis-job-1');
      expect(mockFetchDreamFromSupabase).toHaveBeenCalledWith(101);
      expect(mockSavePendingImageJobs).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ jobId: 'image-job-from-analysis' }),
        ])
      );
      expect(analyzed).toEqual(expect.objectContaining({
        title: 'Server-owned title',
        interpretation: 'Server-owned interpretation',
        analysisStatus: 'done',
        isAnalyzed: true,
        imageJobId: undefined,
        imageJobStatus: undefined,
      }));
      expect(analyzed?.analysisTranscriptHash).toBe(hashDreamTranscript(existingDream.transcript));
      expect(getDreamAnalysisFreshness(analyzed)).toBe('fresh');
    });

    it('registers a server image job only when replaceExistingImage is true', async () => {
      mockEnvState.analysisJobsEnabled = true;
      setMockUser({ id: 'user-1' });
      const requestId = '3f73ab45-9a14-4db9-94a3-d24724457d9e';
      const existingDream = buildDream({
        id: 1,
        remoteId: 101,
        isAnalyzed: false,
        analysisStatus: 'failed',
        analysisRequestId: requestId,
        imageUrl: '',
      });
      const analyzedRemote = buildDream({
        ...existingDream,
        title: 'Server-owned title',
        interpretation: 'Server-owned interpretation',
        isAnalyzed: true,
        analysisStatus: 'done',
      });
      mockFetchDreamsFromSupabase.mockResolvedValue([existingDream]);
      mockUpdateDreamInSupabase.mockImplementation(async (dream: DreamAnalysis) => ({ ...dream }));
      mockFetchDreamFromSupabase.mockResolvedValue(analyzedRemote);
      mockGetDreamAnalysisJobStatus.mockResolvedValue({
        jobId: 'analysis-job-1',
        status: 'succeeded',
        clientRequestId: requestId,
        resultPayload: {
          dreamId: 101,
          imageJob: {
            id: 'image-job-from-analysis',
            status: 'queued',
            client_request_id: requestId,
            dream_id: 101,
          },
        },
      });

      const { result } = await renderLoadedDreamJournal();

      let analyzed: DreamAnalysis | undefined;
      await act(async () => {
        analyzed = await result.current.analyzeDream(1, existingDream.transcript, {
          lang: 'fr',
          replaceExistingImage: true,
        });
      });

      expect(mockSubmitDreamAnalysisJob).toHaveBeenCalledWith({
        dreamId: 101,
        analysisRequestId: requestId,
        lang: 'fr',
        replaceExistingImage: true,
      });
      expect(analyzed).toEqual(expect.objectContaining({
        title: 'Server-owned title',
        analysisStatus: 'done',
        imageJobId: 'image-job-from-analysis',
        imageJobStatus: 'queued',
      }));
    });

    it('keeps the latest server revision when legacy image admission fails', async () => {
      setMockUser({ id: 'user-1' });
      const existingDream = buildDream({
        id: 1,
        remoteId: 101,
        revisionId: 'revision-before-analysis',
        isAnalyzed: false,
        analysisStatus: 'none',
        imageUrl: '',
      });
      mockFetchDreamsFromSupabase.mockResolvedValue([existingDream]);
      mockSubmitImageGenerationJob.mockRejectedValueOnce(
        Object.assign(new Error('Too many image requests'), { status: 429 })
      );
      mockUpdateDreamInSupabase
        .mockImplementationOnce(async (dream: DreamAnalysis) => ({
          ...dream,
          revisionId: 'revision-pending-acked',
        }))
        .mockImplementationOnce(async (dream: DreamAnalysis) => ({
          ...dream,
          revisionId: 'revision-analysis-acked',
        }))
        .mockImplementationOnce(async (dream: DreamAnalysis) => ({
          ...dream,
          revisionId: 'revision-image-failure-acked',
        }));

      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.analyzeDream(1, existingDream.transcript, {
          lang: 'fr',
          replaceExistingImage: true,
        });
      });

      expect(mockUpdateDreamInSupabase).toHaveBeenCalledTimes(3);
      expect(mockUpdateDreamInSupabase.mock.calls[1]?.[0]).toEqual(
        expect.objectContaining({
          revisionId: 'revision-pending-acked',
          title: 'Analyzed Title',
          interpretation: 'Deep meaning',
          analysisStatus: 'done',
          isAnalyzed: true,
        })
      );
      expect(mockUpdateDreamInSupabase.mock.calls[2]?.[0]).toEqual(
        expect.objectContaining({
          revisionId: 'revision-analysis-acked',
          analysisStatus: 'done',
          imageGenerationFailed: true,
          imageJobErrorCode: 'IMAGE_JOB_SUBMISSION_FAILED',
        })
      );
      expect(result.current.dreams[0]).toEqual(
        expect.objectContaining({
          revisionId: 'revision-image-failure-acked',
          syncState: 'clean',
        })
      );
    });

    it('keeps an accepted durable analysis pending when status observation goes offline', async () => {
      mockEnvState.analysisJobsEnabled = true;
      setMockUser({ id: 'user-1' });
      const requestId = '8a7d32e9-bc37-4cae-b9da-49de51ca7a2e';
      const existingDream = buildDream({
        id: 1,
        remoteId: 101,
        isAnalyzed: false,
        analysisStatus: 'failed',
        analysisRequestId: requestId,
      });
      mockFetchDreamsFromSupabase.mockResolvedValue([existingDream]);
      mockUpdateDreamInSupabase.mockImplementation(async (dream: DreamAnalysis) => ({ ...dream }));
      mockGetDreamAnalysisJobStatus.mockRejectedValue(new Error('Network unavailable'));

      const { result } = await renderLoadedDreamJournal();
      let observedError: unknown;
      await act(async () => {
        try {
          await result.current.analyzeDream(1, existingDream.transcript, { lang: 'fr' });
        } catch (error) {
          observedError = error;
        }
      });

      expect(observedError).toEqual(expect.objectContaining({ message: 'Network unavailable' }));
      expect(result.current.dreams[0]).toEqual(expect.objectContaining({
        analysisStatus: 'pending',
        analysisRequestId: requestId,
      }));
      expect(mockSubmitDreamAnalysisJob).toHaveBeenCalledTimes(1);
      expect(mockAnalyzeDreamText).not.toHaveBeenCalled();
    });

    it('surfaces a durable analysis quota denial as an upgrade error', async () => {
      mockEnvState.analysisJobsEnabled = true;
      setMockUser({ id: 'user-1' });
      const existingDream = buildDream({
        id: 1,
        remoteId: 101,
        isAnalyzed: false,
        analysisStatus: 'failed',
      });
      mockFetchDreamsFromSupabase.mockResolvedValue([existingDream]);
      mockUpdateDreamInSupabase.mockImplementation(async (dream: DreamAnalysis) => ({ ...dream }));
      mockSubmitDreamAnalysisJob.mockRejectedValueOnce(Object.assign(
        new Error('HTTP 429 Too Many Requests'),
        {
          status: 429,
          body: {
            code: 'QUOTA_EXCEEDED',
            tier: 'free',
            usage: { analysis: { used: 6, limit: 3 } },
          },
        }
      ));

      const { result } = await renderLoadedDreamJournal();
      let observedError: unknown;
      await act(async () => {
        try {
          await result.current.analyzeDream(1, existingDream.transcript, { lang: 'fr' });
        } catch (error) {
          observedError = error;
        }
      });

      expect(observedError).toEqual(expect.objectContaining({
        code: QuotaErrorCode.ANALYSIS_LIMIT_REACHED,
        tier: 'free',
        canUpgrade: true,
      }));
      expect(mockGetDreamAnalysisJobStatus).not.toHaveBeenCalled();
      expect(result.current.dreams[0]).toEqual(expect.objectContaining({
        analysisStatus: 'failed',
      }));
    });

    it('marks a durable analysis failed only after the server reports a terminal failure', async () => {
      mockEnvState.analysisJobsEnabled = true;
      setMockUser({ id: 'user-1' });
      const requestId = '81ba9f69-eeba-4e18-8697-67fb1f36446e';
      const existingDream = buildDream({
        id: 1,
        remoteId: 101,
        isAnalyzed: false,
        analysisStatus: 'failed',
        analysisRequestId: requestId,
      });
      mockFetchDreamsFromSupabase.mockResolvedValue([existingDream]);
      mockUpdateDreamInSupabase.mockImplementation(async (dream: DreamAnalysis) => ({ ...dream }));
      mockGetDreamAnalysisJobStatus.mockResolvedValue({
        jobId: 'analysis-job-1',
        status: 'failed',
        clientRequestId: requestId,
        errorCode: 'PROVIDER_FAILED',
        errorMessage: 'Dream analysis failed',
      });

      const { result } = await renderLoadedDreamJournal();
      let observedError: unknown;
      await act(async () => {
        try {
          await result.current.analyzeDream(1, existingDream.transcript, { lang: 'fr' });
        } catch (error) {
          observedError = error;
        }
      });

      expect(observedError).toEqual(expect.objectContaining({ message: 'Dream analysis failed' }));
      expect(result.current.dreams[0]).toEqual(expect.objectContaining({
        analysisStatus: 'failed',
        analysisRequestId: requestId,
      }));
      expect(mockSubmitDreamAnalysisJob).toHaveBeenCalledTimes(1);
    });

    it('checks quota before analyzing', async () => {
      mockGetQuotaStatus.mockResolvedValue(buildQuotaStatus({ canAnalyze: false }));
      const existingDream = buildDream({ id: 1, isAnalyzed: false, analysisStatus: 'none' });
      mockGetSavedDreams.mockResolvedValue([existingDream]);

      const { result } = await renderLoadedDreamJournal();

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

      const { result } = await renderLoadedDreamJournal();

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

    it('reuses the analysis image prompt when queuing image generation', async () => {
      const existingDream = buildDream({
        id: 1,
        isAnalyzed: false,
        analysisStatus: 'none',
        imageUrl: '',
      });
      mockGetSavedDreams.mockResolvedValue([existingDream]);

      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.analyzeDream(1, 'My dream transcript', { replaceExistingImage: true });
      });

      expect(mockAnalyzeDreamText).toHaveBeenCalledWith('My dream transcript', undefined, 'mock-hash-fingerprint', {
        remoteDreamId: undefined,
        analysisRequestId: expect.any(String),
      });
      const analysisRequestId = mockAnalyzeDreamText.mock.calls[0]?.[3]?.analysisRequestId;
      expect(mockSubmitImageGenerationJob).toHaveBeenCalledWith(
        expect.objectContaining({
          clientRequestId: analysisRequestId,
          prompt: 'A surreal landscape',
          previousImageUrl: undefined,
        })
      );
      expect(mockSubmitImageGenerationJob).not.toHaveBeenCalledWith(
        expect.objectContaining({ transcript: 'My dream transcript' })
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
      expect(analyzedDream.clientUpdatedAt).toEqual(expect.any(Number));
      expect(analyzedDream.analysisTranscriptHash).toBe(hashDreamTranscript(analyzedDream.transcript));
      expect(getDreamAnalysisFreshness(analyzedDream)).toBe('fresh');
    });

    it('persists the guest interpretation before image admission completes', async () => {
      let resolveImageAdmission!: (value: {
        jobId: string;
        status: 'queued';
        clientRequestId: string;
      }) => void;
      const imageAdmissionPromise = new Promise<{
        jobId: string;
        status: 'queued';
        clientRequestId: string;
      }>((resolve) => {
        resolveImageAdmission = resolve;
      });
      const existingDream = buildDream({
        id: 1,
        interpretation: '',
        shareableQuote: '',
        isAnalyzed: false,
        analysisStatus: 'none',
        imageUrl: '',
      });
      mockGetSavedDreams.mockResolvedValue([existingDream]);
      mockSubmitImageGenerationJob.mockReturnValue(imageAdmissionPromise);

      const { result } = await renderLoadedDreamJournal();
      let analysisPromise!: Promise<DreamAnalysis>;

      act(() => {
        analysisPromise = result.current.analyzeDream(1, existingDream.transcript, {
          replaceExistingImage: true,
        });
      });

      await waitFor(() => {
        expect(mockSubmitImageGenerationJob).toHaveBeenCalled();
        expect(result.current.dreams[0]).toEqual(
          expect.objectContaining({
            title: 'Analyzed Title',
            interpretation: 'Deep meaning',
            isAnalyzed: true,
            analysisStatus: 'done',
          })
        );
      }, FAST_WAIT_OPTIONS);

      await act(async () => {
        resolveImageAdmission({
          jobId: 'job-queued',
          status: 'queued',
          clientRequestId: 'image-job-request-queued',
        });
        await analysisPromise;
      });
    });

    it('reuses a persisted request id on retry and lets the server reconcile quota', async () => {
      const persistedRequestId = '3f73ab45-9a14-4db9-94a3-d24724457d9e';
      const existingDream = buildDream({
        id: 1,
        isAnalyzed: false,
        analysisStatus: 'failed',
        analysisRequestId: persistedRequestId,
        imageUrl: '',
      });
      mockGetSavedDreams.mockResolvedValue([existingDream]);
      // A previous server claim may make the optimistic quota look exhausted.
      // Retrying the same request must still reach the idempotent server claim.
      mockGetQuotaStatus.mockResolvedValue(buildQuotaStatus({ canAnalyze: false }));

      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.analyzeDream(1, 'My dream transcript');
      });

      expect(mockGetQuotaStatus).not.toHaveBeenCalled();
      expect(mockAnalyzeDreamText).toHaveBeenCalledWith(
        'My dream transcript',
        undefined,
        'mock-hash-fingerprint',
        {
          remoteDreamId: undefined,
          analysisRequestId: persistedRequestId,
        }
      );
      expect(mockSubmitImageGenerationJob).not.toHaveBeenCalled();
      expect(result.current.dreams[0]).toEqual(
        expect.objectContaining({
          analysisRequestId: persistedRequestId,
          analysisStatus: 'done',
          isAnalyzed: true,
        })
      );
    });

    it('resumes a persisted pending request without blocking on optimistic quota', async () => {
      const persistedRequestId = '9ae2bca5-975f-4f22-8d50-238aa6f67817';
      const existingDream = buildDream({
        id: 1,
        isAnalyzed: false,
        analysisStatus: 'pending',
        analysisRequestId: persistedRequestId,
        imageUrl: '',
      });
      mockGetSavedDreams.mockResolvedValue([existingDream]);
      mockGetQuotaStatus.mockResolvedValue(buildQuotaStatus({ canAnalyze: false }));

      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.analyzeDream(1, 'My dream transcript');
      });

      expect(mockGetQuotaStatus).not.toHaveBeenCalled();
      expect(mockAnalyzeDreamText).toHaveBeenCalledWith(
        'My dream transcript',
        undefined,
        'mock-hash-fingerprint',
        expect.objectContaining({ analysisRequestId: persistedRequestId })
      );
      expect(result.current.dreams[0]).toEqual(
        expect.objectContaining({
          analysisRequestId: persistedRequestId,
          analysisStatus: 'done',
          isAnalyzed: true,
        })
      );
    });

    it('re-resolves an offline-created dream after sync before submitting the image job', async () => {
      setMockUser({ id: 'user-1' });
      const localDream = buildDream({
        id: 1,
        clientRequestId: 'offline-create-1',
        isAnalyzed: false,
        analysisStatus: 'none',
        imageUrl: '',
      });
      const syncedDream = {
        ...localDream,
        id: 1000,
        remoteId: 101,
        pendingSync: undefined,
      };

      mockFetchDreamsFromSupabase.mockResolvedValue([]);
      mockGetPendingDreamMutations.mockResolvedValue([
        legacyMutation({
          id: 'mutation-create-1',
          type: 'create',
          createdAt: Date.now(),
          dream: { ...localDream, pendingSync: true },
        }),
      ]);
      mockCreateDreamInSupabase.mockResolvedValue(syncedDream);
      mockUpdateDreamInSupabase.mockImplementation(async (dream: DreamAnalysis) => ({ ...dream }));

      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.analyzeDream(1, 'My dream transcript', { replaceExistingImage: true });
      });

      expect(mockAnalyzeDreamText).toHaveBeenCalledWith('My dream transcript', undefined, undefined, {
        remoteDreamId: 101,
        analysisRequestId: expect.any(String),
      });
      expect(mockSubmitImageGenerationJob).toHaveBeenCalledWith(
        expect.objectContaining({
          dreamId: 101,
          prompt: 'A surreal landscape',
        })
      );
      expect(result.current.dreams).toHaveLength(1);
      expect(result.current.dreams[0]).toEqual(
        expect.objectContaining({
          id: 1,
          remoteId: 101,
          imageJobId: 'job-queued',
          imageJobStatus: 'queued',
        })
      );
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

      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.analyzeDream(1, 'My dream transcript', { replaceExistingImage: true });
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

      const { result } = await renderLoadedDreamJournal();

      let thrownError: Error | undefined;
      await act(async () => {
        try {
          await result.current.analyzeDream(1, 'My dream transcript');
        } catch (error) {
          thrownError = error as Error;
        }
      });

      expect(thrownError?.message).toBe('Analysis failed');

      await waitFor(() => {
        expect(result.current.dreams[0]?.analysisStatus).toBe('failed');
      }, FAST_WAIT_OPTIONS);

      const failedDream = result.current.dreams[0];
      expect(failedDream.analysisStatus).toBe('failed');
      expect(failedDream.isAnalyzed).toBe(false);
      expect(mockSubmitImageGenerationJob).not.toHaveBeenCalled();
    });

    it('passes language option to analysis', async () => {
      const existingDream = buildDream({
        id: 1,
        isAnalyzed: false,
        analysisStatus: 'none',
      });
      mockGetSavedDreams.mockResolvedValue([existingDream]);

      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.analyzeDream(1, 'Mon rêve', { lang: 'fr' });
      });

      expect(mockAnalyzeDreamText).toHaveBeenCalledWith('Mon rêve', 'fr', 'mock-hash-fingerprint', {
        remoteDreamId: undefined,
        analysisRequestId: expect.any(String),
      });
      expect(mockSubmitImageGenerationJob).not.toHaveBeenCalled();
    });

    it.each([undefined, false] as const)(
      'completes text analysis without submitting an image job when replaceExistingImage is %s',
      async (replaceExistingImage: undefined | false) => {
        const existingDream = buildDream({
          id: 1,
          interpretation: '',
          shareableQuote: '',
          isAnalyzed: false,
          analysisStatus: 'none',
          imageUrl: '',
        });
        mockGetSavedDreams.mockResolvedValue([existingDream]);
        const onProgress = jest.fn();

        const { result } = await renderLoadedDreamJournal();

        let analyzed: DreamAnalysis | undefined;
        await act(async () => {
          analyzed = await result.current.analyzeDream(
            1,
            existingDream.transcript,
            replaceExistingImage === undefined
              ? { onProgress }
              : { replaceExistingImage, onProgress }
          );
        });

        expect(mockAnalyzeDreamText).toHaveBeenCalled();
        expect(mockSubmitImageGenerationJob).not.toHaveBeenCalled();
        expect(onProgress).not.toHaveBeenCalledWith('generating_image');
        expect(onProgress).toHaveBeenCalledWith('finalizing');
        expect(onProgress).toHaveBeenCalledWith('complete');
        expect(analyzed).toEqual(
          expect.objectContaining({
            title: 'Analyzed Title',
            interpretation: 'Deep meaning',
            isAnalyzed: true,
            analysisStatus: 'done',
          })
        );
        expect(analyzed?.imageJobId).toBeUndefined();
        expect(analyzed?.imageJobStatus).toBeUndefined();
        expect(result.current.dreams[0]).toEqual(
          expect.objectContaining({
            title: 'Analyzed Title',
            interpretation: 'Deep meaning',
            isAnalyzed: true,
            analysisStatus: 'done',
          })
        );
        expect(result.current.dreams[0].imageJobId).toBeUndefined();
      }
    );

    it('preserves a pending image job while text analysis completes', async () => {
      const existingDream = buildDream({
        id: 1,
        interpretation: '',
        shareableQuote: '',
        isAnalyzed: false,
        analysisStatus: 'none',
        imageUrl: 'https://example.com/pending.jpg',
        thumbnailUrl: 'https://example.com/pending-thumb.jpg',
        imageSource: 'ai',
        imageUpdatedAt: 1_700_000_123_000,
        imageGenerationFailed: false,
        imageJobId: 'job-inflight',
        imageJobStatus: 'running',
        imageJobRequestId: 'image-request-inflight',
        imageJobErrorCode: undefined,
        imageJobErrorMessage: undefined,
      });
      mockGetSavedDreams.mockResolvedValue([existingDream]);

      const { result } = await renderLoadedDreamJournal();
      const imageSidecar = {
        imageUrl: result.current.dreams[0].imageUrl,
        thumbnailUrl: result.current.dreams[0].thumbnailUrl,
        imageSource: result.current.dreams[0].imageSource,
        imageUpdatedAt: result.current.dreams[0].imageUpdatedAt,
        imageGenerationFailed: result.current.dreams[0].imageGenerationFailed,
        imageJobId: result.current.dreams[0].imageJobId,
        imageJobStatus: result.current.dreams[0].imageJobStatus,
        imageJobRequestId: result.current.dreams[0].imageJobRequestId,
        imageJobErrorCode: result.current.dreams[0].imageJobErrorCode,
        imageJobErrorMessage: result.current.dreams[0].imageJobErrorMessage,
      };

      let analyzed: DreamAnalysis | undefined;
      await act(async () => {
        analyzed = await result.current.analyzeDream(1, existingDream.transcript);
      });

      expect(mockSubmitImageGenerationJob).not.toHaveBeenCalled();
      expect(analyzed).toEqual(
        expect.objectContaining({
          title: 'Analyzed Title',
          interpretation: 'Deep meaning',
          isAnalyzed: true,
          analysisStatus: 'done',
          ...imageSidecar,
        })
      );
      expect(result.current.dreams[0]).toEqual(
        expect.objectContaining({
          interpretation: 'Deep meaning',
          isAnalyzed: true,
          analysisStatus: 'done',
          ...imageSidecar,
        })
      );
      expect(imageSidecar).toEqual({
        imageUrl: 'https://example.com/pending.jpg',
        thumbnailUrl: 'https://example.com/pending-thumb.jpg',
        imageSource: 'ai',
        imageUpdatedAt: 1_700_000_123_000,
        imageGenerationFailed: false,
        imageJobId: 'job-inflight',
        imageJobStatus: 'running',
        imageJobRequestId: 'image-request-inflight',
        imageJobErrorCode: undefined,
        imageJobErrorMessage: undefined,
      });
    });

    it('preserves a failed image sidecar while text analysis completes', async () => {
      const existingDream = buildDream({
        id: 1,
        interpretation: '',
        shareableQuote: '',
        isAnalyzed: false,
        analysisStatus: 'none',
        imageUrl: '',
        thumbnailUrl: undefined,
        imageSource: 'ai',
        imageUpdatedAt: 1_700_000_456_000,
        imageGenerationFailed: true,
        imageJobId: undefined,
        imageJobStatus: undefined,
        imageJobRequestId: undefined,
        imageJobErrorCode: 'IMAGE_PROVIDER_FAILED',
        imageJobErrorMessage: 'previous illustration failed',
      });
      mockGetSavedDreams.mockResolvedValue([existingDream]);

      const { result } = await renderLoadedDreamJournal();
      const imageSidecar = {
        imageUrl: result.current.dreams[0].imageUrl,
        thumbnailUrl: result.current.dreams[0].thumbnailUrl,
        imageSource: result.current.dreams[0].imageSource,
        imageUpdatedAt: result.current.dreams[0].imageUpdatedAt,
        imageGenerationFailed: result.current.dreams[0].imageGenerationFailed,
        imageJobId: result.current.dreams[0].imageJobId,
        imageJobStatus: result.current.dreams[0].imageJobStatus,
        imageJobRequestId: result.current.dreams[0].imageJobRequestId,
        imageJobErrorCode: result.current.dreams[0].imageJobErrorCode,
        imageJobErrorMessage: result.current.dreams[0].imageJobErrorMessage,
      };

      let analyzed: DreamAnalysis | undefined;
      await act(async () => {
        analyzed = await result.current.analyzeDream(1, existingDream.transcript, {
          replaceExistingImage: false,
        });
      });

      expect(mockSubmitImageGenerationJob).not.toHaveBeenCalled();
      expect(analyzed).toEqual(
        expect.objectContaining({
          title: 'Analyzed Title',
          interpretation: 'Deep meaning',
          isAnalyzed: true,
          analysisStatus: 'done',
          ...imageSidecar,
        })
      );
      expect(result.current.dreams[0]).toEqual(
        expect.objectContaining({
          interpretation: 'Deep meaning',
          isAnalyzed: true,
          analysisStatus: 'done',
          ...imageSidecar,
        })
      );
      expect(imageSidecar).toEqual(
        expect.objectContaining({
          imageUrl: '',
          imageSource: 'ai',
          imageUpdatedAt: 1_700_000_456_000,
          imageGenerationFailed: true,
          imageJobId: undefined,
          imageJobStatus: undefined,
          imageJobRequestId: undefined,
          imageJobErrorCode: 'IMAGE_PROVIDER_FAILED',
          imageJobErrorMessage: 'previous illustration failed',
        })
      );
    });

    it('queues illustration when replaceExistingImage is explicitly true', async () => {
      const existingDream = buildDream({
        id: 1,
        isAnalyzed: false,
        analysisStatus: 'none',
        imageUrl: '',
      });
      mockGetSavedDreams.mockResolvedValue([existingDream]);
      const onProgress = jest.fn();

      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.analyzeDream(1, existingDream.transcript, {
          replaceExistingImage: true,
          onProgress,
        });
      });

      expect(mockSubmitImageGenerationJob).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: 'A surreal landscape' })
      );
      expect(onProgress).toHaveBeenCalledWith('generating_image');
      expect(result.current.dreams[0]).toEqual(
        expect.objectContaining({
          isAnalyzed: true,
          analysisStatus: 'done',
          imageJobId: 'job-queued',
          imageJobStatus: 'queued',
        })
      );
    });

    it('throws error when dream not found', async () => {
      const { result } = await renderLoadedDreamJournal();

      await expect(async () => {
        await act(async () => {
          await result.current.analyzeDream(999, 'My dream transcript');
        });
      }).rejects.toThrow('Dream with id 999 not found');
    });
  });

  describe('generateDreamImage', () => {
    it('reuses the analysis request id to recover a missing bundled image', async () => {
      setMockUser({ id: 'user-1' });
      const analysisRequestId = '3f73ab45-9a14-4db9-94a3-d24724457d9e';
      const analyzedDream = buildDream({
        id: 1,
        remoteId: 101,
        isAnalyzed: true,
        analysisStatus: 'done',
        analysisRequestId,
        imageUrl: '',
        imageGenerationFailed: true,
      });
      mockFetchDreamsFromSupabase.mockResolvedValue([analyzedDream]);

      const { result } = await renderLoadedDreamJournal();

      await act(async () => {
        await result.current.generateDreamImage(1, {
          transcript: analyzedDream.transcript,
        });
      });

      expect(mockSubmitImageGenerationJob).toHaveBeenCalledWith(
        expect.objectContaining({
          clientRequestId: analysisRequestId,
          dreamId: 101,
        })
      );
    });
  });
});
