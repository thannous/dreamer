/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { DreamAnalysis, DreamMutation } from '../../lib/types';
import { useOfflineSyncQueue } from '../useOfflineSyncQueue';

// Mock AuthContext
const mockUser = ((factory: any) => factory())(() => ({ current: { id: 'user-123' } as { id: string } | null }));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser.current,
  }),
}));

// Mock storageService
const mockSavePendingMutations = jest.fn().mockResolvedValue(undefined);

jest.mock('../../services/storageService', () => ({
  savePendingDreamMutations: (mutations: DreamMutation[]) => mockSavePendingMutations(mutations),
}));

// Mock supabaseDreamService
const mockCreateDream = jest.fn();
const mockUpdateDream = jest.fn();
const mockDeleteDream = jest.fn();

jest.mock('../../services/supabaseDreamService', () => ({
  createDreamInSupabase: (...args: unknown[]) => mockCreateDream(...args),
  updateDreamInSupabase: (...args: unknown[]) => mockUpdateDream(...args),
  deleteDreamFromSupabase: (...args: unknown[]) => mockDeleteDream(...args),
}));

// Mock logger
jest.mock('../../lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));


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

describe('useOfflineSyncQueue', () => {
  const defaultOptions = {
    canUseRemoteSync: true,
    hasNetwork: true,
    persistRemoteDreams: jest.fn().mockResolvedValue(undefined),
    resolveRemoteId: jest.fn((id: number) => id + 1000),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.current = { id: 'user-123' };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('initialization', () => {
    it('initializes with empty pending mutations', () => {
      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      expect(result.current.pendingMutationsRef.current).toEqual([]);
    });

    it('initializes with provided initial mutations', async () => {
      const dream = buildDream({ id: 1 });
      const initialMutations: DreamMutation[] = [
        { id: 'mut-1', type: 'create', dream, createdAt: Date.now() },
      ];

      const { result } = renderHook(() =>
        useOfflineSyncQueue({
          ...defaultOptions,
          initialMutations,
        })
      );

      await waitFor(() => {
        expect(result.current.pendingMutationsRef.current.length).toBeGreaterThan(0);
      });
    });
  });

  describe('generateMutationId', () => {
    it('returns unique mutation IDs', () => {
      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      const id1 = result.current.generateMutationId();
      const id2 = result.current.generateMutationId();

      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });
  });

  describe('setPendingMutations', () => {
    it('sets pending mutations directly', () => {
      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      const dream = buildDream({ id: 1 });
      const mutations: DreamMutation[] = [
        { id: 'mut-1', type: 'create', dream, createdAt: Date.now() },
      ];

      act(() => {
        result.current.setPendingMutations(mutations);
      });

      expect(result.current.pendingMutationsRef.current).toHaveLength(1);
      expect(result.current.pendingMutationsRef.current[0].id).toBe('mut-1');
    });

    it('adds clientRequestId if missing', () => {
      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      const dream = buildDream({ id: 1 });
      const mutations: DreamMutation[] = [
        { id: 'mut-1', type: 'create', dream, createdAt: Date.now() },
      ];

      act(() => {
        result.current.setPendingMutations(mutations);
      });

      expect(result.current.pendingMutationsRef.current[0].type).toBe('create');
      if (result.current.pendingMutationsRef.current[0].type === 'create') {
        expect(result.current.pendingMutationsRef.current[0].dream.clientRequestId).toBeDefined();
      }
    });
  });

  describe('queueOfflineOperation', () => {
    it('queues a create mutation', async () => {
      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      const dream = buildDream({ id: 1 });
      const mutation: DreamMutation = {
        id: 'mut-1',
        type: 'create',
        dream,
        createdAt: Date.now(),
      };

      await act(async () => {
        await result.current.queueOfflineOperation(mutation, [dream]);
      });

      expect(defaultOptions.persistRemoteDreams).toHaveBeenCalled();
      expect(mockSavePendingMutations).toHaveBeenCalled();
    });

    it('queues an update mutation', async () => {
      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      const dream = buildDream({ id: 1, title: 'Updated Title' });
      const mutation: DreamMutation = {
        id: 'mut-2',
        type: 'update',
        dream,
        createdAt: Date.now(),
      };

      await act(async () => {
        await result.current.queueOfflineOperation(mutation, (prev) =>
          prev.map((d) => (d.id === dream.id ? dream : d))
        );
      });

      expect(defaultOptions.persistRemoteDreams).toHaveBeenCalled();
    });

    it('queues a delete mutation', async () => {
      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      const mutation: DreamMutation = {
        id: 'mut-3',
        type: 'delete',
        dreamId: 1,
        createdAt: Date.now(),
      };

      await act(async () => {
        await result.current.queueOfflineOperation(mutation, (prev) =>
          prev.filter((d) => d.id !== 1)
        );
      });

      expect(defaultOptions.persistRemoteDreams).toHaveBeenCalled();
    });
  });

  describe('clearQueuedMutationsForDream', () => {
    it('removes all mutations for a specific dream', async () => {
      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      const dream1 = buildDream({ id: 1 });
      const dream2 = buildDream({ id: 2 });

      act(() => {
        result.current.setPendingMutations([
          { id: 'mut-1', type: 'create', dream: dream1, createdAt: Date.now() },
          { id: 'mut-2', type: 'update', dream: dream1, createdAt: Date.now() },
          { id: 'mut-3', type: 'create', dream: dream2, createdAt: Date.now() },
        ]);
      });

      let changed: boolean;
      await act(async () => {
        changed = await result.current.clearQueuedMutationsForDream(1);
      });

      expect(changed!).toBe(true);
      expect(result.current.pendingMutationsRef.current).toHaveLength(1);
      expect(result.current.pendingMutationsRef.current[0].id).toBe('mut-3');
    });

    it('returns false when no mutations match', async () => {
      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      const dream = buildDream({ id: 1 });

      act(() => {
        result.current.setPendingMutations([
          { id: 'mut-1', type: 'create', dream, createdAt: Date.now() },
        ]);
      });

      let changed: boolean;
      await act(async () => {
        changed = await result.current.clearQueuedMutationsForDream(999);
      });

      expect(changed!).toBe(false);
    });

    it('clears delete mutations by dreamId', async () => {
      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      act(() => {
        result.current.setPendingMutations([
          { id: 'mut-1', type: 'delete', dreamId: 1, createdAt: Date.now() },
          { id: 'mut-2', type: 'delete', dreamId: 2, createdAt: Date.now() },
        ]);
      });

      await act(async () => {
        await result.current.clearQueuedMutationsForDream(1);
      });

      expect(result.current.pendingMutationsRef.current).toHaveLength(1);
      expect(result.current.pendingMutationsRef.current[0].id).toBe('mut-2');
    });
  });

  describe('syncPendingMutations', () => {
    it('does not sync when remote sync is disabled', async () => {
      const options = { ...defaultOptions, canUseRemoteSync: false };
      const { result } = renderHook(() => useOfflineSyncQueue(options));

      const dream = buildDream({ id: 1 });
      act(() => {
        result.current.setPendingMutations([
          { id: 'mut-1', type: 'create', dream, createdAt: Date.now() },
        ]);
      });

      await act(async () => {
        await result.current.syncPendingMutations();
      });

      expect(mockCreateDream).not.toHaveBeenCalled();
    });

    it('does not sync when user is not authenticated', async () => {
      mockUser.current = null;
      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      const dream = buildDream({ id: 1 });
      act(() => {
        result.current.setPendingMutations([
          { id: 'mut-1', type: 'create', dream, createdAt: Date.now() },
        ]);
      });

      await act(async () => {
        await result.current.syncPendingMutations();
      });

      expect(mockCreateDream).not.toHaveBeenCalled();
    });

    it('does not sync when network is unavailable', async () => {
      const options = { ...defaultOptions, hasNetwork: false };
      const { result } = renderHook(() => useOfflineSyncQueue(options));

      const dream = buildDream({ id: 1 });
      act(() => {
        result.current.setPendingMutations([
          { id: 'mut-1', type: 'create', dream, createdAt: Date.now() },
        ]);
      });

      await act(async () => {
        await result.current.syncPendingMutations();
      });

      expect(mockCreateDream).not.toHaveBeenCalled();
    });

    it('does not sync when queue is empty', async () => {
      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      await act(async () => {
        await result.current.syncPendingMutations();
      });

      expect(mockCreateDream).not.toHaveBeenCalled();
      expect(mockUpdateDream).not.toHaveBeenCalled();
      expect(mockDeleteDream).not.toHaveBeenCalled();
    });

    it('syncs create mutations to Supabase', async () => {
      const dream = buildDream({ id: 1 });
      const createdDream = { ...dream, remoteId: 1001 };
      mockCreateDream.mockResolvedValue(createdDream);

      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      act(() => {
        result.current.setPendingMutations([
          { id: 'mut-1', type: 'create', dream, createdAt: Date.now() },
        ]);
      });

      await act(async () => {
        await result.current.syncPendingMutations();
      });

      expect(mockCreateDream).toHaveBeenCalledWith(
        expect.objectContaining({ id: dream.id }),
        'user-123'
      );
    });

    it('syncs update mutations to Supabase', async () => {
      const dream = buildDream({ id: 1, remoteId: 1001 });
      const updatedDream = { ...dream, title: 'Updated' };
      mockUpdateDream.mockResolvedValue(updatedDream);

      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      act(() => {
        result.current.setPendingMutations([
          { id: 'mut-1', type: 'update', dream, createdAt: Date.now() },
        ]);
      });

      await act(async () => {
        await result.current.syncPendingMutations();
      });

      expect(mockUpdateDream).toHaveBeenCalledWith(expect.objectContaining({ remoteId: 1001 }));
    });

    it('syncs delete mutations to Supabase', async () => {
      mockDeleteDream.mockResolvedValue(undefined);

      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      act(() => {
        result.current.setPendingMutations([
          { id: 'mut-1', type: 'delete', dreamId: 1, remoteId: 1001, createdAt: Date.now() },
        ]);
      });

      await act(async () => {
        await result.current.syncPendingMutations();
      });

      expect(mockDeleteDream).toHaveBeenCalledWith(1001);
    });
  });

  describe('error handling', () => {
    it('stops syncing on error and keeps remaining mutations', async () => {
      mockCreateDream.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      const dream = buildDream({ id: 1 });
      act(() => {
        result.current.setPendingMutations([
          { id: 'mut-1', type: 'create', dream, createdAt: Date.now() },
        ]);
      });

      await act(async () => {
        await result.current.syncPendingMutations();
      });

      // Mutation should still be in the queue
      expect(result.current.pendingMutationsRef.current).toHaveLength(1);
    });
  });
});
