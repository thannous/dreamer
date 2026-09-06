/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { DreamPersistenceError } from '../../lib/dreamStorageRead';
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
const mockSavePendingMutations = jest.fn(
  async (_mutations: DreamMutation[], _scope?: string | null): Promise<void> => undefined
);

jest.mock('../../services/storageService', () => ({
  savePendingDreamMutations: (mutations: DreamMutation[], scope?: string | null) =>
    mockSavePendingMutations(mutations, scope),
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

jest.mock('../../lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const getMockLogger = () => require('../../lib/logger').logger as {
  warn: jest.Mock;
  error: jest.Mock;
  info: jest.Mock;
  debug: jest.Mock;
};


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

const legacyMutation = (mutation: {
  id: string;
  type: DreamMutation['operation'];
  dream?: DreamAnalysis;
  dreamId?: number;
  remoteId?: number;
  createdAt: number;
}): DreamMutation => mutation as unknown as DreamMutation;

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
        legacyMutation({ id: 'mut-1', type: 'create', dream, createdAt: Date.now() }),
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

    it('does not expose or relabel an account snapshot after the account changes', async () => {
      const mutationA = legacyMutation({
        id: 'mut-a',
        type: 'create',
        dream: buildDream({ id: 1 }),
        createdAt: 1,
      });
      const mutationB = legacyMutation({
        id: 'mut-b',
        type: 'create',
        dream: buildDream({ id: 2 }),
        createdAt: 2,
      });
      let userScope = 'user:user-a';
      let snapshotScope = userScope;
      let initialMutations = [mutationA];
      const hook = renderHook(() =>
        useOfflineSyncQueue({
          ...defaultOptions,
          userScope,
          initialMutations,
          initialMutationsLoaded: true,
          initialMutationsScope: snapshotScope,
        })
      );
      expect(hook.result.current.pendingMutationsRef.current).toHaveLength(1);
      mockSavePendingMutations.mockClear();

      mockUser.current = { id: 'user-b' };
      userScope = 'user:user-b';
      hook.rerender();
      expect(hook.result.current.pendingMutationsRef.current).toEqual([]);
      expect(mockSavePendingMutations).not.toHaveBeenCalled();

      snapshotScope = userScope;
      initialMutations = [mutationB];
      hook.rerender();
      await waitFor(() => {
        expect(hook.result.current.pendingMutationsRef.current).toEqual([
          expect.objectContaining({ id: 'mut-b', userScope: 'user:user-b' }),
        ]);
      });
      expect(hook.result.current.pendingMutationsRef.current).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'mut-a' })])
      );
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
        legacyMutation({ id: 'mut-1', type: 'create', dream, createdAt: Date.now() }),
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
        legacyMutation({ id: 'mut-1', type: 'create', dream, createdAt: Date.now() }),
      ];

      act(() => {
        result.current.setPendingMutations(mutations);
      });

      expect(result.current.pendingMutationsRef.current[0].type).toBe('create');
      if (result.current.pendingMutationsRef.current[0].type === 'create') {
        expect(result.current.pendingMutationsRef.current[0].dream?.clientRequestId).toBeDefined();
      }
    });
  });

  describe('queueOfflineOperation', () => {
    it.each(['queue', 'cache'] as const)(
      'reuses the initial create mutation identity when capture is retried after a %s failure',
      async (failure: 'queue' | 'cache') => {
        const dream = buildDream({ id: 80, clientRequestId: 'same-capture-80' });
        const persistRemoteDreams = jest.fn(async (_updater: unknown): Promise<void> => undefined);
        if (failure === 'queue') mockSavePendingMutations.mockRejectedValueOnce(new Error('Queue unavailable'));
        else persistRemoteDreams.mockRejectedValueOnce(new DreamPersistenceError('write', 'remote-cache'));
        mockCreateDream.mockResolvedValue({ ...dream, remoteId: 1080 });
        const { result } = renderHook(() => useOfflineSyncQueue({ ...defaultOptions, persistRemoteDreams }));
        await expect(result.current.queueOfflineOperation(
          legacyMutation({ id: 'first-attempt', type: 'create', dream, createdAt: 80 }), [dream]
        )).rejects.toBeInstanceOf(DreamPersistenceError);
        await result.current.queueOfflineOperation(
          legacyMutation({ id: 'second-attempt', type: 'create', dream, createdAt: 81 }), [dream]
        );
        expect(result.current.pendingMutationsRef.current).toEqual([
          expect.objectContaining({ id: 'first-attempt', createdAt: 80, clientRequestId: 'same-capture-80' }),
        ]);
        await act(async () => { await result.current.syncPendingMutations(); });
        expect(mockCreateDream).toHaveBeenCalledTimes(1);
        expect(result.current.pendingMutationsRef.current).toEqual([]);
      }
    );

    it('exposes a typed write failure to capture without losing the queued operation', async () => {
      const dream = buildDream({ id: 79 });
      mockSavePendingMutations.mockRejectedValueOnce(new Error('Raw storage details'));
      const { result } = renderHook(() => useOfflineSyncQueue({ ...defaultOptions, hasNetwork: false }));
      const attempt = result.current.queueOfflineOperation(
        legacyMutation({ id: 'capture-write', type: 'create', dream, createdAt: 79 }), [dream]
      );
      await expect(attempt).rejects.toBeInstanceOf(DreamPersistenceError);
      await expect(attempt).rejects.toMatchObject({ operation: 'write', target: 'remote-cache' });
      expect(result.current.pendingMutationsRef.current).toEqual([
        expect.objectContaining({ id: 'capture-write' }),
      ]);
    });

    it('serializes durable queue writes so an older completion cannot drop a newer mutation', async () => {
      const firstWrite = (() => {
        let resolve!: () => void;
        const promise = new Promise<void>((done) => {
          resolve = done;
        });
        return { promise, resolve };
      })();
      let persisted: DreamMutation[] = [];
      mockSavePendingMutations
        .mockImplementationOnce(async (mutations: DreamMutation[]) => {
          await firstWrite.promise;
          persisted = mutations;
        })
        .mockImplementationOnce(async (mutations: DreamMutation[]) => {
          persisted = mutations;
        });
      const userScope = 'user:user-123';
      const { result } = renderHook(() =>
        useOfflineSyncQueue({
          ...defaultOptions,
          userScope,
          initialMutationsLoaded: true,
          initialMutationsScope: userScope,
        })
      );
      const dreamA = buildDream({ id: 11 });
      const dreamB = buildDream({ id: 12 });
      const mutationA = legacyMutation({
        id: 'mut-11',
        type: 'create',
        dream: dreamA,
        createdAt: 11,
      });
      const mutationB = legacyMutation({
        id: 'mut-12',
        type: 'create',
        dream: dreamB,
        createdAt: 12,
      });

      let firstOperation!: Promise<void>;
      let secondOperation!: Promise<void>;
      act(() => {
        firstOperation = result.current.queueOfflineOperation(mutationA, [dreamA]);
        secondOperation = result.current.queueOfflineOperation(mutationB, [dreamA, dreamB]);
      });
      await waitFor(() => expect(mockSavePendingMutations).toHaveBeenCalledTimes(1));

      firstWrite.resolve();
      await act(async () => {
        await Promise.all([firstOperation, secondOperation]);
      });

      expect(mockSavePendingMutations).toHaveBeenCalledTimes(2);
      expect(mockSavePendingMutations).toHaveBeenLastCalledWith(
        [
          expect.objectContaining({ id: 'mut-11', userScope }),
          expect.objectContaining({ id: 'mut-12', userScope }),
        ],
        userScope
      );
      expect(persisted).toEqual([
        expect.objectContaining({ id: 'mut-11', userScope }),
        expect.objectContaining({ id: 'mut-12', userScope }),
      ]);
    });

    it('rejects queue changes while the durable queue is unreadable', async () => {
      const userScope = 'user:user-123';
      const { result } = renderHook(() =>
        useOfflineSyncQueue({
          ...defaultOptions,
          userScope,
          initialMutationsLoaded: false,
          initialMutationsScope: userScope,
        })
      );
      const dream = buildDream({ id: 20 });
      const mutation = legacyMutation({
        id: 'mut-20',
        type: 'create',
        dream,
        createdAt: 20,
      });

      await expect(result.current.queueOfflineOperation(mutation, [dream])).rejects.toMatchObject({
        name: 'DreamPersistenceError', operation: 'read', target: 'remote-cache',
      });
      expect(mockSavePendingMutations).not.toHaveBeenCalled();
      expect(defaultOptions.persistRemoteDreams).not.toHaveBeenCalled();
    });

    it('queues a create mutation', async () => {
      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      const dream = buildDream({ id: 1 });
      const mutation: DreamMutation = {
        id: 'mut-1',
        type: 'create',
        dream,
        createdAt: Date.now(),
      } as unknown as DreamMutation;

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
      } as unknown as DreamMutation;

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
      } as unknown as DreamMutation;

      await act(async () => {
        await result.current.queueOfflineOperation(mutation, (prev) =>
          prev.filter((d) => d.id !== 1)
        );
      });

      expect(defaultOptions.persistRemoteDreams).toHaveBeenCalled();
    });

    it('does not raise stale pending mutation alerts when remote sync is disabled', async () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000 + 60 * 60 * 1000 + 1);
      const dream = buildDream({ id: 1 });
      const { result } = renderHook(() =>
        useOfflineSyncQueue({
          ...defaultOptions,
          canUseRemoteSync: false,
        })
      );

      await act(async () => {
        await result.current.queueOfflineOperation(
          legacyMutation({
            id: 'stale-local-only',
            type: 'update',
            dream,
            createdAt: 1_000,
          }),
          [dream]
        );
      });

      const mockLogger = getMockLogger();
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('pending mutation age threshold exceeded'),
        expect.anything()
      );
      expect(mockSavePendingMutations).not.toHaveBeenCalled();
      nowSpy.mockRestore();
    });
  });

  describe('clearQueuedMutationsForDream', () => {
    it('removes all mutations for a specific dream', async () => {
      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      const dream1 = buildDream({ id: 1 });
      const dream2 = buildDream({ id: 2 });

      act(() => {
        result.current.setPendingMutations([
          legacyMutation({ id: 'mut-1', type: 'create', dream: dream1, createdAt: Date.now() }),
          legacyMutation({ id: 'mut-2', type: 'update', dream: dream1, createdAt: Date.now() }),
          legacyMutation({ id: 'mut-3', type: 'create', dream: dream2, createdAt: Date.now() }),
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
          legacyMutation({ id: 'mut-1', type: 'create', dream, createdAt: Date.now() }),
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
          legacyMutation({ id: 'mut-1', type: 'delete', dreamId: 1, createdAt: Date.now() }),
          legacyMutation({ id: 'mut-2', type: 'delete', dreamId: 2, createdAt: Date.now() }),
        ]);
      });

      await act(async () => {
        await result.current.clearQueuedMutationsForDream(1);
      });

      expect(result.current.pendingMutationsRef.current).toHaveLength(1);
      expect(result.current.pendingMutationsRef.current[0].id).toBe('mut-2');
    });
  });

  describe('retryDreamMutations', () => {
    it('makes pending and interrupted sending mutations retryable', async () => {
      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));
      const dream = buildDream({ id: 1, remoteId: 1001 });

      act(() => {
        result.current.setPendingMutations([
          {
            ...legacyMutation({ id: 'mut-pending', type: 'update', dream, createdAt: Date.now() }),
            status: 'pending',
          },
          {
            ...legacyMutation({ id: 'mut-sending', type: 'update', dream, createdAt: Date.now() }),
            status: 'sending',
          },
        ]);
      });

      let retried = false;
      await act(async () => {
        retried = await result.current.retryDreamMutations(1);
      });

      expect(retried).toBe(true);
      expect(result.current.pendingMutationsRef.current.map((mutation) => mutation.status)).toEqual([
        'pending',
        'pending',
      ]);
    });
  });

  describe('syncPendingMutations', () => {
    it('retries after the initial sending-state write fails without remounting', async () => {
      const dream = buildDream({ id: 77 });
      mockCreateDream.mockResolvedValue({ ...dream, remoteId: 1077 });
      mockSavePendingMutations.mockRejectedValueOnce(new Error('Primary write unavailable'));
      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));
      act(() => result.current.setPendingMutations([
        legacyMutation({ id: 'retry-write', type: 'create', dream, createdAt: 77 }),
      ]));
      await act(async () => { await result.current.syncPendingMutations(); });
      expect(mockCreateDream).not.toHaveBeenCalled();
      expect(result.current.pendingMutationsRef.current).toEqual([
        expect.objectContaining({ id: 'retry-write', status: 'failed' }),
      ]);
      await act(async () => { await result.current.syncPendingMutations(); });
      expect(mockCreateDream).toHaveBeenCalledTimes(1);
      expect(result.current.pendingMutationsRef.current).toEqual([]);
    });

    it('contains automatic sync write failures and allows a later explicit retry', async () => {
      const dream = buildDream({ id: 78 });
      const mutation = legacyMutation({ id: 'effect-retry', type: 'create', dream, createdAt: 78 });
      mockCreateDream.mockResolvedValue({ ...dream, remoteId: 1078 });
      mockSavePendingMutations.mockRejectedValue(new Error('Primary write unavailable'));
      const { result } = renderHook(() => useOfflineSyncQueue({
        ...defaultOptions, initialMutations: [mutation],
      }));
      await waitFor(() => expect(getMockLogger().warn).toHaveBeenCalledWith(
        'Offline dream sync could not complete'
      ));
      expect(mockCreateDream).not.toHaveBeenCalled();
      expect(result.current.pendingMutationsRef.current).toHaveLength(1);
      mockSavePendingMutations.mockResolvedValue(undefined);
      await act(async () => { await result.current.syncPendingMutations(); });
      expect(mockCreateDream).toHaveBeenCalledTimes(1);
      expect(result.current.pendingMutationsRef.current).toEqual([]);
    });

    it('does not sync when remote sync is disabled', async () => {
      const options = { ...defaultOptions, canUseRemoteSync: false };
      const { result } = renderHook(() => useOfflineSyncQueue(options));

      const dream = buildDream({ id: 1 });
      act(() => {
        result.current.setPendingMutations([
          legacyMutation({ id: 'mut-1', type: 'create', dream, createdAt: Date.now() }),
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
          legacyMutation({ id: 'mut-1', type: 'create', dream, createdAt: Date.now() }),
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
          legacyMutation({ id: 'mut-1', type: 'create', dream, createdAt: Date.now() }),
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
          legacyMutation({ id: 'mut-1', type: 'create', dream, createdAt: Date.now() }),
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

    it('replays a 10000-character create mutation with a stable clientRequestId', async () => {
      const longTranscript = 'a'.repeat(10_000);
      const dream = buildDream({
        id: 88,
        clientRequestId: 'offline-10k-queue',
        transcript: longTranscript,
      });
      mockCreateDream.mockResolvedValue({ ...dream, remoteId: 888 });
      const persistRemoteDreams = jest.fn().mockResolvedValue(undefined);
      const { result, rerender } = renderHook(
        ({ hasNetwork }: { hasNetwork: boolean }) =>
          useOfflineSyncQueue({
            ...defaultOptions,
            hasNetwork,
            persistRemoteDreams,
          }),
        { initialProps: { hasNetwork: false } }
      );

      await act(async () => {
        await result.current.queueOfflineOperation(
          legacyMutation({
            id: 'mut-10k',
            type: 'create',
            dream,
            createdAt: Date.now(),
          }),
          (prev) => [...prev, dream]
        );
      });

      expect(mockCreateDream).not.toHaveBeenCalled();
      expect(result.current.pendingMutationsRef.current[0]).toEqual(
        expect.objectContaining({
          operation: 'create',
          clientRequestId: 'offline-10k-queue',
          payload: expect.objectContaining({
            dream: expect.objectContaining({
              transcript: longTranscript,
              clientRequestId: 'offline-10k-queue',
            }),
          }),
        })
      );

      rerender({ hasNetwork: true });

      await waitFor(() => {
        expect(mockCreateDream).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 88,
            clientRequestId: 'offline-10k-queue',
            transcript: longTranscript,
          }),
          'user-123'
        );
      });
      expect(String((mockCreateDream.mock.calls[0][0] as DreamAnalysis).transcript)).toHaveLength(10_000);
    });

    it('syncs update mutations to Supabase', async () => {
      const dream = buildDream({ id: 1, remoteId: 1001 });
      const updatedDream = { ...dream, title: 'Updated' };
      mockUpdateDream.mockResolvedValue(updatedDream);

      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      act(() => {
        result.current.setPendingMutations([
          legacyMutation({ id: 'mut-1', type: 'update', dream, createdAt: Date.now() }),
        ]);
      });

      await act(async () => {
        await result.current.syncPendingMutations();
      });

      expect(mockUpdateDream).toHaveBeenCalledWith(expect.objectContaining({ remoteId: 1001 }));
    });

    it('replays an update left sending by an interrupted sync', async () => {
      const dream = buildDream({ id: 1, remoteId: 1001 });
      mockUpdateDream.mockResolvedValue({ ...dream, title: 'Recovered' });

      const { result } = renderHook(() => useOfflineSyncQueue(defaultOptions));

      act(() => {
        result.current.setPendingMutations([
          {
            ...legacyMutation({ id: 'mut-sending', type: 'update', dream, createdAt: Date.now() }),
            status: 'sending',
          },
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
          legacyMutation({ id: 'mut-1', type: 'delete', dreamId: 1, remoteId: 1001, createdAt: Date.now() }),
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
          legacyMutation({ id: 'mut-1', type: 'create', dream, createdAt: Date.now() }),
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
