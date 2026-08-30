import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLucidTrainer } from '@/context/LucidTrainerContext';
import type { DreamAnalysis } from '@/lib/types';
import {
  buildLucidDreamAtlas,
  deleteLucidDreamAtlasNode,
  getLucidDreamAtlasNode,
  hideLucidDreamAtlasNode,
  listLucidDreamAtlasNodes,
  mergeLucidDreamAtlasNodes,
  renameLucidDreamAtlasNode,
  type LucidDreamAtlasListItem,
  type LucidDreamAtlasPreferences,
  type LucidDreamAtlasSnapshot,
} from '@/lib/lucid/dreamAtlas';
import type { LucidReconciledDreamSign } from '@/lib/lucid/dreamSigns';

export type UseLucidDreamAtlasOptions = {
  signs: readonly LucidReconciledDreamSign[];
  dreams?: readonly Pick<DreamAnalysis, 'id'>[];
};

export type UseLucidDreamAtlasResult = {
  snapshot: LucidDreamAtlasSnapshot | null;
  list: LucidDreamAtlasListItem[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  renameNode: (nodeId: string, label: string) => Promise<void>;
  hideNode: (nodeId: string) => Promise<void>;
  unhideNode: (nodeId: string) => Promise<void>;
  mergeNodes: (fromId: string, intoId: string) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  clearPreferences: () => Promise<void>;
};

function toErrorReason(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'reason' in error &&
    typeof (error as { reason: unknown }).reason === 'string'
  ) {
    return (error as { reason: string }).reason;
  }
  return 'persistence_failed';
}

