/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor as testingWaitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { JournalCursor, JournalPage } from '../../lib/journalReadContracts';
import type { GuestDreamMigrationOwner, DreamAnalysis, DreamListReadResult, DreamMutation } from '../../lib/types';
import { useDreamPersistence } from '../useDreamPersistence';

const flushEffects = () => act(async () => {});

const waitFor = async <T,>(callback: () => T | Promise<T>) => {
  // The hook's storage work is promise-driven. Flush those effects first so the
  // assertion normally succeeds immediately, while retaining polling for the
  // genuinely background migration path.
  await flushEffects();
  return testingWaitFor(callback, { interval: 1 });
};

type AnyFunction = (...args: any[]) => any;
const typedJestFn = <T extends AnyFunction>() => jest.fn() as jest.MockedFunction<T>;
const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

// Mock user state
const mockUser = ((factory: any) => factory())(() => ({ current: { id: 'user-123' } as { id: string } | null }));
const mockSessionReady = ((factory: any) => factory())(() => ({ current: true }));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser.current,
    sessionReady: mockSessionReady.current,
  }),
}));

// Mock storage service
const mockGetSavedDreams = typedJestFn<() => Promise<DreamListReadResult>>();
const mockSaveDreams = typedJestFn<(dreams: DreamAnalysis[]) => Promise<void>>();
const mockGetCachedRemoteDreams = typedJestFn<(scope?: string | null) => Promise<DreamListReadResult>>();
const mockSaveCachedRemoteDreams = typedJestFn<(dreams: DreamAnalysis[], scope?: string | null) => Promise<void>>();
const mockGetPendingMutations = typedJestFn<(scope?: string | null) => Promise<DreamMutation[]>>();
const mockGetDreamsMigrationSynced = typedJestFn<() => Promise<boolean>>();
const mockSetDreamsMigrationSynced = typedJestFn<(userId: string, synced: boolean) => Promise<void>>();
const mockGuestMigrationOwner = { current: null as GuestDreamMigrationOwner | null };
const mockGetGuestDreamMigrationOwner = typedJestFn<() => Promise<GuestDreamMigrationOwner | null>>();
const mockSetGuestDreamMigrationOwner = typedJestFn<(ownerUserId: GuestDreamMigrationOwner | null) => Promise<void>>();

jest.mock('../../services/storageService', () => ({
  getSavedDreams: () => mockGetSavedDreams(),
  saveDreams: (dreams: DreamAnalysis[]) => mockSaveDreams(dreams),
  getCachedRemoteDreams: (scope?: string | null) => mockGetCachedRemoteDreams(scope),
  saveCachedRemoteDreams: (dreams: DreamAnalysis[], scope?: string | null) => mockSaveCachedRemoteDreams(dreams, scope),
  getPendingDreamMutations: (scope?: string | null) => mockGetPendingMutations(scope),
  getDreamsMigrationSynced: () => mockGetDreamsMigrationSynced(),
  setDreamsMigrationSynced: (userId: string, synced: boolean) =>
    mockSetDreamsMigrationSynced(userId, synced),
  getGuestDreamMigrationOwner: () => mockGetGuestDreamMigrationOwner(),
  setGuestDreamMigrationOwner: (ownerUserId: GuestDreamMigrationOwner | null) =>
    mockSetGuestDreamMigrationOwner(ownerUserId),
}));

const mockGetAccessToken = typedJestFn<() => Promise<string | null>>();

jest.mock('../../lib/auth', () => ({
  getAccessToken: () => mockGetAccessToken(),
}));

// Mock supabase service
const mockFetchFromSupabase = typedJestFn<() => Promise<DreamAnalysis[]>>();
const mockFetchPage = typedJestFn<(userId: string, options: { cursor?: JournalCursor | null }) => Promise<JournalPage<DreamAnalysis>>>();
const mockCreateInSupabase = jest.fn();

