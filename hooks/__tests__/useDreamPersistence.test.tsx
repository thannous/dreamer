/**
 * @vitest-environment happy-dom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DreamAnalysis, DreamMutation } from '../../lib/types';

// Mock user state
const mockUser = vi.hoisted(() => ({ current: { id: 'user-123' } as { id: string } | null }));
const mockSessionReady = vi.hoisted(() => ({ current: true }));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser.current,
    sessionReady: mockSessionReady.current,
  }),
}));

// Mock storage service
const mockGetSavedDreams = vi.fn<() => Promise<DreamAnalysis[]>>();
const mockSaveDreams = vi.fn<(dreams: DreamAnalysis[]) => Promise<void>>();
const mockGetCachedRemoteDreams = vi.fn<() => Promise<DreamAnalysis[]>>();
const mockSaveCachedRemoteDreams = vi.fn<(dreams: DreamAnalysis[]) => Promise<void>>();
const mockGetPendingMutations = vi.fn<() => Promise<DreamMutation[]>>();
const mockGetDreamsMigrationSynced = vi.fn<() => Promise<boolean>>();
const mockSetDreamsMigrationSynced = vi.fn<(userId: string, synced: boolean) => Promise<void>>();

vi.mock('../../services/storageService', () => ({
  getSavedDreams: () => mockGetSavedDreams(),
  saveDreams: (dreams: DreamAnalysis[]) => mockSaveDreams(dreams),
  getCachedRemoteDreams: () => mockGetCachedRemoteDreams(),
  saveCachedRemoteDreams: (dreams: DreamAnalysis[]) => mockSaveCachedRemoteDreams(dreams),
  getPendingDreamMutations: () => mockGetPendingMutations(),
  getDreamsMigrationSynced: () => mockGetDreamsMigrationSynced(),
  setDreamsMigrationSynced: (userId: string, synced: boolean) =>
    mockSetDreamsMigrationSynced(userId, synced),
}));

const mockGetAccessToken = vi.fn<() => Promise<string | null>>();

vi.mock('../../lib/auth', () => ({
  getAccessToken: () => mockGetAccessToken(),
}));

// Mock supabase service
const mockFetchFromSupabase = vi.fn<() => Promise<DreamAnalysis[]>>();
const mockCreateInSupabase = vi.fn();

vi.mock('../../services/supabaseDreamService', () => ({
  fetchDreamsFromSupabase: () => mockFetchFromSupabase(),
  createDreamInSupabase: (...args: unknown[]) => mockCreateInSupabase(...args),
}));

// Mock logger
vi.mock('../../lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { useDreamPersistence } from '../useDreamPersistence';

const buildDream = (overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id: Date.now(),
  transcript: 'Test dream',
  title: 'Test Title',
  interpretation: 'Test interpretation',
  shareableQuote: 'Test quote',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  ...overrides,
});

describe('useDreamPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.current = { id: 'user-123' };
    mockSessionReady.current = true;
    mockGetSavedDreams.mockResolvedValue([]);
    mockSaveDreams.mockResolvedValue(undefined);
    mockGetCachedRemoteDreams.mockResolvedValue([]);
    mockSaveCachedRemoteDreams.mockResolvedValue(undefined);
    mockGetPendingMutations.mockResolvedValue([]);
    mockGetDreamsMigrationSynced.mockResolvedValue(false);
    mockSetDreamsMigrationSynced.mockResolvedValue(undefined);
    mockFetchFromSupabase.mockResolvedValue([]);
    mockCreateInSupabase.mockResolvedValue(undefined);
    mockGetAccessToken.mockResolvedValue('access-token');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('guest mode (no remote sync)', () => {
    it('loads dreams from local storage', async () => {
      const localDreams = [buildDream({ id: 1 }), buildDream({ id: 2 })];
      mockGetSavedDreams.mockResolvedValue(localDreams);

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      expect(result.current.dreams).toHaveLength(2);
      expect(mockGetSavedDreams).toHaveBeenCalled();
      expect(mockFetchFromSupabase).not.toHaveBeenCalled();
    });

    it('persists dreams to local storage', async () => {
      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );

      await waitFor(() => expect(result.current.loaded).toBe(true));

      const newDreams = [buildDream({ id: 1 })];
      await act(async () => {
        await result.current.persistLocalDreams(newDreams);
      });

      expect(mockSaveDreams).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ id: 1 }),
      ]));
    });

    it('does not persist to remote cache when sync disabled', async () => {
      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );

      await waitFor(() => expect(result.current.loaded).toBe(true));

      await act(async () => {
        await result.current.persistRemoteDreams([buildDream({ id: 1 })]);
      });

      expect(mockSaveCachedRemoteDreams).not.toHaveBeenCalled();
    });
  });

  describe('authenticated mode (remote sync)', () => {
    it('loads dreams when session is not ready but access token exists', async () => {
      mockSessionReady.current = false;
      const remoteDreams = [buildDream({ id: 1, remoteId: 101 })];
      mockFetchFromSupabase.mockResolvedValue(remoteDreams);

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      expect(mockGetAccessToken).toHaveBeenCalled();
      expect(mockFetchFromSupabase).toHaveBeenCalled();
      expect(result.current.dreams).toHaveLength(1);
    });

    it('loads dreams from Supabase', async () => {
      const remoteDreams = [buildDream({ id: 1, remoteId: 101 })];
      mockFetchFromSupabase.mockResolvedValue(remoteDreams);

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      expect(result.current.dreams).toHaveLength(1);
      expect(mockFetchFromSupabase).toHaveBeenCalled();
    });

    it('caches fetched remote dreams', async () => {
      const remoteDreams = [buildDream({ id: 1, remoteId: 101 })];
      mockFetchFromSupabase.mockResolvedValue(remoteDreams);

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await waitFor(() => expect(result.current.loaded).toBe(true));

      expect(mockSaveCachedRemoteDreams).toHaveBeenCalled();
    });

    it('loads pending mutations from storage', async () => {
      const dream = buildDream({ id: 1 });
      const mutations: DreamMutation[] = [
        { id: 'mut-1', type: 'create', dream, createdAt: Date.now() },
      ];
      mockGetPendingMutations.mockResolvedValue(mutations);
      mockFetchFromSupabase.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await waitFor(() => expect(result.current.loaded).toBe(true));

      expect(result.current.pendingMutations).toHaveLength(1);
    });

    it('applies pending mutations to remote dreams', async () => {
      const remoteDream = buildDream({ id: 1, title: 'Original', remoteId: 101 });
      const updatedDream = buildDream({ id: 1, title: 'Updated', remoteId: 101 });
      const mutations: DreamMutation[] = [
        { id: 'mut-1', type: 'update', dream: updatedDream, createdAt: Date.now() },
      ];
      mockFetchFromSupabase.mockResolvedValue([remoteDream]);
      mockGetPendingMutations.mockResolvedValue(mutations);

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await waitFor(() => expect(result.current.loaded).toBe(true));

      // Dream should have mutation applied
      expect(result.current.dreams[0].title).toBe('Updated');
    });

    it('falls back to cached dreams on fetch error', async () => {
      const cachedDreams = [buildDream({ id: 1, remoteId: 101 })];
      mockGetCachedRemoteDreams.mockResolvedValue(cachedDreams);
      mockFetchFromSupabase.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await waitFor(() => expect(result.current.loaded).toBe(true));

      expect(result.current.dreams).toHaveLength(1);
    });

    it('persists to remote cache', async () => {
      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await waitFor(() => expect(result.current.loaded).toBe(true));

      const newDreams = [buildDream({ id: 1 })];
      await act(async () => {
        await result.current.persistRemoteDreams(newDreams);
      });

      expect(mockSaveCachedRemoteDreams).toHaveBeenCalled();
    });

    it('persists using function updater', async () => {
      const existingDream = buildDream({ id: 1 });
      mockFetchFromSupabase.mockResolvedValue([existingDream]);

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await waitFor(() => expect(result.current.loaded).toBe(true));

      const newDream = buildDream({ id: 2 });
      await act(async () => {
        await result.current.persistRemoteDreams((prev) => [...prev, newDream]);
      });

      expect(result.current.dreams).toHaveLength(2);
    });
  });

  describe('dream migration', () => {
    it('migrates unsynced local dreams to Supabase', async () => {
      const unsyncedDream = buildDream({ id: 1 }); // No remoteId
      mockGetSavedDreams.mockResolvedValue([unsyncedDream]);
      mockFetchFromSupabase.mockResolvedValue([]);

      renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));

      await waitFor(() => {
        expect(mockCreateInSupabase).toHaveBeenCalledWith(
          expect.objectContaining({ id: 1 }),
          'user-123'
        );
      });
    });

    it('skips already synced dreams during migration', async () => {
      const syncedDream = buildDream({ id: 1, remoteId: 101 });
      mockGetSavedDreams.mockResolvedValue([syncedDream]);
      mockFetchFromSupabase.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await waitFor(() => expect(result.current.loaded).toBe(true));

      expect(mockCreateInSupabase).not.toHaveBeenCalled();
    });

    it('clears local storage after migration', async () => {
      const unsyncedDream = buildDream({ id: 1 });
      mockGetSavedDreams.mockResolvedValue([unsyncedDream]);
      mockFetchFromSupabase.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await waitFor(() => expect(result.current.loaded).toBe(true));

      expect(mockSaveDreams).toHaveBeenCalledWith([]);
    });
  });

  describe('reload', () => {
    it('reloads dreams on demand', async () => {
      mockGetSavedDreams.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );

      await waitFor(() => expect(result.current.loaded).toBe(true));

      const newDreams = [buildDream({ id: 1 })];
      mockGetSavedDreams.mockResolvedValue(newDreams);

      await act(async () => {
        await result.current.reloadDreams();
      });

      expect(result.current.dreams).toHaveLength(1);
    });
  });

  describe('dreamsRef', () => {
    it('keeps ref in sync with state', async () => {
      const dreams = [buildDream({ id: 1 })];
      mockGetSavedDreams.mockResolvedValue(dreams);

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );

      await waitFor(() => expect(result.current.loaded).toBe(true));

      expect(result.current.dreamsRef.current).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('handles storage errors gracefully', async () => {
      mockGetSavedDreams.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );

      await waitFor(() => expect(result.current.loaded).toBe(true));

      expect(result.current.dreams).toEqual([]);
    });
  });
});