export function useLucidDreamAtlas({
  signs,
  dreams,
}: UseLucidDreamAtlasOptions): UseLucidDreamAtlasResult {
  const {
    state,
    loading,
    error: trainerError,
    userScope,
    updateDreamAtlasPreferences,
    clearDreamAtlasPreferences,
    reload,
  } = useLucidTrainer();

  const [pendingByScope, setPendingByScope] = useState<Record<string, number>>({});
  const [mutationErrorByScope, setMutationErrorByScope] = useState<Record<string, string>>({});

  const mountedRef = useRef(true);
  const pendingByScopeRef = useRef<Record<string, number>>({});

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const snapshot = useMemo(() => {
    if (state == null) return null;
    return buildLucidDreamAtlas({
      signs,
      dreams,
      preferences: state.dreamAtlas,
    });
  }, [dreams, signs, state]);
  const list = useMemo(
    () => (snapshot ? listLucidDreamAtlasNodes(snapshot) : []),
    [snapshot]
  );

  const beginMutation = useCallback((scope: string) => {
    const nextCount = (pendingByScopeRef.current[scope] ?? 0) + 1;
    pendingByScopeRef.current = { ...pendingByScopeRef.current, [scope]: nextCount };
    if (mountedRef.current) setPendingByScope(pendingByScopeRef.current);
  }, []);

  const finishMutation = useCallback((scope: string) => {
    const nextCount = Math.max(0, (pendingByScopeRef.current[scope] ?? 0) - 1);
    const nextPending = { ...pendingByScopeRef.current };
    if (nextCount === 0) delete nextPending[scope];
    else nextPending[scope] = nextCount;
    pendingByScopeRef.current = nextPending;
    if (mountedRef.current) setPendingByScope(nextPending);
  }, []);

  const assignScopeError = useCallback((scope: string, reason: string | null) => {
    if (!mountedRef.current) return;
    setMutationErrorByScope((current) => {
      if (reason == null) {
        if (!(scope in current)) return current;
        const next = { ...current };
        delete next[scope];
        return next;
      }
      if (current[scope] === reason) return current;
      return { ...current, [scope]: reason };
    });
  }, []);

  const runMutation = useCallback(
    async (
      apply: (
        current: LucidDreamAtlasSnapshot,
        currentSigns: readonly LucidReconciledDreamSign[],
        currentDreams: readonly Pick<DreamAnalysis, 'id'>[] | undefined
      ) => LucidDreamAtlasSnapshot,
      skipWriteIf?: (current: LucidDreamAtlasSnapshot) => boolean
    ) => {
      const operationScope = userScope;
      const currentState = state;
      if (currentState == null) return;

      const mutationSigns = signs;
      const mutationDreams = dreams;
      const localSnapshot = buildLucidDreamAtlas({
        signs: mutationSigns,
        dreams: mutationDreams,
        preferences: currentState.dreamAtlas,
      });
      if (skipWriteIf?.(localSnapshot)) return;

      beginMutation(operationScope);
      try {
        await updateDreamAtlasPreferences((current: LucidDreamAtlasPreferences) => {
          const currentSnapshot = buildLucidDreamAtlas({
            signs: mutationSigns,
            dreams: mutationDreams,
            preferences: current,
          });
          if (skipWriteIf?.(currentSnapshot)) return current;
          return apply(currentSnapshot, mutationSigns, mutationDreams).preferences;
        });
        assignScopeError(operationScope, null);
      } catch (caught) {
        assignScopeError(operationScope, toErrorReason(caught));
        throw caught;
      } finally {
        finishMutation(operationScope);
      }
    },
    [
      assignScopeError,
      beginMutation,
      dreams,
      finishMutation,
      signs,
      state,
      updateDreamAtlasPreferences,
      userScope,
    ]
  );

  const renameNode = useCallback(
    async (nodeId: string, label: string) => {
      await runMutation(
        (current, currentSigns, currentDreams) =>
          renameLucidDreamAtlasNode(current, nodeId, label, currentSigns, currentDreams),
        (current) => getLucidDreamAtlasNode(current, nodeId) == null
      );
    },
    [runMutation]
  );

  const hideNode = useCallback(
    async (nodeId: string) => {
      await runMutation(
        (current, currentSigns, currentDreams) =>
          hideLucidDreamAtlasNode(current, nodeId, true, currentSigns, currentDreams),
        (current) => getLucidDreamAtlasNode(current, nodeId) == null
      );
    },
    [runMutation]
  );

  const unhideNode = useCallback(
    async (nodeId: string) => {
      await runMutation(
        (current, currentSigns, currentDreams) =>
          hideLucidDreamAtlasNode(current, nodeId, false, currentSigns, currentDreams),
        (current) => getLucidDreamAtlasNode(current, nodeId) == null
      );
    },
    [runMutation]
  );

  const mergeNodes = useCallback(
    async (fromId: string, intoId: string) => {
      await runMutation(
        (current, currentSigns, currentDreams) =>
          mergeLucidDreamAtlasNodes(current, fromId, intoId, currentSigns, currentDreams),
        (current) =>
          getLucidDreamAtlasNode(current, fromId) == null || getLucidDreamAtlasNode(current, intoId) == null
      );
    },
    [runMutation]
  );

  const deleteNode = useCallback(
    async (nodeId: string) => {
      await runMutation(
        (current, currentSigns, currentDreams) =>
          deleteLucidDreamAtlasNode(current, nodeId, currentSigns, currentDreams),
        (current) => getLucidDreamAtlasNode(current, nodeId) == null
      );
    },
    [runMutation]
  );

  const clearPreferences = useCallback(async () => {
    const operationScope = userScope;
    if (state == null) return;
    beginMutation(operationScope);
    try {
      await clearDreamAtlasPreferences();
      assignScopeError(operationScope, null);
    } catch (caught) {
      assignScopeError(operationScope, toErrorReason(caught));
      throw caught;
    } finally {
      finishMutation(operationScope);
    }
  }, [
    assignScopeError,
    beginMutation,
    clearDreamAtlasPreferences,
    finishMutation,
    state,
    userScope,
  ]);

  const refresh = useCallback(async () => {
    const operationScope = userScope;
    try {
      await reload();
      assignScopeError(operationScope, null);
    } catch (caught) {
      assignScopeError(operationScope, toErrorReason(caught));
    }
  }, [assignScopeError, reload, userScope]);

  return {
    snapshot,
    list,
    isLoading: state == null || loading,
    isMutating: (pendingByScope[userScope] ?? 0) > 0,
    error: mutationErrorByScope[userScope] ?? trainerError,
    refresh,
    renameNode,
    hideNode,
    unhideNode,
    mergeNodes,
    deleteNode,
    clearPreferences,
  };
}
