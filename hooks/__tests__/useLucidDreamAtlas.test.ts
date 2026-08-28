/* @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useLucidDreamAtlas } from '@/hooks/useLucidDreamAtlas';
import {
  createEmptyLucidDreamAtlasPreferences,
  type LucidDreamAtlasPreferences,
} from '@/lib/lucid/dreamAtlas';
import type { LucidReconciledDreamSign } from '@/lib/lucid/dreamSigns';
import {
  LucidDreamAtlasStorageError,
  clearLucidDreamAtlasPreferences,
  loadLucidDreamAtlasPreferences,
  updateLucidDreamAtlasPreferences,
} from '@/services/lucidDreamAtlasStorage';

const NOW = Date.UTC(2026, 7, 28, 10, 0, 0);

jest.mock('@/services/lucidDreamAtlasStorage', () => {
  const actual = jest.requireActual('@/services/lucidDreamAtlasStorage');
  return {
    ...actual,
    loadLucidDreamAtlasPreferences: jest.fn(),
    updateLucidDreamAtlasPreferences: jest.fn(),
    clearLucidDreamAtlasPreferences: jest.fn(),
  };
});

const loadPrefs = jest.mocked(loadLucidDreamAtlasPreferences);
const updatePrefs = jest.mocked(updateLucidDreamAtlasPreferences);
const clearPrefs = jest.mocked(clearLucidDreamAtlasPreferences);

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function sign(
  overrides: Partial<LucidReconciledDreamSign> & Pick<LucidReconciledDreamSign, 'id' | 'sourceDreamIds'>
): LucidReconciledDreamSign {
  return {
    id: overrides.id,
    label: overrides.label ?? 'Marie',
    category: overrides.category ?? 'person',
    distinctDreamCount: overrides.distinctDreamCount ?? overrides.sourceDreamIds.length,
    sourceDreamIds: overrides.sourceDreamIds,
    evidence: overrides.evidence ?? [],
    decision: overrides.decision ?? 'confirmed',
    displayLabel: overrides.displayLabel ?? overrides.label ?? 'Marie',
  };
}

const confirmedMarie = sign({
  id: 'sign:marie',
  sourceDreamIds: [String(NOW), String(NOW + 1_000)],
});
const confirmedMirror = sign({
  id: 'sign:miroir',
  label: 'Miroir',
  displayLabel: 'Miroir',
  category: 'object',
  sourceDreamIds: [String(NOW + 2_000), String(NOW + 3_000)],
});
const pendingStairs = sign({
  id: 'sign:escalier_infini',
  label: 'Escalier infini',
  displayLabel: 'Escalier infini',
  category: 'anomaly',
  decision: 'pending',
  sourceDreamIds: [String(NOW), String(NOW + 4_000)],
});

function prefs(overrides: Partial<LucidDreamAtlasPreferences> = {}): LucidDreamAtlasPreferences {
  return { ...createEmptyLucidDreamAtlasPreferences(), ...overrides };
}

function renderAtlas(
  initial: { userScope?: string; signs?: LucidReconciledDreamSign[]; dreams?: { id: number }[] } = {}
) {
  return renderHook(
    ({ userScope, signs, dreams }) => useLucidDreamAtlas({ userScope, signs, dreams }),
    {
      initialProps: {
        userScope: initial.userScope ?? 'guest',
        signs: initial.signs ?? [confirmedMarie, pendingStairs, confirmedMirror],
        dreams: initial.dreams ?? [
          { id: NOW },
          { id: NOW + 1_000 },
          { id: NOW + 2_000 },
          { id: NOW + 3_000 },
        ],
      },
    }
  );
}

describe('useLucidDreamAtlas', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    loadPrefs.mockReset();
    updatePrefs.mockReset();
    clearPrefs.mockReset();
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('loads confirmed-only nodes and exposes copied source ids on the list', async () => {
    const load = deferred<LucidDreamAtlasPreferences>();
    loadPrefs.mockReturnValueOnce(load.promise);
    const { result } = renderAtlas();
    expect(result.current.snapshot).toBeNull();
    expect(result.current.list).toEqual([]);
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      load.resolve(prefs());
      await load.promise;
    });

    expect(loadPrefs).toHaveBeenCalledWith('guest');
    expect(result.current.snapshot?.nodes.map((node) => node.id)).toEqual(['sign:miroir', 'sign:marie']);
    expect(result.current.list[0]?.sourceDreamIds).toEqual([String(NOW + 2_000), String(NOW + 3_000)]);
    expect(result.current.list[0]?.sourceDreamIds).not.toBe(result.current.snapshot?.nodes[0]?.sourceDreamIds);
    expect(result.current.isLoading).toBe(false);
  });

  it('does not write or mutate before the current scope has loaded', async () => {
    const load = deferred<LucidDreamAtlasPreferences>();
    loadPrefs.mockReturnValueOnce(load.promise);
    const { result } = renderAtlas();
    expect(result.current.snapshot).toBeNull();
    await act(async () => {
      await result.current.renameNode('sign:marie', 'Too soon');
    });
    expect(updatePrefs).not.toHaveBeenCalled();
    expect(result.current.isMutating).toBe(false);
    expect(result.current.snapshot).toBeNull();
    await act(async () => {
      load.resolve(prefs());
      await load.promise;
    });
  });

  it('clears immediately on scope change and ignores stale A loads and mutations', async () => {
    const guestLoad = deferred<LucidDreamAtlasPreferences>();
    const signedLoad = deferred<LucidDreamAtlasPreferences>();
    const guestUpdate = deferred<LucidDreamAtlasPreferences>();
    loadPrefs.mockReturnValueOnce(guestLoad.promise).mockReturnValueOnce(signedLoad.promise);
    updatePrefs.mockReturnValueOnce(guestUpdate.promise);

    const { result, rerender } = renderAtlas({ userScope: 'guest' });
    await act(async () => {
      guestLoad.resolve(prefs({ renamed: { 'sign:marie': 'Guest Marie' } }));
      await guestLoad.promise;
    });

    let guestRename!: Promise<void>;
    await act(async () => {
      guestRename = result.current.renameNode('sign:marie', 'Stale A');
    });
    expect(result.current.isMutating).toBe(true);

    rerender({
      userScope: 'user:abc',
      signs: [confirmedMarie, confirmedMirror],
      dreams: [{ id: NOW }, { id: NOW + 1_000 }, { id: NOW + 2_000 }, { id: NOW + 3_000 }],
    });
    expect(result.current.snapshot).toBeNull();
    expect(result.current.list).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isMutating).toBe(false);

    await act(async () => {
      guestUpdate.resolve(prefs({ renamed: { 'sign:marie': 'Stale A' } }));
      await guestRename.catch(() => undefined);
    });
    await act(async () => {
      signedLoad.resolve(prefs({ hidden: ['sign:miroir'] }));
      await signedLoad.promise;
    });

    expect(result.current.snapshot?.preferences.renamed['sign:marie']).toBeUndefined();
    expect(result.current.snapshot?.nodes.find((node) => node.id === 'sign:miroir')?.hidden).toBe(true);
    expect(result.current.isMutating).toBe(false);
  });

  it('lets the latest refresh win and keeps the last snapshot on a same-scope error', async () => {
    const initial = deferred<LucidDreamAtlasPreferences>();
    const firstRefresh = deferred<LucidDreamAtlasPreferences>();
    const secondRefresh = deferred<LucidDreamAtlasPreferences>();
    const failedRefresh = deferred<LucidDreamAtlasPreferences>();
    loadPrefs
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(firstRefresh.promise)
      .mockReturnValueOnce(secondRefresh.promise)
      .mockReturnValueOnce(failedRefresh.promise);

    const { result } = renderAtlas();
    await act(async () => {
      initial.resolve(prefs({ renamed: { 'sign:marie': 'First' } }));
      await initial.promise;
    });

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = result.current.refresh();
    });
    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      second = result.current.refresh();
    });

    await act(async () => {
      firstRefresh.resolve(prefs({ renamed: { 'sign:marie': 'Stale' } }));
      await first;
    });
    expect(result.current.snapshot?.preferences.renamed['sign:marie']).toBe('First');

    await act(async () => {
      secondRefresh.resolve(prefs({ renamed: { 'sign:marie': 'Latest' } }));
      await second;
    });
    expect(result.current.snapshot?.preferences.renamed['sign:marie']).toBe('Latest');

    let failed!: Promise<void>;
    await act(async () => {
      failed = result.current.refresh();
    });
    await act(async () => {
      failedRefresh.reject(new LucidDreamAtlasStorageError('persistence_failed'));
      await failed;
    });
    expect(result.current.snapshot?.preferences.renamed['sign:marie']).toBe('Latest');
    expect(result.current.error).toBe('persistence_failed');
    expect(result.current.isLoading).toBe(false);
  });

  it('freezes mutation signs and dreams so a pending A write cannot use corpus B', async () => {
    const guestLoad = deferred<LucidDreamAtlasPreferences>();
    const signedLoad = deferred<LucidDreamAtlasPreferences>();
    loadPrefs.mockReturnValueOnce(guestLoad.promise).mockReturnValueOnce(signedLoad.promise);
    let capturedUpdater: ((current: LucidDreamAtlasPreferences) => LucidDreamAtlasPreferences | Promise<LucidDreamAtlasPreferences>) | null = null;
    const guestUpdate = deferred<LucidDreamAtlasPreferences>();
    updatePrefs.mockImplementationOnce(async (_scope, updater) => {
      capturedUpdater = updater;
      return guestUpdate.promise;
    });
    const { result, rerender } = renderAtlas({
      userScope: 'guest',
      signs: [confirmedMarie],
      dreams: [{ id: NOW }, { id: NOW + 1_000 }],
    });
    await act(async () => {
      guestLoad.resolve(prefs());
      await guestLoad.promise;
    });
    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.renameNode('sign:marie', 'Guest Marie');
    });
    rerender({
      userScope: 'user:abc',
      signs: [confirmedMirror],
      dreams: [{ id: NOW + 2_000 }, { id: NOW + 3_000 }],
    });
    await act(async () => {
      signedLoad.resolve(prefs());
      await signedLoad.promise;
    });
    expect(capturedUpdater).not.toBeNull();
    const stored = await capturedUpdater!(prefs());
    expect(stored.renamed['sign:marie']).toBe('Guest Marie');
    expect(stored.hidden).toEqual([]);
    expect(stored.merges).toEqual({});
    expect(updatePrefs.mock.calls[0][0]).toBe('guest');
    await act(async () => {
      guestUpdate.resolve(stored);
      await pending.catch(() => undefined);
    });
  });

  it('keeps the previous snapshot when a same-scope refresh fails', async () => {
    loadPrefs
      .mockResolvedValueOnce(prefs({ renamed: { 'sign:marie': 'Kept' } }))
      .mockRejectedValueOnce(new LucidDreamAtlasStorageError('persistence_failed'));
    const { result } = renderAtlas();
    await act(async () => undefined);
    expect(result.current.snapshot?.preferences.renamed['sign:marie']).toBe('Kept');
    await act(async () => {
      const pending = result.current.refresh();
      expect(result.current.error).toBeNull();
      expect(result.current.snapshot?.preferences.renamed['sign:marie']).toBe('Kept');
      await pending;
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('persistence_failed');
    expect(result.current.snapshot?.preferences.renamed['sign:marie']).toBe('Kept');
    expect(result.current.list.some((item) => item.id === 'sign:marie')).toBe(true);
  });

  it('does not show scope A after a failed load of scope B', async () => {
    const guestLoad = deferred<LucidDreamAtlasPreferences>();
    const signedLoad = deferred<LucidDreamAtlasPreferences>();
    loadPrefs.mockReturnValueOnce(guestLoad.promise).mockReturnValueOnce(signedLoad.promise);
    const { result, rerender } = renderAtlas({ userScope: 'guest' });
    await act(async () => {
      guestLoad.resolve(prefs({ renamed: { 'sign:marie': 'From A' } }));
      await guestLoad.promise;
    });
    rerender({
      userScope: 'user:abc',
      signs: [confirmedMirror],
      dreams: [{ id: NOW + 2_000 }, { id: NOW + 3_000 }],
    });
    expect(result.current.snapshot).toBeNull();
    await act(async () => {
      signedLoad.reject(new LucidDreamAtlasStorageError('persistence_failed'));
      await signedLoad.promise.catch(() => undefined);
    });
    expect(result.current.snapshot).toBeNull();
    expect(result.current.list).toEqual([]);
    expect(result.current.error).toBe('persistence_failed');
  });

  it('rebuilds immediately when signs or dreams change without writing', async () => {
    loadPrefs.mockResolvedValueOnce(prefs());
    const { result, rerender } = renderAtlas();
    await act(async () => undefined);
    expect(result.current.snapshot?.nodes.map((node) => node.id)).toEqual(['sign:miroir', 'sign:marie']);

    rerender({
      userScope: 'guest',
      signs: [confirmedMarie],
      dreams: [{ id: NOW }],
    });
    expect(result.current.snapshot?.nodes.map((node) => node.id)).toEqual(['sign:marie']);
    expect(result.current.snapshot?.nodes[0]?.sourceDreamIds).toEqual([String(NOW)]);
    expect(updatePrefs).not.toHaveBeenCalled();
  });

  it('persists rename hide merge delete and skip writes for ghost ids', async () => {
    loadPrefs.mockResolvedValue(prefs());
    let stored = prefs();
    updatePrefs.mockImplementation(async (_scope, updater) => {
      stored = await updater(stored);
      return stored;
    });
    const { result } = renderAtlas();
    await act(async () => undefined);

    await act(async () => {
      await result.current.renameNode('sign:marie', 'Marie au miroir');
    });
    expect(result.current.snapshot?.nodes.find((node) => node.id === 'sign:marie')?.label).toBe('Marie au miroir');

    await act(async () => {
      await result.current.hideNode('sign:miroir');
    });
    expect(result.current.list.map((item) => item.id)).toEqual(['sign:marie']);

    await act(async () => {
      await result.current.unhideNode('sign:miroir');
    });
    expect(result.current.list.map((item) => item.id)).toEqual(['sign:miroir', 'sign:marie']);

    await act(async () => {
      await result.current.mergeNodes('sign:miroir', 'sign:marie');
    });
    expect(result.current.snapshot?.nodes.map((node) => node.id)).toEqual(['sign:marie']);

    await act(async () => {
      await result.current.deleteNode('sign:marie');
    });
    expect(result.current.snapshot?.nodes).toEqual([]);

    const writes = updatePrefs.mock.calls.length;
    await act(async () => {
      await result.current.renameNode('sign:ghost', 'Nope');
    });
    expect(updatePrefs.mock.calls.length).toBe(writes);
  });

  it('clears preferences for the frozen scope', async () => {
    loadPrefs.mockResolvedValueOnce(prefs({ renamed: { 'sign:marie': 'Marie' } }));
    clearPrefs.mockResolvedValueOnce(undefined);
    const { result } = renderAtlas();
    await act(async () => undefined);
    await act(async () => {
      await result.current.clearPreferences();
    });
    expect(clearPrefs).toHaveBeenCalledWith('guest');
    expect(result.current.snapshot?.preferences).toEqual(createEmptyLucidDreamAtlasPreferences());
  });

  it('keeps isMutating true until every current-scope mutation finishes and ignores old-scope results', async () => {
    const first = deferred<LucidDreamAtlasPreferences>();
    const second = deferred<LucidDreamAtlasPreferences>();
    loadPrefs.mockResolvedValueOnce(prefs());
    updatePrefs.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderAtlas();
    await act(async () => undefined);

    let firstPromise!: Promise<void>;
    let secondPromise!: Promise<void>;
    await act(async () => {
      firstPromise = result.current.renameNode('sign:marie', 'One');
      secondPromise = result.current.renameNode('sign:marie', 'Two');
    });
    expect(result.current.isMutating).toBe(true);

    await act(async () => {
      second.resolve(prefs({ renamed: { 'sign:marie': 'Two' } }));
      await secondPromise;
    });
    expect(result.current.isMutating).toBe(true);
    await act(async () => {
      first.resolve(prefs({ renamed: { 'sign:marie': 'One' } }));
      await firstPromise;
    });
    expect(result.current.isMutating).toBe(false);
  });

  it('surfaces a mutation error without dropping the last snapshot', async () => {
    loadPrefs.mockResolvedValueOnce(prefs({ renamed: { 'sign:marie': 'Kept' } }));
    updatePrefs.mockRejectedValueOnce(new LucidDreamAtlasStorageError('persistence_failed'));
    const { result } = renderAtlas();
    await act(async () => undefined);
    await act(async () => {
      await result.current.renameNode('sign:marie', 'Fail').catch(() => undefined);
    });
    expect(result.current.error).toBe('persistence_failed');
    expect(result.current.snapshot?.preferences.renamed['sign:marie']).toBe('Kept');
  });

  it('is unmount-safe after a late load', async () => {
    const load = deferred<LucidDreamAtlasPreferences>();
    loadPrefs.mockReturnValueOnce(load.promise);
    const { unmount } = renderAtlas();
    unmount();
    await act(async () => {
      load.resolve(prefs({ renamed: { 'sign:marie': 'Late' } }));
      await load.promise;
    });
    expect(consoleError).not.toHaveBeenCalled();
  });
});
