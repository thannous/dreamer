/* @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useLucidDreamAtlas } from '@/hooks/useLucidDreamAtlas';
import {
  createEmptyLucidDreamAtlasOverlay,
  createEmptyLucidDreamAtlasPreferences,
  type LucidDreamAtlasOverlay,
  type LucidDreamAtlasPreferences,
} from '@/lib/lucid/dreamAtlas';
import type { LucidReconciledDreamSign } from '@/lib/lucid/dreamSigns';

const NOW = Date.UTC(2026, 7, 28, 10, 0, 0);

type TrainerState = { dreamAtlas?: LucidDreamAtlasOverlay } | null;

const mockTrainer: {
  userScope: string;
  state: TrainerState;
  loading: boolean;
  error: string | null;
  updateDreamAtlasPreferences: jest.Mock;
  clearDreamAtlasPreferences: jest.Mock;
  reload: jest.Mock;
} = {
  userScope: 'guest',
  state: null,
  loading: false,
  error: null,
  updateDreamAtlasPreferences: jest.fn(),
  clearDreamAtlasPreferences: jest.fn(),
  reload: jest.fn(),
};

jest.mock('@/context/LucidTrainerContext', () => ({
  useLucidTrainer: () => mockTrainer,
}));

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

const defaultSigns = [confirmedMarie, pendingStairs, confirmedMirror];
const defaultDreams = [
  { id: NOW },
  { id: NOW + 1_000 },
  { id: NOW + 2_000 },
  { id: NOW + 3_000 },
];

function overlay(overrides: Partial<LucidDreamAtlasPreferences> = {}): LucidDreamAtlasOverlay {
  return {
    ...createEmptyLucidDreamAtlasOverlay(NOW),
    ...overrides,
  };
}

function clonePrefs(current?: LucidDreamAtlasOverlay | LucidDreamAtlasPreferences | null): LucidDreamAtlasPreferences {
  const base = current ?? createEmptyLucidDreamAtlasPreferences();
  return {
    version: base.version,
    renamed: { ...base.renamed },
    hidden: [...base.hidden],
    merges: { ...base.merges },
    deleted: [...base.deleted],
  };
}

function renderAtlas(
  initial: { signs?: LucidReconciledDreamSign[]; dreams?: { id: number }[] } = {}
) {
  return renderHook(({ signs, dreams }) => useLucidDreamAtlas({ signs, dreams }), {
    initialProps: {
      signs: initial.signs ?? defaultSigns,
      dreams: initial.dreams ?? defaultDreams,
    },
  });
}

describe('useLucidDreamAtlas', () => {
  beforeEach(() => {
    mockTrainer.userScope = 'guest';
    mockTrainer.state = { dreamAtlas: overlay() };
    mockTrainer.loading = false;
    mockTrainer.error = null;
    mockTrainer.updateDreamAtlasPreferences.mockReset();
    mockTrainer.clearDreamAtlasPreferences.mockReset();
    mockTrainer.reload.mockReset();
    mockTrainer.updateDreamAtlasPreferences.mockImplementation(
      async (updater: (current: LucidDreamAtlasPreferences) => LucidDreamAtlasPreferences) => {
        const next = updater(clonePrefs(mockTrainer.state?.dreamAtlas));
        if (mockTrainer.state) {
          mockTrainer.state = {
            ...mockTrainer.state,
            dreamAtlas: { ...next, updatedAt: NOW },
          };
        }
        return next;
      }
    );
    mockTrainer.clearDreamAtlasPreferences.mockImplementation(async () => {
      if (mockTrainer.state) {
        mockTrainer.state = {
          ...mockTrainer.state,
          dreamAtlas: createEmptyLucidDreamAtlasOverlay(NOW),
        };
      }
    });
    mockTrainer.reload.mockResolvedValue(undefined);
  });

  it('builds a confirmed-only snapshot from trainer state', () => {
    mockTrainer.state = {
      dreamAtlas: overlay({ renamed: { 'sign:marie': 'Marie au salon' } }),
    };
    const { result } = renderAtlas();

    expect(result.current.snapshot?.nodes.map((node) => node.id)).toEqual(['sign:miroir', 'sign:marie']);
    expect(result.current.snapshot?.nodes.find((node) => node.id === 'sign:marie')?.label).toBe('Marie au salon');
    expect(result.current.list.map((item) => item.id)).toEqual(['sign:miroir', 'sign:marie']);
    expect(result.current.list[0]?.sourceDreamIds).toEqual([String(NOW + 2_000), String(NOW + 3_000)]);
    expect(result.current.list[0]?.sourceDreamIds).not.toBe(result.current.snapshot?.nodes[0]?.sourceDreamIds);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isMutating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('is loading and ignores mutations while trainer state is null', async () => {
    mockTrainer.state = null;
    mockTrainer.loading = true;
    const { result } = renderAtlas();

    expect(result.current.snapshot).toBeNull();
    expect(result.current.list).toEqual([]);
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await result.current.renameNode('sign:marie', 'Too soon');
      await result.current.hideNode('sign:marie');
      await result.current.unhideNode('sign:marie');
      await result.current.mergeNodes('sign:miroir', 'sign:marie');
      await result.current.deleteNode('sign:marie');
      await result.current.clearPreferences();
    });

    expect(mockTrainer.updateDreamAtlasPreferences).not.toHaveBeenCalled();
    expect(mockTrainer.clearDreamAtlasPreferences).not.toHaveBeenCalled();
    expect(result.current.isMutating).toBe(false);
    expect(result.current.snapshot).toBeNull();
  });

  it('does not update context when the node is absent', async () => {
    const { result } = renderAtlas();

    await act(async () => {
      await result.current.renameNode('sign:ghost', 'Nope');
      await result.current.hideNode('sign:ghost');
      await result.current.unhideNode('sign:ghost');
      await result.current.mergeNodes('sign:ghost', 'sign:marie');
      await result.current.deleteNode('sign:ghost');
    });

    expect(mockTrainer.updateDreamAtlasPreferences).not.toHaveBeenCalled();
    expect(result.current.isMutating).toBe(false);
    expect(result.current.snapshot?.preferences).toEqual(createEmptyLucidDreamAtlasPreferences());
  });

  it('rename hide unhide merge and delete update trainer prefs', async () => {
    const { result } = renderAtlas();

    await act(async () => {
      await result.current.renameNode('sign:marie', 'Marie au miroir');
    });
    expect(mockTrainer.updateDreamAtlasPreferences).toHaveBeenCalledTimes(1);
    expect(result.current.snapshot?.nodes.find((node) => node.id === 'sign:marie')?.label).toBe('Marie au miroir');
    expect(mockTrainer.state?.dreamAtlas?.renamed['sign:marie']).toBe('Marie au miroir');

    await act(async () => {
      await result.current.hideNode('sign:miroir');
    });
    expect(result.current.list.map((item) => item.id)).toEqual(['sign:marie']);
    expect(mockTrainer.state?.dreamAtlas?.hidden).toEqual(['sign:miroir']);

    await act(async () => {
      await result.current.unhideNode('sign:miroir');
    });
    expect(result.current.list.map((item) => item.id)).toEqual(['sign:miroir', 'sign:marie']);
    expect(mockTrainer.state?.dreamAtlas?.hidden).toEqual([]);

    await act(async () => {
      await result.current.mergeNodes('sign:miroir', 'sign:marie');
    });
    expect(result.current.snapshot?.nodes.map((node) => node.id)).toEqual(['sign:marie']);
    expect(mockTrainer.state?.dreamAtlas?.merges).toEqual({ 'sign:miroir': 'sign:marie' });

    await act(async () => {
      await result.current.deleteNode('sign:marie');
    });
    expect(result.current.snapshot?.nodes).toEqual([]);
    expect(mockTrainer.state?.dreamAtlas?.deleted).toEqual(['sign:marie', 'sign:miroir']);
    expect(mockTrainer.updateDreamAtlasPreferences).toHaveBeenCalledTimes(5);
  });

  it('clears atlas preferences through the trainer', async () => {
    mockTrainer.state = {
      dreamAtlas: overlay({ renamed: { 'sign:marie': 'Marie' } }),
    };
    const { result } = renderAtlas();
    expect(result.current.snapshot?.preferences.renamed['sign:marie']).toBe('Marie');

    await act(async () => {
      await result.current.clearPreferences();
    });

    expect(mockTrainer.clearDreamAtlasPreferences).toHaveBeenCalledTimes(1);
    expect(mockTrainer.updateDreamAtlasPreferences).not.toHaveBeenCalled();
    expect(result.current.snapshot?.preferences).toEqual(createEmptyLucidDreamAtlasPreferences());
    expect(result.current.isMutating).toBe(false);
  });

  it('refresh success clears a previous mutation error', async () => {
    mockTrainer.reload.mockRejectedValueOnce({ reason: 'persistence_failed' }).mockResolvedValueOnce(undefined);
    const { result } = renderAtlas();

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBe('persistence_failed');

    await act(async () => {
      await result.current.refresh();
    });
    expect(mockTrainer.reload).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    expect(result.current.snapshot?.nodes.map((node) => node.id)).toEqual(['sign:miroir', 'sign:marie']);
  });

  it('refresh error keeps the current snapshot', async () => {
    mockTrainer.state = {
      dreamAtlas: overlay({ renamed: { 'sign:marie': 'Kept' } }),
    };
    mockTrainer.reload.mockRejectedValueOnce({ reason: 'persistence_failed' });
    const { result } = renderAtlas();

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBe('persistence_failed');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.snapshot?.preferences.renamed['sign:marie']).toBe('Kept');
    expect(result.current.list.some((item) => item.id === 'sign:marie')).toBe(true);
  });

  it('does not leak guest busy or error after rerendering as a signed-in user', async () => {
    const guestUpdate = deferred<LucidDreamAtlasPreferences>();
    mockTrainer.updateDreamAtlasPreferences.mockReturnValueOnce(guestUpdate.promise);
    const { result, rerender } = renderAtlas();

    let guestRename!: Promise<void>;
    await act(async () => {
      guestRename = result.current.renameNode('sign:marie', 'Guest Marie');
    });
    expect(result.current.isMutating).toBe(true);

    mockTrainer.userScope = 'user:abc';
    mockTrainer.state = { dreamAtlas: overlay({ hidden: ['sign:miroir'] }) };
    mockTrainer.error = null;
    rerender({ signs: defaultSigns, dreams: defaultDreams });

    expect(result.current.isMutating).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.snapshot?.nodes.find((node) => node.id === 'sign:miroir')?.hidden).toBe(true);

    await act(async () => {
      guestUpdate.reject({ reason: 'persistence_failed' });
      await guestRename.catch(() => undefined);
    });

    expect(result.current.isMutating).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.snapshot?.preferences.renamed['sign:marie']).toBeUndefined();
  });

  it('does not warn about setState after unmount', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const pending = deferred<LucidDreamAtlasPreferences>();
    mockTrainer.updateDreamAtlasPreferences.mockReturnValueOnce(pending.promise);
    const { result, unmount } = renderAtlas();

    let rename!: Promise<void>;
    await act(async () => {
      rename = result.current.renameNode('sign:marie', 'Late');
    });

    act(() => {
      unmount();
    });

    await act(async () => {
      pending.resolve(clonePrefs(overlay({ renamed: { 'sign:marie': 'Late' } })));
      await rename.catch(() => undefined);
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