jest.mock('../../services/supabaseDreamService', () => ({
  fetchDreamFullPage: (userId: string, options: { cursor?: JournalCursor | null }) => mockFetchPage(userId, options),
  createDreamInSupabase: (...args: unknown[]) => mockCreateInSupabase(...args),
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

const legacyMutation = (mutation: {
  id: string;
  type: DreamMutation['operation'];
  dream?: DreamAnalysis;
  dreamId?: number;
  remoteId?: number;
  createdAt: number;
}): DreamMutation => mutation as unknown as DreamMutation;

describe('useDreamPersistence', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockUser.current = { id: 'user-123' };
    mockSessionReady.current = true;
    mockGetSavedDreams.mockResolvedValue({ status: 'absent' });
    mockSaveDreams.mockResolvedValue(undefined);
    mockGetCachedRemoteDreams.mockResolvedValue({ status: 'absent' });
    mockSaveCachedRemoteDreams.mockResolvedValue(undefined);
    mockGetPendingMutations.mockResolvedValue([]);
    mockGetDreamsMigrationSynced.mockResolvedValue(false);
    mockSetDreamsMigrationSynced.mockResolvedValue(undefined);
    mockGuestMigrationOwner.current = null;
    mockGetGuestDreamMigrationOwner.mockImplementation(async () => mockGuestMigrationOwner.current);
    mockSetGuestDreamMigrationOwner.mockImplementation(async (ownerUserId) => {
      mockGuestMigrationOwner.current = ownerUserId;
    });
    mockFetchFromSupabase.mockResolvedValue([]);
    mockFetchPage.mockReset();
    mockFetchPage.mockImplementation(async () => ({ items: await mockFetchFromSupabase(), complete: true, nextCursor: null }));
    mockCreateInSupabase.mockResolvedValue(undefined);
    mockGetAccessToken.mockResolvedValue('access-token');
  });

  describe('exhaustive refresh checkpoints', () => {
    it('preserves cache after an intermediate error and resumes only the failed page', async () => {
      const cached = buildDream({ id: 99 });
      const first = buildDream({ id: 2, remoteId: 2 });
      const last = buildDream({ id: 1, remoteId: 1 });
      const cursor: JournalCursor = { version: 1, userId: 'user-123', highWatermark: 2, beforeId: 2 };
      mockGetCachedRemoteDreams.mockResolvedValue({ status: 'loaded', value: [cached] });
      mockFetchPage.mockResolvedValueOnce({ items: [first], nextCursor: cursor, complete: false })
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce({ items: [last], nextCursor: null, complete: true });
      const { result } = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await waitFor(() => expect(result.current.completeness.status).toBe('incomplete'));
      expect(result.current.dreams).toEqual([cached]);
      expect(result.current.remoteSnapshot).toBeNull();
      expect(mockSaveCachedRemoteDreams).not.toHaveBeenCalled();
      await act(async () => { await result.current.reloadDreams(); });
      expect(mockFetchPage).toHaveBeenNthCalledWith(3, 'user-123', { cursor });
      expect(result.current.completeness.status).toBe('complete');
      expect(result.current.remoteSnapshot?.dreams).toEqual([first, last]);
      expect(result.current.dreams.map((dream) => dream.id).sort()).toEqual([1, 2]);
    });

    it('restarts a checkpoint after a local write instead of reusing its stale prefix', async () => {
      const original = buildDream({ id: 2, remoteId: 2, title: 'Before edit' });
      const edited = { ...original, title: 'After edit' };
      const cursor: JournalCursor = { version: 1, userId: 'user-123', highWatermark: 2, beforeId: 2 };
      mockGetCachedRemoteDreams.mockResolvedValue({ status: 'loaded', value: [original] });
      mockFetchPage.mockResolvedValueOnce({ items: [original], nextCursor: cursor, complete: false })
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce({ items: [edited], nextCursor: null, complete: true });
      const { result } = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await waitFor(() => expect(result.current.completeness.status).toBe('incomplete'));
      await act(async () => { await result.current.persistRemoteDreams([edited]); });
      await act(async () => { await result.current.reloadDreams(); });
      expect(mockFetchPage).toHaveBeenNthCalledWith(3, 'user-123', { cursor: null });
      expect(result.current.dreams).toEqual([edited]);
    });

    it('discards a failed traversal checkpoint when the account changes', async () => {
      const cursor: JournalCursor = { version: 1, userId: 'user-123', highWatermark: 2, beforeId: 2 };
      mockFetchPage.mockResolvedValueOnce({ items: [buildDream({ id: 2 })], nextCursor: cursor, complete: false })
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce({ items: [], nextCursor: null, complete: true });
      const hook = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await waitFor(() => expect(hook.result.current.completeness.status).toBe('incomplete'));
      mockUser.current = { id: 'user-b' };
      hook.rerender();
      await waitFor(() => expect(hook.result.current.completeness.status).toBe('complete'));
      expect(mockFetchPage).toHaveBeenNthCalledWith(3, 'user-b', { cursor: null });
      expect(hook.result.current.remoteSnapshot).toEqual({ userScope: 'user:user-b', dreams: [] });
    });
  });

  describe('cache-first scoped refresh', () => {
    it('publishes cache before a blocked token lookup and fetch', async () => {
      const token = deferred<string | null>();
      mockSessionReady.current = false;
      mockGetAccessToken.mockReturnValue(token.promise);
      mockGetCachedRemoteDreams.mockResolvedValue({ status: 'loaded', value: [buildDream({ id: 701 })] });
      const { result, unmount } = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await flushEffects();
      expect(result.current.loaded).toBe(true);
      expect(result.current.dreams[0].id).toBe(701);
      expect(result.current.persistenceState.status).toBe('ready');
      expect(result.current.refreshState.status).toBe('refreshing');
      expect(mockFetchFromSupabase).not.toHaveBeenCalled();
      unmount();
      await act(async () => { token.resolve('token'); });
      expect(mockGetSavedDreams).not.toHaveBeenCalled();
      expect(mockFetchFromSupabase).not.toHaveBeenCalled();
    });

    it('starts only one fetch when sessionReady changes', async () => {
      const token = deferred<string | null>();
      mockSessionReady.current = false;
      mockGetAccessToken.mockReturnValue(token.promise);
      const { rerender } = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await flushEffects();
      mockSessionReady.current = true;
      mockGetAccessToken.mockResolvedValue('token');
      rerender();
      await flushEffects();
      await act(async () => { token.resolve('old-token'); });
      expect(mockFetchFromSupabase).toHaveBeenCalledTimes(1);
    });

    it.each(['edit', 'delete'] as const)('preserves a %s made while the fetch is pending', async (operation: 'edit' | 'delete') => {
      const remote = deferred<DreamAnalysis[]>();
      const original = buildDream({ id: 702, remoteId: 702 });
      mockGetCachedRemoteDreams.mockResolvedValue({ status: 'loaded', value: [original] });
      mockFetchFromSupabase.mockReturnValue(remote.promise);
      mockGetDreamsMigrationSynced.mockResolvedValue(true);
      const { result } = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await flushEffects();
      const next = operation === 'delete' ? [] : [{ ...original, title: 'edited locally' }];
      await act(async () => { await result.current.persistRemoteDreams(next); });
      const unrelated = buildDream({ id: 703, remoteId: 703, title: 'new on another device' });
      await act(async () => { remote.resolve([original, unrelated]); });
      expect(result.current.dreams).toEqual(expect.arrayContaining([...next, unrelated]));
      expect(result.current.dreams).toHaveLength(next.length + 1);
      expect(mockSaveCachedRemoteDreams).toHaveBeenLastCalledWith(expect.arrayContaining([...next, unrelated]), 'user:user-123');
    });

    it('applies a newly durable tombstone after merging a still-visible local edit', async () => {
      const remote = deferred<DreamAnalysis[]>();
      const original = buildDream({ id: 704, remoteId: 1704 });
      mockGetCachedRemoteDreams.mockResolvedValue({ status: 'loaded', value: [original] });
      mockFetchFromSupabase.mockReturnValue(remote.promise);
      mockGetDreamsMigrationSynced.mockResolvedValue(true);
      const { result } = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await flushEffects();
      await act(async () => { await result.current.persistRemoteDreams([{ ...original, title: 'local edit' }]); });
      mockGetPendingMutations.mockResolvedValue([legacyMutation({ id: 'new-delete', type: 'delete', dreamId: 704, remoteId: 1704, createdAt: 2 })]);
      await act(async () => { remote.resolve([original]); });
      expect(result.current.dreams).toEqual([]);
      expect(mockSaveCachedRemoteDreams).toHaveBeenLastCalledWith([], 'user:user-123');
    });

    it('runs an incomplete migration after the refresh itself changed the cache', async () => {
      const pendingDream = buildDream({ id: 750 });
      const remoteDream = buildDream({ id: 751, remoteId: 1751 });
      const mutation: DreamMutation = {
        id: 'pending-create', operation: 'create', clientRequestId: 'dream-750',
        version: 1, userScope: 'user:user-123', entityType: 'dream', entityKey: '750',
        clientUpdatedAt: 1, payload: { dream: pendingDream }, createdAt: 1,
        retryCount: 0, status: 'pending',
      };
      mockGetPendingMutations.mockResolvedValue([mutation]);
      mockGetCachedRemoteDreams.mockResolvedValue({ status: 'loaded', value: [] });
      mockFetchFromSupabase.mockResolvedValue([remoteDream]);
      mockCreateInSupabase.mockResolvedValue({ ...pendingDream, remoteId: 1750 });
      const { result } = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await flushEffects();
      expect(mockCreateInSupabase).toHaveBeenCalledWith(expect.objectContaining({ id: 750 }), 'user-123');
      expect(result.current.dreams).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 750, remoteId: 1750 }),
        expect.objectContaining({ id: 751, remoteId: 1751 }),
      ]));
      expect(mockSetDreamsMigrationSynced).toHaveBeenCalledWith('user-123', true);
    });

    it.each(['edit', 'delete'] as const)('does not overwrite a %s during a deferred migration upload', async (operation: 'edit' | 'delete') => {
      const original = buildDream({ id: 752 });
      const upload = deferred<DreamAnalysis>();
      mockGetCachedRemoteDreams.mockResolvedValue({ status: 'loaded', value: [original] });
      mockFetchFromSupabase.mockResolvedValue([original]);
      mockCreateInSupabase.mockReturnValue(upload.promise);
      const { result } = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await flushEffects();
      expect(mockCreateInSupabase).toHaveBeenCalledTimes(1);
      const next = operation === 'delete' ? [] : [{ ...original, title: 'new local title' }];
      await act(async () => { await result.current.persistRemoteDreams(next); });
      await act(async () => { upload.resolve({ ...original, remoteId: 1752 }); });
      expect(result.current.dreams).toEqual(next);
      expect(mockSaveCachedRemoteDreams).toHaveBeenLastCalledWith(next, 'user:user-123');
      expect(mockSetDreamsMigrationSynced).not.toHaveBeenCalled();
    });

    it('keeps cache visible and loaded during a failed refresh and retry', async () => {
      const original = buildDream({ id: 703, remoteId: 703 });
      mockGetCachedRemoteDreams.mockResolvedValue({ status: 'loaded', value: [original] });
      mockFetchFromSupabase.mockRejectedValue(new Error('offline'));
      const { result } = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await flushEffects();
      expect(result.current.refreshState.status).toBe('error');
      expect(result.current.persistenceState.status).toBe('ready');
      expect(result.current.dreams).toEqual([original]);
      const retry = deferred<DreamAnalysis[]>();
      mockFetchFromSupabase.mockReturnValue(retry.promise);
      let running!: Promise<void>;
      await act(async () => { running = result.current.reloadDreams(); });
      expect(result.current.loaded).toBe(true);
      expect(result.current.dreams).toEqual([original]);
      await act(async () => { retry.resolve([original]); await running; });
      expect(result.current.refreshState.status).toBe('idle');
    });

    it('does not fetch for A after a blocked migration read resolves under B', async () => {
      const guest = deferred<DreamListReadResult>();
      mockGetSavedDreams.mockReturnValueOnce(guest.promise);
      const { rerender } = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await flushEffects();
      mockUser.current = { id: 'account-b' };
      rerender();
      await act(async () => { guest.resolve({ status: 'loaded', value: [buildDream({ id: 704 })] }); });
      await flushEffects();
      expect(mockCreateInSupabase).not.toHaveBeenCalled();
      expect(mockFetchFromSupabase).toHaveBeenCalledTimes(1);
    });

    it('reports a read failure rather than accepting an empty journal after cache and network errors', async () => {
      mockGetCachedRemoteDreams.mockResolvedValue({ status: 'error' });
      mockFetchFromSupabase.mockRejectedValue(new Error('offline'));
      const { result } = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await flushEffects();
      expect(result.current.persistenceState).toEqual({ status: 'error', operation: 'read', target: 'remote-cache' });
      expect(result.current.refreshState.status).toBe('error');
    });
  });

  describe('guest mode (no remote sync)', () => {
    it('loads dreams from local storage', async () => {
      const localDreams = [buildDream({ id: 1 }), buildDream({ id: 2 })];
      mockGetSavedDreams.mockResolvedValue({ status: 'loaded', value: localDreams });

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );

      await flushEffects();
      expect(result.current.loaded).toBe(true);

      expect(result.current.dreams).toHaveLength(2);
      expect(mockGetSavedDreams).toHaveBeenCalled();
      expect(mockFetchFromSupabase).not.toHaveBeenCalled();
    });

    it('persists dreams to local storage', async () => {
      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );

      await flushEffects();
      expect(result.current.loaded).toBe(true);

      const newDreams = [buildDream({ id: 1 })];
      await act(async () => {
        await result.current.persistLocalDreams(newDreams);
      });

      expect(mockSaveDreams).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ id: 1 }),
      ]));
    });

    it('retries an identical local payload after the first durable write fails', async () => {
      const newDreams = [buildDream({ id: 1, transcript: 'kept for retry' })];
      mockSaveDreams
        .mockRejectedValueOnce(new Error('storage unavailable'))
        .mockResolvedValueOnce(undefined);

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );
      await flushEffects();

      await expect(result.current.persistLocalDreams(newDreams)).rejects.toThrow(
        'Dream changes could not be saved'
      );
      await act(async () => {
        await result.current.persistLocalDreams(newDreams);
      });

      expect(mockSaveDreams).toHaveBeenCalledTimes(2);
      expect(result.current.persistenceState).toEqual({ status: 'ready', target: 'device' });
      expect(result.current.dreams).toEqual([
        expect.objectContaining({ id: 1, transcript: 'kept for retry' }),
      ]);
    });

    it('serializes concurrent saves and persists the latest version last', async () => {
      const firstWrite = deferred<void>();
      const stored: DreamAnalysis[][] = [];
      mockSaveDreams
        .mockImplementationOnce(async (value) => {
          await firstWrite.promise;
          stored.push(value);
        })
        .mockImplementationOnce(async (value) => {
          stored.push(value);
        });

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );
      await flushEffects();
      const firstVersion = [buildDream({ id: 1, transcript: 'first version' })];
      const latestVersion = [buildDream({ id: 2, transcript: 'latest version' })];

      let firstPromise!: Promise<void>;
      let latestPromise!: Promise<void>;
      act(() => {
        firstPromise = result.current.persistLocalDreams(firstVersion);
        latestPromise = result.current.persistLocalDreams(latestVersion);
      });
      await flushEffects();
      expect(mockSaveDreams).toHaveBeenCalledTimes(1);

      firstWrite.resolve(undefined);
      await act(async () => {
        await Promise.all([firstPromise, latestPromise]);
      });

      expect(stored).toEqual([firstVersion, latestVersion]);
      expect(result.current.dreams).toEqual(latestVersion);
    });

    it('does not skip a return to the durable value while a different write is pending', async () => {
      const pendingWrite = deferred<void>();
      const stored: DreamAnalysis[][] = [];
      mockSaveDreams
        .mockImplementationOnce(async (value) => {
          await pendingWrite.promise;
          stored.push(value);
        })
        .mockImplementationOnce(async (value) => {
          stored.push(value);
        });

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );
      await flushEffects();
      const changed = [buildDream({ id: 7 })];

      let changedPromise!: Promise<void>;
      let restoredPromise!: Promise<void>;
      act(() => {
        changedPromise = result.current.persistLocalDreams(changed);
        restoredPromise = result.current.persistLocalDreams([]);
      });
      pendingWrite.resolve(undefined);
      await act(async () => {
        await Promise.all([changedPromise, restoredPromise]);
      });

      expect(mockSaveDreams).toHaveBeenCalledTimes(2);
      expect(stored).toEqual([changed, []]);
      expect(result.current.dreams).toEqual([]);
    });

    it('recovers a failed write through the exposed retry action', async () => {
      const dream = buildDream({ id: 9, transcript: 'unsaved but visible' });
      mockSaveDreams.mockRejectedValueOnce(new Error('disk full'));
      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );
      await flushEffects();

      await act(async () => {
        await expect(result.current.persistLocalDreams([dream])).rejects.toThrow();
      });
      expect(result.current.dreams).toEqual([dream]);
      expect(result.current.persistenceState).toEqual({
        status: 'error',
        operation: 'write',
        target: 'device',
      });

      mockSaveDreams.mockResolvedValueOnce(undefined);
      await act(async () => {
        await result.current.retryPersistence();
      });
      expect(mockSaveDreams).toHaveBeenCalledTimes(2);
      expect(result.current.persistenceState).toEqual({ status: 'ready', target: 'device' });
    });

    it('keeps a repeated retry failure observable without rejecting the retry action', async () => {
      const dream = buildDream({ id: 10, transcript: 'keep trying' });
      mockSaveDreams.mockRejectedValue(new Error('still full'));
      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );
      await flushEffects();
      await act(async () => {
        await expect(result.current.persistLocalDreams([dream])).rejects.toThrow();
      });

      await act(async () => {
        await expect(result.current.retryPersistence()).resolves.toBeUndefined();
      });
      expect(mockSaveDreams).toHaveBeenCalledTimes(2);
      expect(result.current.persistenceState).toEqual({
        status: 'error',
        operation: 'write',
        target: 'device',
      });
      expect(result.current.dreams).toEqual([dream]);
    });

    it('does not replace an unsaved optimistic version during reload before retry', async () => {
      const durable = buildDream({ id: 11, transcript: 'durable version' });
      const edited = buildDream({ id: 11, transcript: 'unsaved edited version' });
      mockGetSavedDreams.mockResolvedValue({ status: 'loaded', value: [durable] });
      mockSaveDreams.mockRejectedValueOnce(new Error('write interrupted'));
      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );
      await flushEffects();

      await act(async () => {
        await expect(result.current.persistLocalDreams([edited])).rejects.toThrow();
      });
      await act(async () => {
        await result.current.reloadDreams();
      });
      expect(result.current.dreams).toEqual([edited]);
      expect(result.current.persistenceState).toEqual({
        status: 'error',
        operation: 'write',
        target: 'device',
      });

      mockSaveDreams.mockResolvedValueOnce(undefined);
      await act(async () => {
        await result.current.retryPersistence();
      });
      expect(mockSaveDreams).toHaveBeenLastCalledWith([
        expect.objectContaining({ transcript: 'unsaved edited version' }),
      ]);
    });

    it('keeps an optimistic version visible when reload finishes during its pending write', async () => {
      const durable = buildDream({ id: 12, transcript: 'durable version' });
      const pending = buildDream({ id: 12, transcript: 'pending version' });
      const pendingWrite = deferred<void>();
      mockGetSavedDreams.mockResolvedValue({ status: 'loaded', value: [durable] });
      mockSaveDreams.mockImplementationOnce(() => pendingWrite.promise);
      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );
      await flushEffects();

      let savePromise!: Promise<void>;
      act(() => {
        savePromise = result.current.persistLocalDreams([pending]);
      });
      await act(async () => {
        await result.current.reloadDreams();
      });

      expect(result.current.dreams).toEqual([pending]);
      expect(result.current.persistenceState).toEqual({ status: 'saving', target: 'device' });

      pendingWrite.resolve(undefined);
      await act(async () => {
        await savePromise;
      });
      expect(result.current.dreams).toEqual([pending]);
      expect(result.current.persistenceState).toEqual({ status: 'ready', target: 'device' });
    });

    it('ignores an older reload that completes after a newer reload', async () => {
      const firstRead = deferred<DreamListReadResult>();
      const secondRead = deferred<DreamListReadResult>();
      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );
      await flushEffects();
      mockGetSavedDreams
        .mockImplementationOnce(() => firstRead.promise)
        .mockImplementationOnce(() => secondRead.promise);

      let olderReload!: Promise<void>;
      let newerReload!: Promise<void>;
      act(() => {
        olderReload = result.current.reloadDreams();
        newerReload = result.current.reloadDreams();
      });
      secondRead.resolve({
        status: 'loaded',
        value: [buildDream({ id: 102, transcript: 'newer reload' })],
      });
      await act(async () => {
        await newerReload;
      });
      expect(result.current.dreams).toEqual([
        expect.objectContaining({ id: 102, transcript: 'newer reload' }),
      ]);

      firstRead.resolve({
        status: 'loaded',
        value: [buildDream({ id: 101, transcript: 'older reload' })],
      });
      await act(async () => {
        await olderReload;
      });
      expect(result.current.dreams).toEqual([
        expect.objectContaining({ id: 102, transcript: 'newer reload' }),
      ]);
    });

    it('reloads a complete long dream from storage after a successful save', async () => {
      let stored: DreamAnalysis[] = [];
      mockSaveDreams.mockImplementation(async (value) => {
        stored = value;
      });
      const first = renderHook(() => useDreamPersistence({ canUseRemoteSync: false }));
      await flushEffects();
      const longDream = buildDream({
        id: 81,
        transcript: 'night '.repeat(2_000),
        pendingSync: true,
        clientRequestId: 'long-dream-81',
      });
      await act(async () => {
        await first.result.current.persistLocalDreams([longDream]);
      });
      first.unmount();

      mockGetSavedDreams.mockResolvedValue({ status: 'loaded', value: stored });
      const relaunched = renderHook(() => useDreamPersistence({ canUseRemoteSync: false }));
      await flushEffects();
      expect(relaunched.result.current.dreams[0]).toEqual(longDream);
    });

    it('does not persist to remote cache when sync disabled', async () => {
      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );

      await flushEffects();
      expect(result.current.loaded).toBe(true);

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

      await flushEffects();
      expect(result.current.loaded).toBe(true);

      expect(mockGetAccessToken).toHaveBeenCalled();
      expect(mockFetchFromSupabase).toHaveBeenCalled();
      expect(result.current.dreams).toHaveLength(1);
    });

    it('loads dreams from Supabase', async () => {
      const remoteDreams = [
        buildDream({ id: 1, remoteId: 101 }),
        buildDream({ id: 3, remoteId: 103 }),
        buildDream({ id: 2, remoteId: 102 }),
      ];
      mockFetchFromSupabase.mockResolvedValue(remoteDreams);

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await flushEffects();
      expect(result.current.loaded).toBe(true);

      expect(result.current.dreams.map((dream) => dream.id)).toEqual([3, 2, 1]);
      expect(mockFetchFromSupabase).toHaveBeenCalled();
    });

    it('caches fetched remote dreams', async () => {
      const remoteDreams = [buildDream({ id: 1, remoteId: 101 })];
      mockFetchFromSupabase.mockResolvedValue(remoteDreams);

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await flushEffects();
      expect(result.current.loaded).toBe(true);

      expect(mockSaveCachedRemoteDreams).toHaveBeenCalled();
    });

    it('loads pending mutations from storage', async () => {
      const dream = buildDream({ id: 1 });
      const mutations: DreamMutation[] = [
        legacyMutation({ id: 'mut-1', type: 'create', dream, createdAt: Date.now() }),
      ];
      mockGetPendingMutations.mockResolvedValue(mutations);
      mockFetchFromSupabase.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await flushEffects();
      expect(result.current.loaded).toBe(true);

      expect(result.current.pendingMutations).toHaveLength(1);
    });

    it('applies pending mutations to remote dreams', async () => {
      const remoteDream = buildDream({ id: 1, title: 'Original', remoteId: 101 });
      const updatedDream = buildDream({ id: 1, title: 'Updated', remoteId: 101 });
      const mutations: DreamMutation[] = [
        legacyMutation({ id: 'mut-1', type: 'update', dream: updatedDream, createdAt: Date.now() }),
      ];
      mockFetchFromSupabase.mockResolvedValue([remoteDream]);
      mockGetPendingMutations.mockResolvedValue(mutations);

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await flushEffects();
      expect(result.current.loaded).toBe(true);

      // Dream should have mutation applied
      expect(result.current.dreams[0].title).toBe('Updated');
    });

    it('falls back to cached dreams on fetch error', async () => {
      const cachedDreams = [buildDream({ id: 1, remoteId: 101 })];
      mockGetCachedRemoteDreams.mockResolvedValue({ status: 'loaded', value: cachedDreams });
      mockFetchFromSupabase.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await flushEffects();
      expect(result.current.loaded).toBe(true);

      expect(result.current.dreams).toHaveLength(1);
    });

    it('keeps absence unproven when the remote fetch fails without a loaded cache', async () => {
      mockGetCachedRemoteDreams.mockResolvedValue({ status: 'absent' });
      mockFetchFromSupabase.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );
      await flushEffects();

      expect(result.current.dreams).toEqual([]);
      expect(result.current.persistenceState).toEqual({
        status: 'error',
        operation: 'read',
        target: 'remote-cache',
      });
    });

    it('persists to remote cache', async () => {
      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await flushEffects();
      expect(result.current.loaded).toBe(true);

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

      await flushEffects();
      expect(result.current.loaded).toBe(true);

      const newDream = buildDream({ id: 2 });
      await act(async () => {
        await result.current.persistRemoteDreams((prev) => [...prev, newDream]);
      });

      expect(result.current.dreams).toHaveLength(2);
    });

    it('keeps durable cache markers isolated between accounts', async () => {
      mockFetchFromSupabase.mockResolvedValue([]);
      const hook = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await flushEffects();
      mockSaveCachedRemoteDreams.mockClear();
      const sameDream = [buildDream({ id: 17, clientRequestId: 'same-payload' })];
      await act(async () => {
        await hook.result.current.persistRemoteDreams(sameDream);
      });
      expect(mockSaveCachedRemoteDreams).toHaveBeenLastCalledWith(
        expect.any(Array),
        'user:user-123'
      );

      mockUser.current = { id: 'user-456' };
      hook.rerender();
      await flushEffects();
      mockSaveCachedRemoteDreams.mockClear();
      await act(async () => {
        await hook.result.current.persistRemoteDreams(sameDream);
      });
      expect(mockSaveCachedRemoteDreams).toHaveBeenCalledWith(
        expect.any(Array),
        'user:user-456'
      );
    });

    it('rejects a stale account callback before it can read or write the next account state', async () => {
      mockFetchFromSupabase.mockResolvedValue([buildDream({ id: 1, title: 'Account A' })]);
      const hook = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await flushEffects();
      const persistForAccountA = hook.result.current.persistRemoteDreams;

      mockUser.current = { id: 'user-456' };
      mockFetchFromSupabase.mockResolvedValue([buildDream({ id: 2, title: 'Account B' })]);
      hook.rerender();
      await flushEffects();
      mockSaveCachedRemoteDreams.mockClear();

      await expect(
        persistForAccountA((current) => [buildDream({ id: 3 }), ...current])
      ).rejects.toThrow('account changed');
      expect(mockSaveCachedRemoteDreams).not.toHaveBeenCalled();
      expect(hook.result.current.dreams).toEqual([
        expect.objectContaining({ id: 2, title: 'Account B' }),
      ]);
    });

    it('gates the entire published snapshot synchronously when the account changes', async () => {
      mockFetchFromSupabase.mockResolvedValue([buildDream({ id: 1, title: 'Account A' })]);
      const hook = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await flushEffects();
      expect(hook.result.current.loaded).toBe(true);

      const accountBPendingRead = deferred<DreamMutation[]>();
      const accountBCacheRead = deferred<DreamListReadResult>();
      mockGetPendingMutations.mockImplementationOnce(() => accountBPendingRead.promise);
      mockGetCachedRemoteDreams.mockImplementationOnce(() => accountBCacheRead.promise);
      mockUser.current = { id: 'user-456' };
      hook.rerender();

      expect(hook.result.current.dreams).toEqual([]);
      expect(hook.result.current.loaded).toBe(false);
      expect(hook.result.current.pendingMutations).toEqual([]);
      expect(hook.result.current.pendingMutationsLoaded).toBe(false);
      expect(hook.result.current.persistenceState).toEqual({
        status: 'loading',
        target: 'remote-cache',
      });
      let updaterInput: DreamAnalysis[] | undefined;
      await expect(
        hook.result.current.persistRemoteDreams((current) => {
          updaterInput = current;
          return current;
        })
      ).rejects.toThrow('could not be read');
      expect(updaterInput).toEqual([]);

      accountBPendingRead.resolve([]);
      accountBCacheRead.resolve({ status: 'absent' });
      await flushEffects();
    });

    it('keeps a remote optimistic edit visible when a reload fetch finishes during its write', async () => {
      const durable = buildDream({ id: 61, transcript: 'remote durable', remoteId: 161 });
      const edited = buildDream({ id: 61, transcript: 'remote edit', remoteId: 161 });
      mockFetchFromSupabase.mockResolvedValue([durable]);
      const hook = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await flushEffects();
      const pendingCacheWrite = deferred<void>();
      mockSaveCachedRemoteDreams.mockImplementationOnce(() => pendingCacheWrite.promise);

      let savePromise!: Promise<void>;
      act(() => {
        savePromise = hook.result.current.persistRemoteDreams([edited]);
      });
      await act(async () => {
        await hook.result.current.reloadDreams();
      });

      expect(hook.result.current.dreams).toEqual([edited]);
      expect(hook.result.current.persistenceState).toEqual({
        status: 'saving',
        target: 'remote-cache',
      });

      pendingCacheWrite.resolve(undefined);
      await act(async () => {
        await savePromise;
      });
      expect(hook.result.current.dreams).toEqual([edited]);
      expect(hook.result.current.persistenceState).toEqual({
        status: 'ready',
        target: 'remote-cache',
      });
    });

    it('does not run a retry captured for a previous account', async () => {
      mockFetchFromSupabase.mockResolvedValue([buildDream({ id: 71, title: 'Account A' })]);
      const hook = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await flushEffects();
      mockSaveCachedRemoteDreams.mockRejectedValueOnce(new Error('cache unavailable'));
      await act(async () => {
        await expect(
          hook.result.current.persistRemoteDreams([buildDream({ id: 72, title: 'Unsaved A' })])
        ).rejects.toThrow();
      });
      const retryForAccountA = hook.result.current.retryPersistence;

      mockUser.current = { id: 'user-456' };
      mockFetchFromSupabase.mockResolvedValue([buildDream({ id: 73, title: 'Account B' })]);
      hook.rerender();
      await flushEffects();
      mockSaveCachedRemoteDreams.mockClear();

      await act(async () => {
        await retryForAccountA();
      });
      expect(mockSaveCachedRemoteDreams).not.toHaveBeenCalled();
      expect(hook.result.current.dreams).toEqual([
        expect.objectContaining({ id: 73, title: 'Account B' }),
      ]);
    });

    it('restores account A failed cache payload after visiting B and retries only A data', async () => {
      mockFetchFromSupabase.mockResolvedValue([buildDream({ id: 81, title: 'Durable A' })]);
      const hook = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await flushEffects();
      const unsavedA = buildDream({ id: 82, title: 'Unsaved A cache payload' });
      mockSaveCachedRemoteDreams.mockRejectedValueOnce(new Error('cache unavailable'));
      await act(async () => {
        await expect(hook.result.current.persistRemoteDreams([unsavedA])).rejects.toThrow();
      });

      mockUser.current = { id: 'user-456' };
      mockFetchFromSupabase.mockResolvedValue([buildDream({ id: 83, title: 'Account B' })]);
      hook.rerender();
      await flushEffects();
      expect(hook.result.current.dreams).toEqual([
        expect.objectContaining({ id: 83, title: 'Account B' }),
      ]);

      mockUser.current = { id: 'user-123' };
      mockFetchFromSupabase.mockResolvedValue([buildDream({ id: 81, title: 'Durable A' })]);
      hook.rerender();
      await flushEffects();
      expect(hook.result.current.pendingMutationsLoaded).toBe(true);
      expect(hook.result.current.pendingMutationsScope).toBe('user:user-123');
      expect(hook.result.current.dreams).toEqual([unsavedA]);
      expect(hook.result.current.persistenceState).toEqual({
        status: 'error',
        operation: 'write',
        target: 'remote-cache',
      });

      mockSaveCachedRemoteDreams.mockClear();
      await act(async () => {
        await hook.result.current.retryPersistence();
      });
      expect(mockSaveCachedRemoteDreams).toHaveBeenCalledWith([unsavedA], 'user:user-123');
      expect(hook.result.current.dreams).toEqual([unsavedA]);
      expect(hook.result.current.dreams).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ title: 'Account B' })])
      );
    });

    it('keeps the last readable remote view when cache or mutation reads fail', async () => {
      mockFetchFromSupabase.mockResolvedValue([
        buildDream({ id: 51, title: 'Last readable remote view' }),
      ]);
      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );
      await flushEffects();
      mockSaveCachedRemoteDreams.mockClear();

      mockGetCachedRemoteDreams.mockResolvedValueOnce({ status: 'error' });
      mockGetPendingMutations.mockRejectedValueOnce(new Error('queue unreadable'));
      mockFetchFromSupabase.mockResolvedValueOnce([
        buildDream({ id: 52, title: 'Potentially incomplete server view' }),
      ]);
      await act(async () => {
        await result.current.reloadDreams();
      });

      expect(result.current.dreams).toEqual([
        expect.objectContaining({ id: 51, title: 'Last readable remote view' }),
      ]);
      expect(mockSaveCachedRemoteDreams).not.toHaveBeenCalled();
      expect(result.current.persistenceState).toEqual({
        status: 'error',
        operation: 'read',
        target: 'remote-cache',
      });
    });
  });

  describe('dream migration', () => {
    it('keeps one account owner while a guest migration is in flight across an account switch', async () => {
      const guestDream = buildDream({
        id: 35,
        transcript: 'claimed by account A',
        clientRequestId: 'guest-owner-35',
      });
      let stored = [guestDream];
      const createForAccountA = deferred<DreamAnalysis>();
      mockGetDreamsMigrationSynced.mockResolvedValue(true);
      mockGetSavedDreams.mockImplementation(async () => ({ status: 'loaded', value: stored }));
      mockSaveDreams.mockImplementation(async (value) => {
        stored = value;
      });
      mockCreateInSupabase.mockImplementation(
        (_dream: DreamAnalysis, ownerUserId: string) =>
          ownerUserId === 'user-123'
            ? createForAccountA.promise
            : Promise.resolve({ ...guestDream, remoteId: 235 })
      );
      const hook = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await waitFor(() => {
        expect(mockCreateInSupabase).toHaveBeenCalledWith(
          expect.objectContaining({ clientRequestId: 'guest-owner-35' }),
          'user-123'
        );
      });

      mockUser.current = { id: 'user-456' };
      hook.rerender();
      await flushEffects();
      expect(mockCreateInSupabase).toHaveBeenCalledTimes(1);

      createForAccountA.resolve({ ...guestDream, remoteId: 135 });
      await waitFor(() => {
        expect(stored).toEqual([]);
      });
      await waitFor(() => {
        expect(hook.result.current.loaded).toBe(true);
      });

      expect(mockCreateInSupabase).toHaveBeenCalledTimes(1);
      expect(mockCreateInSupabase).not.toHaveBeenCalledWith(expect.anything(), 'user-456');
      expect(mockSetGuestDreamMigrationOwner).toHaveBeenNthCalledWith(1, { userId: 'user-123', dreamIds: [35] });
      expect(mockSetGuestDreamMigrationOwner).toHaveBeenLastCalledWith(null);
    });

    it('settles only the acknowledged guest upload and resumes the remainder for its owner', async () => {
      const first = buildDream({ id: 803 });
      const second = buildDream({ id: 802 });
      let stored = [first, second];
      const upload = deferred<DreamAnalysis>();
      mockGetSavedDreams.mockImplementation(async () => ({ status: 'loaded', value: stored }));
      mockSaveDreams.mockImplementation(async (value) => { stored = value; });
      mockGetDreamsMigrationSynced.mockResolvedValue(true);
      mockCreateInSupabase.mockReturnValueOnce(upload.promise);
      const hook = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await flushEffects();
      expect(mockCreateInSupabase).toHaveBeenCalledTimes(1);
      mockUser.current = { id: 'other-account' };
      hook.rerender();
      await act(async () => { upload.resolve({ ...first, remoteId: 1801 }); });
      expect(stored).toEqual([second]);
      expect(mockCreateInSupabase).toHaveBeenCalledTimes(1);
      expect(mockSetDreamsMigrationSynced).not.toHaveBeenCalled();
      expect(mockGuestMigrationOwner.current?.userId).toBe('user-123');
      mockUser.current = { id: 'user-123' };
      hook.rerender();
      await flushEffects();
      expect(mockCreateInSupabase).toHaveBeenCalledTimes(2);
      expect(mockCreateInSupabase).toHaveBeenLastCalledWith(expect.objectContaining({ id: 802 }), 'user-123');
      expect(stored).toEqual([]);
    });

    it('preserves a new guest capture made while the previous account migration is in flight', async () => {
      const claimedDream = buildDream({
        id: 37,
        transcript: 'captured before account A migration',
        clientRequestId: 'guest-owner-37',
      });
      const newGuestCapture = buildDream({
        id: 38,
        transcript: 'captured after logout',
        clientRequestId: 'guest-owner-38',
      });
      let stored = [claimedDream];
      const createForAccountA = deferred<DreamAnalysis>();
      mockGetDreamsMigrationSynced.mockResolvedValue(true);
      mockGetSavedDreams.mockImplementation(async () => ({ status: 'loaded', value: stored }));
      mockSaveDreams.mockImplementation(async (value) => {
        stored = value;
      });
      mockCreateInSupabase.mockImplementation(() => createForAccountA.promise);
      let remoteSyncEnabled = true;
      const hook = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: remoteSyncEnabled })
      );
      await waitFor(() => {
        expect(mockCreateInSupabase).toHaveBeenCalledWith(
          expect.objectContaining({ clientRequestId: 'guest-owner-37' }),
          'user-123'
        );
      });

      mockUser.current = null;
      remoteSyncEnabled = false;
      hook.rerender();
      await flushEffects();
      await act(async () => {
        await hook.result.current.persistLocalDreams([newGuestCapture, claimedDream]);
      });
      expect(stored).toEqual(expect.arrayContaining([newGuestCapture, claimedDream]));

      createForAccountA.resolve({ ...claimedDream, remoteId: 137 });
      await waitFor(() => {
        expect(stored).toEqual([newGuestCapture]);
      });

      expect(mockCreateInSupabase).toHaveBeenCalledTimes(1);
      expect(mockGuestMigrationOwner.current).toBeNull();
      expect(hook.result.current.dreams).toEqual([newGuestCapture]);
    });

    it.each(['edit', 'delete'] as const)(
      'preserves a guest %s made during a failed upload without restoring the old snapshot',
      async (change: 'edit' | 'delete') => {
        const original = buildDream({ id: 39, transcript: 'original captured dream' });
        const expected = change === 'edit'
          ? [{ ...original, transcript: 'newer local edit' }]
          : [];
        let stored = [original];
        const upload = deferred<DreamAnalysis>();
        mockGetDreamsMigrationSynced.mockResolvedValue(true);
        mockGetSavedDreams.mockImplementation(async () => ({ status: 'loaded', value: stored }));
        mockSaveDreams.mockImplementation(async (value) => { stored = value; });
        mockCreateInSupabase.mockImplementation(() => upload.promise);
        let remoteSyncEnabled = true;
        const hook = renderHook(() => useDreamPersistence({ canUseRemoteSync: remoteSyncEnabled }));
        await waitFor(() => expect(mockCreateInSupabase).toHaveBeenCalledTimes(1));
        mockUser.current = null;
        remoteSyncEnabled = false;
        hook.rerender();
        await flushEffects();
        await act(async () => { await hook.result.current.persistLocalDreams(expected); });
        mockSaveDreams.mockClear();
        await act(async () => { upload.reject(new Error('Upload unavailable')); });
        await flushEffects();
        expect(stored).toEqual(expected);
        if (change === 'delete') expect(mockGuestMigrationOwner.current).toBeNull();
        expect(hook.result.current.dreams).toEqual(expected);
        expect(mockCreateInSupabase).toHaveBeenCalledTimes(1);
      }
    );

    it('resumes only the attributed snapshot and leaves later guest captures out of both migrations', async () => {
      const owned = buildDream({ id: 36, transcript: 'account A pending snapshot' });
      const laterGuest = buildDream({ id: 40, transcript: 'later guest capture' });
      let stored = [owned, laterGuest];
      mockGuestMigrationOwner.current = { userId: 'user-123', dreamIds: [36] };
      mockGetSavedDreams.mockImplementation(async () => ({ status: 'loaded', value: stored }));
      mockSaveDreams.mockImplementation(async (value) => { stored = value; });
      mockCreateInSupabase.mockImplementation(async (dream: DreamAnalysis) => ({ ...dream, remoteId: dream.id + 100 }));
      const { result } = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await waitFor(() => expect(result.current.loaded).toBe(true));
      await flushEffects();
      expect(mockCreateInSupabase).toHaveBeenCalledTimes(1);
      expect(mockCreateInSupabase).toHaveBeenCalledWith(expect.objectContaining({ id: 36 }), 'user-123');
      expect(stored).toEqual([laterGuest]);
      expect(mockGuestMigrationOwner.current).toBeNull();
    });

    it('honors a durable owner after restart and never gives its remaining guest data to B', async () => {
      const remaining = buildDream({
        id: 36,
        transcript: 'remaining account A data',
        clientRequestId: 'guest-owner-36',
      });
      mockGuestMigrationOwner.current = { userId: 'user-123', dreamIds: [36] };
      mockUser.current = { id: 'user-456' };
      mockGetSavedDreams.mockResolvedValue({ status: 'loaded', value: [remaining] });
      mockGetDreamsMigrationSynced.mockResolvedValue(false);

      const { result } = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));
      await flushEffects();

      expect(result.current.loaded).toBe(true);
      expect(mockCreateInSupabase).not.toHaveBeenCalled();
      expect(mockSaveDreams).not.toHaveBeenCalledWith([]);
      expect(mockGuestMigrationOwner.current).toEqual({ userId: 'user-123', dreamIds: [36] });
    });

    it('retains a failed guest save across login and migrates it only after durable retry', async () => {
      const durable = buildDream({ id: 40, transcript: 'older durable guest dream' });
      const unsaved = buildDream({
        id: 41,
        transcript: 'guest dream retained across login',
        clientRequestId: 'guest-retained-41',
      });
      let stored = [durable];
      let remainingWriteFailures = 2;
      mockUser.current = null;
      mockGetDreamsMigrationSynced.mockResolvedValue(true);
      mockGetSavedDreams.mockImplementation(async () => ({ status: 'loaded', value: stored }));
      mockSaveDreams.mockImplementation(async (value) => {
        if (remainingWriteFailures > 0) {
          remainingWriteFailures -= 1;
          throw new Error('device unavailable');
        }
        stored = value;
      });
      mockCreateInSupabase.mockImplementation(async (dream: DreamAnalysis) => ({
        ...dream,
        remoteId: 141,
      }));
      mockFetchFromSupabase.mockResolvedValue([
        { ...unsaved, remoteId: 141 },
      ]);
      let remoteSyncEnabled = false;
      const hook = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: remoteSyncEnabled })
      );
      await flushEffects();

      await act(async () => {
        await expect(hook.result.current.persistLocalDreams([unsaved])).rejects.toThrow();
      });
      expect(hook.result.current.dreams).toEqual([unsaved]);

      mockUser.current = { id: 'user-123' };
      remoteSyncEnabled = true;
      hook.rerender();
      await flushEffects();

      expect(mockCreateInSupabase).not.toHaveBeenCalled();
      expect(stored).toEqual([durable]);
      expect(hook.result.current.persistenceState).toEqual({
        status: 'error',
        operation: 'write',
        target: 'device',
      });

      await act(async () => {
        await hook.result.current.retryPersistence();
      });
      await waitFor(() => {
        expect(mockCreateInSupabase).toHaveBeenCalledTimes(1);
      });

      expect(mockCreateInSupabase).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 41,
          transcript: 'guest dream retained across login',
          clientRequestId: 'guest-retained-41',
        }),
        'user-123'
      );
      expect(mockSaveDreams).toHaveBeenNthCalledWith(3, [unsaved]);
      expect(mockSaveDreams).toHaveBeenLastCalledWith([]);
      expect(stored).toEqual([]);
    });

    it('does not mark migration complete when the guest journal cannot be read', async () => {
      mockGetSavedDreams.mockResolvedValue({ status: 'error' });
      const { result } = renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));

      await flushEffects();
      expect(result.current.loaded).toBe(true);
      expect(result.current.persistenceState).toEqual({
        status: 'error',
        operation: 'read',
        target: 'device',
      });
      expect(mockSetDreamsMigrationSynced).not.toHaveBeenCalledWith('user-123', true);
      expect(mockSaveDreams).not.toHaveBeenCalledWith([]);
      expect(mockFetchFromSupabase).not.toHaveBeenCalled();
    });

    it('keeps the migration owner when a newer local edit survives a successful upload', async () => {
      const original = buildDream({
        id: 42,
        transcript: 'original captured dream',
        clientRequestId: 'guest-owner-42',
      });
      const edited = { ...original, transcript: 'newer local edit after logout' };
      let stored = [original];
      const upload = deferred<DreamAnalysis>();
      mockGetDreamsMigrationSynced.mockResolvedValue(true);
      mockGetSavedDreams.mockImplementation(async () => ({ status: 'loaded', value: stored }));
      mockSaveDreams.mockImplementation(async (value) => {
        stored = value;
      });
      mockCreateInSupabase.mockImplementation(() => upload.promise);
      let remoteSyncEnabled = true;
      const hook = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: remoteSyncEnabled })
      );
      await waitFor(() => expect(mockCreateInSupabase).toHaveBeenCalledTimes(1));

      mockUser.current = null;
      remoteSyncEnabled = false;
      hook.rerender();
      await flushEffects();
      await act(async () => {
        await hook.result.current.persistLocalDreams([edited]);
      });

      await act(async () => {
        upload.resolve({ ...original, remoteId: 142 });
      });
      await flushEffects();

      expect(stored).toEqual([
        expect.objectContaining({ id: 42, transcript: 'newer local edit after logout' }),
      ]);
      expect(mockGuestMigrationOwner.current).toEqual({ userId: 'user-123', dreamIds: [42] });

      mockUser.current = { id: 'user-456' };
      remoteSyncEnabled = true;
      hook.rerender();
      await flushEffects();

      expect(mockCreateInSupabase).toHaveBeenCalledTimes(1);
      expect(mockCreateInSupabase).not.toHaveBeenCalledWith(expect.anything(), 'user-456');
      expect(mockGuestMigrationOwner.current).toEqual({ userId: 'user-123', dreamIds: [42] });
    });

    it('migrates unsynced local dreams to Supabase', async () => {
      const unsyncedDream = buildDream({ id: 1 }); // No remoteId
      mockGetSavedDreams.mockResolvedValue({ status: 'loaded', value: [unsyncedDream] });
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
      mockGetSavedDreams.mockResolvedValue({ status: 'loaded', value: [syncedDream] });
      mockFetchFromSupabase.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await flushEffects();
      expect(result.current.loaded).toBe(true);

      expect(mockCreateInSupabase).not.toHaveBeenCalled();
    });

    it('clears local storage after migration', async () => {
      const unsyncedDream = buildDream({ id: 1 });
      mockGetSavedDreams.mockResolvedValue({ status: 'loaded', value: [unsyncedDream] });
      mockFetchFromSupabase.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await flushEffects();
      expect(result.current.loaded).toBe(true);

      expect(mockSaveDreams).toHaveBeenCalledWith([]);
    });

    it('migrates N local guest dreams without dropping any', async () => {
      const localDreams = [
        buildDream({ id: 11, clientRequestId: 'guest-dream-11' }),
        buildDream({ id: 12, clientRequestId: 'guest-dream-12' }),
        buildDream({ id: 13, clientRequestId: 'guest-dream-13' }),
      ];
      mockGetDreamsMigrationSynced.mockResolvedValue(true);
      mockGetSavedDreams.mockResolvedValue({ status: 'loaded', value: localDreams });
      mockFetchFromSupabase.mockResolvedValue([]);
      mockCreateInSupabase.mockImplementation(async (dream: DreamAnalysis) => ({
        ...dream,
        remoteId: Number(dream.id) + 100,
      }));

      renderHook(() => useDreamPersistence({ canUseRemoteSync: true }));

      await waitFor(() => {
        expect(mockCreateInSupabase).toHaveBeenCalledTimes(3);
      });

      expect(mockCreateInSupabase.mock.calls.map((call: [DreamAnalysis, string]) => call[0])).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 11, clientRequestId: 'guest-dream-11' }),
          expect.objectContaining({ id: 12, clientRequestId: 'guest-dream-12' }),
          expect.objectContaining({ id: 13, clientRequestId: 'guest-dream-13' }),
        ])
      );
      expect(mockSaveDreams).toHaveBeenCalledWith([]);
    });

    it('retries the same guest dreams idempotently and keeps them locally on failure', async () => {
      const localDreams = [
        buildDream({ id: 21, clientRequestId: 'guest-dream-21' }),
        buildDream({ id: 22, clientRequestId: 'guest-dream-22' }),
        buildDream({ id: 23, clientRequestId: 'guest-dream-23' }),
      ];
      mockGetDreamsMigrationSynced.mockResolvedValue(true);
      mockGetSavedDreams.mockResolvedValue({ status: 'loaded', value: localDreams });
      mockFetchFromSupabase.mockResolvedValue([]);
      mockCreateInSupabase
        .mockResolvedValueOnce({ ...localDreams[0], remoteId: 121 })
        .mockRejectedValueOnce(new Error('upload failed'))
        .mockResolvedValue({ ...localDreams[0], remoteId: 121 });

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await waitFor(() => {
        expect(mockCreateInSupabase).toHaveBeenCalledTimes(3);
      });
      expect(mockSaveDreams).not.toHaveBeenCalledWith([]);
      expect(mockSaveDreams).toHaveBeenCalledWith([
        expect.objectContaining({ id: 22, clientRequestId: 'guest-dream-22' }),
      ]);

      mockCreateInSupabase.mockClear();
      mockGetSavedDreams.mockResolvedValue({ status: 'loaded', value: [
        buildDream({ id: 22, clientRequestId: 'guest-dream-22' }),
      ] });
      mockFetchFromSupabase.mockResolvedValue([
        { ...localDreams[0], remoteId: 121, clientRequestId: 'guest-dream-21' },
        { ...localDreams[2], remoteId: 123, clientRequestId: 'guest-dream-23' },
      ]);
      mockCreateInSupabase.mockImplementation(async (dream: DreamAnalysis) => ({
        ...dream,
        remoteId: Number(dream.id) + 100,
      }));

      await act(async () => {
        await result.current.reloadDreams();
      });

      await waitFor(() => {
        expect(mockCreateInSupabase).toHaveBeenCalledTimes(1);
      });
      expect(mockCreateInSupabase).toHaveBeenCalledWith(
        expect.objectContaining({ id: 22, clientRequestId: 'guest-dream-22' }),
        'user-123'
      );
      expect(mockSaveDreams).toHaveBeenCalledWith([]);
    });

    it('migrates remaining guest dreams after a partial failure without duplicating successes', async () => {
      const localDreams = [
        buildDream({ id: 31, clientRequestId: 'guest-dream-31', transcript: 'first guest dream' }),
        buildDream({ id: 32, clientRequestId: 'guest-dream-32', transcript: 'second guest dream' }),
        buildDream({ id: 33, clientRequestId: 'guest-dream-33', transcript: 'third guest dream' }),
      ];
      mockGetDreamsMigrationSynced.mockResolvedValue(true);
      mockGetSavedDreams.mockResolvedValue({ status: 'loaded', value: localDreams });
      mockFetchFromSupabase.mockResolvedValue([]);
      mockCreateInSupabase
        .mockResolvedValueOnce({ ...localDreams[0], remoteId: 131 })
        .mockRejectedValueOnce(new Error('partial failure'))
        .mockResolvedValueOnce({ ...localDreams[2], remoteId: 133 });

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: true })
      );

      await waitFor(() => {
        expect(mockCreateInSupabase).toHaveBeenCalledTimes(3);
      });
      expect(mockCreateInSupabase.mock.calls.map((call: unknown[]) => (call[0] as DreamAnalysis).clientRequestId)).toEqual(
        expect.arrayContaining(['guest-dream-31', 'guest-dream-32', 'guest-dream-33'])
      );
      expect(mockSaveDreams).not.toHaveBeenCalledWith([]);
      expect(mockSaveDreams).toHaveBeenCalledWith([
        expect.objectContaining({ id: 32, clientRequestId: 'guest-dream-32', transcript: 'second guest dream' }),
      ]);
      expect(mockSetDreamsMigrationSynced).not.toHaveBeenCalledWith('user-123', true);

      mockCreateInSupabase.mockClear();
      mockGetSavedDreams.mockResolvedValue({ status: 'loaded', value: [
        buildDream({ id: 32, clientRequestId: 'guest-dream-32', transcript: 'second guest dream' }),
      ] });
      mockFetchFromSupabase.mockResolvedValue([
        { ...localDreams[0], remoteId: 131, clientRequestId: 'guest-dream-31' },
        { ...localDreams[2], remoteId: 133, clientRequestId: 'guest-dream-33' },
      ]);
      mockCreateInSupabase.mockImplementation(async (dream: DreamAnalysis) => ({
        ...dream,
        remoteId: Number(dream.id) + 100,
      }));

      await act(async () => {
        await result.current.reloadDreams();
      });

      await waitFor(() => {
        expect(mockCreateInSupabase).toHaveBeenCalledTimes(1);
      });
      expect(mockCreateInSupabase).toHaveBeenCalledWith(
        expect.objectContaining({ id: 32, clientRequestId: 'guest-dream-32', transcript: 'second guest dream' }),
        'user-123'
      );
      expect(mockSaveDreams).toHaveBeenCalledWith([]);
    });
  });

  describe('reload', () => {
    it('reloads dreams on demand', async () => {
      mockGetSavedDreams.mockResolvedValue({ status: 'loaded', value: [] });

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );

      await flushEffects();
      expect(result.current.loaded).toBe(true);

      const newDreams = [buildDream({ id: 1 })];
      mockGetSavedDreams.mockResolvedValue({ status: 'loaded', value: newDreams });

      await act(async () => {
        await result.current.reloadDreams();
      });

      expect(result.current.dreams).toHaveLength(1);
    });
  });

  describe('dreamsRef', () => {
    it('keeps ref in sync with state', async () => {
      const dreams = [buildDream({ id: 1 })];
      mockGetSavedDreams.mockResolvedValue({ status: 'loaded', value: dreams });

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );

      await flushEffects();
      expect(result.current.loaded).toBe(true);

      expect(result.current.dreamsRef.current).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('handles storage errors gracefully', async () => {
      mockGetSavedDreams.mockResolvedValue({ status: 'error' });

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );

      await flushEffects();
      expect(result.current.loaded).toBe(true);

      expect(result.current.dreams).toEqual([]);
      expect(result.current.persistenceState).toEqual({
        status: 'error',
        operation: 'read',
        target: 'device',
      });
    });

    it('retries a failed read without treating it as an empty journal', async () => {
      mockGetSavedDreams.mockResolvedValueOnce({ status: 'error' });
      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );
      await flushEffects();

      mockGetSavedDreams.mockResolvedValueOnce({
        status: 'loaded',
        value: [buildDream({ id: 90, transcript: 'recovered' })],
      });
      await act(async () => {
        await result.current.retryPersistence();
      });

      expect(result.current.dreams).toEqual([
        expect.objectContaining({ id: 90, transcript: 'recovered' }),
      ]);
      expect(result.current.persistenceState).toEqual({ status: 'ready', target: 'device' });
    });

    it('keeps the last readable journal when a later storage read fails', async () => {
      mockGetSavedDreams.mockResolvedValueOnce({ status: 'loaded', value: [
        buildDream({ id: 41, transcript: 'last readable dream' }),
      ] });

      const { result } = renderHook(() =>
        useDreamPersistence({ canUseRemoteSync: false })
      );
      await flushEffects();
      expect(result.current.dreams).toEqual([
        expect.objectContaining({ id: 41, transcript: 'last readable dream' }),
      ]);

      mockGetSavedDreams.mockResolvedValueOnce({ status: 'error' });
      await act(async () => {
        await result.current.reloadDreams();
      });

      expect(result.current.dreams).toEqual([
        expect.objectContaining({ id: 41, transcript: 'last readable dream' }),
      ]);
    });
  });
});
