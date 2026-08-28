import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { DreamAnalysis } from '@/lib/types';
import {
  buildLucidDreamAtlas,
  createEmptyLucidDreamAtlasPreferences,
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
import {
  LucidDreamAtlasStorageError,
  clearLucidDreamAtlasPreferences,
  loadLucidDreamAtlasPreferences,
  updateLucidDreamAtlasPreferences,
  type LucidDreamAtlasStorageErrorReason,
} from '@/services/lucidDreamAtlasStorage';

export type UseLucidDreamAtlasOptions = {
  userScope: string;
  signs: readonly LucidReconciledDreamSign[];
  dreams?: readonly Pick<DreamAnalysis, 'id'>[];
};

export type UseLucidDreamAtlasResult = {
  snapshot: LucidDreamAtlasSnapshot | null;
  list: LucidDreamAtlasListItem[];
  isLoading: boolean;
  isMutating: boolean;
  error: LucidDreamAtlasStorageErrorReason | null;
  refresh: () => Promise<void>;
  renameNode: (nodeId: string, label: string) => Promise<void>;
  hideNode: (nodeId: string) => Promise<void>;
  unhideNode: (nodeId: string) => Promise<void>;
  mergeNodes: (fromId: string, intoId: string) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  clearPreferences: () => Promise<void>;
};

function toErrorReason(error: unknown): LucidDreamAtlasStorageErrorReason {
  if (error instanceof LucidDreamAtlasStorageError) return error.reason;
  return 'persistence_failed';
}

function clonePreferences(preferences: LucidDreamAtlasPreferences): LucidDreamAtlasPreferences {
  return {
    version: preferences.version,
    renamed: { ...preferences.renamed },
    hidden: [...preferences.hidden],
    merges: { ...preferences.merges },
    deleted: [...preferences.deleted],
  };
}

export function useLucidDreamAtlas({
  userScope,
  signs,
  dreams,
}: UseLucidDreamAtlasOptions): UseLucidDreamAtlasResult {
  const [stateScope, setStateScope] = useState(userScope);
  const [preferences, setPreferences] = useState<LucidDreamAtlasPreferences>(
    createEmptyLucidDreamAtlasPreferences
  );
  const [isLoading, setIsLoading] = useState(true);
  const [pendingByScope, setPendingByScope] = useState<Record<string, number>>({});
  const [error, setError] = useState<LucidDreamAtlasStorageErrorReason | null>(null);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);

  const scopeRef = useRef(userScope);
  const mountedRef = useRef(true);
  const loadGenerationRef = useRef(0);
  const loadedScopeRef = useRef<string | null>(null);
  const pendingByScopeRef = useRef<Record<string, number>>({});
  const signsRef = useRef(signs);
  const dreamsRef = useRef(dreams);
  const preferencesRef = useRef(preferences);

  /* eslint-disable react-hooks/refs -- freeze ops to the new scope on the first mismatched render */
  if (scopeRef.current !== userScope) {
    scopeRef.current = userScope;
  }
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    signsRef.current = signs;
    dreamsRef.current = dreams;
    preferencesRef.current = preferences;
  }, [dreams, preferences, signs]);

  const scopeMatches = stateScope === userScope;
  const snapshot = useMemo(
    () =>
      scopeMatches && loadedScope === userScope
        ? buildLucidDreamAtlas({ signs, dreams, preferences })
        : null,
    [dreams, loadedScope, preferences, scopeMatches, signs, userScope]
  );
  const list = useMemo(
    () => (snapshot ? listLucidDreamAtlasNodes(snapshot) : []),
    [snapshot]
  );

  const canApplyToScope = useCallback((scope: string, generation: number) => {
    return mountedRef.current && scopeRef.current === scope && loadGenerationRef.current === generation;
  }, []);

  const applyPreferences = useCallback(
    (scope: string, generation: number, next: LucidDreamAtlasPreferences, options?: { clearError?: boolean }) => {
      if (!canApplyToScope(scope, generation)) return false;
      preferencesRef.current = next;
      setPreferences(next);
      setStateScope(scope);
      setIsLoading(false);
      loadedScopeRef.current = scope;
      setLoadedScope(scope);
      if (options?.clearError !== false) setError(null);
      return true;
    },
    [canApplyToScope]
  );

  const loadScope = useCallback(
    async (scope: string, generation: number, options?: { markLoading?: boolean }) => {
      if (options?.markLoading) {
        const nextGeneration = loadGenerationRef.current + 1;
        loadGenerationRef.current = nextGeneration;
        generation = nextGeneration;
        if (loadedScopeRef.current !== scope) {
          loadedScopeRef.current = null;
        } else {
          setError(null);
        }
        setIsLoading(true);
      }
      if (!canApplyToScope(scope, generation)) return;
      try {
        const loaded = await loadLucidDreamAtlasPreferences(scope);
        applyPreferences(scope, generation, clonePreferences(loaded));
      } catch (caught) {
        if (!canApplyToScope(scope, generation)) return;
        setError(toErrorReason(caught));
        setIsLoading(false);
        setStateScope(scope);
        if (loadedScopeRef.current !== scope) {
          loadedScopeRef.current = null;
          setLoadedScope(null);
        }
      }
    },
    [applyPreferences, canApplyToScope]
  );

  const refresh = useCallback(async () => {
    const scope = scopeRef.current;
    const generation = loadGenerationRef.current;
    await loadScope(scope, generation, { markLoading: true });
  }, [loadScope]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    scopeRef.current = userScope;
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    loadedScopeRef.current = null;
    preferencesRef.current = createEmptyLucidDreamAtlasPreferences();
    void loadScope(userScope, generation);
  }, [loadScope, userScope]);

  const beginMutation = useCallback((scope: string) => {
    const nextCount = (pendingByScopeRef.current[scope] ?? 0) + 1;
    pendingByScopeRef.current = { ...pendingByScopeRef.current, [scope]: nextCount };
    if (mountedRef.current) setPendingByScope(pendingByScopeRef.current);
    return loadGenerationRef.current;
  }, []);

  const finishMutation = useCallback((scope: string) => {
    const nextCount = Math.max(0, (pendingByScopeRef.current[scope] ?? 0) - 1);
    const nextPending = { ...pendingByScopeRef.current };
    if (nextCount === 0) delete nextPending[scope];
    else nextPending[scope] = nextCount;
    pendingByScopeRef.current = nextPending;
    if (mountedRef.current) setPendingByScope(nextPending);
  }, []);

  const runMutation = useCallback(
    async (
      apply: (
        snapshot: LucidDreamAtlasSnapshot,
        signs: readonly LucidReconciledDreamSign[],
        dreams: readonly Pick<DreamAnalysis, 'id'>[] | undefined
      ) => LucidDreamAtlasSnapshot,
      skipWriteIf?: (snapshot: LucidDreamAtlasSnapshot) => boolean
    ) => {
      const scope = scopeRef.current;
      if (loadedScopeRef.current !== scope) return;
      const mutationSigns = signsRef.current;
      const mutationDreams = dreamsRef.current;
      const localSnapshot = buildLucidDreamAtlas({
        signs: mutationSigns,
        dreams: mutationDreams,
        preferences: preferencesRef.current,
      });
      if (skipWriteIf?.(localSnapshot)) return;
      const generation = beginMutation(scope);
      try {
        const next = await updateLucidDreamAtlasPreferences(scope, (current) => {
          const currentSnapshot = buildLucidDreamAtlas({
            signs: mutationSigns,
            dreams: mutationDreams,
            preferences: current,
          });
          if (skipWriteIf?.(currentSnapshot)) return current;
          return apply(currentSnapshot, mutationSigns, mutationDreams).preferences;
        });
        if (canApplyToScope(scope, generation)) {
          applyPreferences(scope, generation, clonePreferences(next));
        }
      } catch (caught) {
        if (canApplyToScope(scope, generation)) {
          setError(toErrorReason(caught));
          setStateScope(scope);
        }
        throw caught instanceof LucidDreamAtlasStorageError
          ? caught
          : new LucidDreamAtlasStorageError(toErrorReason(caught));
      } finally {
        finishMutation(scope);
      }
    },
    [applyPreferences, beginMutation, canApplyToScope, finishMutation]
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
    const scope = scopeRef.current;
    const generation = beginMutation(scope);
    try {
      await clearLucidDreamAtlasPreferences(scope);
      applyPreferences(scope, generation, createEmptyLucidDreamAtlasPreferences());
    } catch (caught) {
      if (canApplyToScope(scope, generation)) {
        setError(toErrorReason(caught));
        setStateScope(scope);
      }
      throw caught instanceof LucidDreamAtlasStorageError
        ? caught
        : new LucidDreamAtlasStorageError(toErrorReason(caught));
    } finally {
      finishMutation(scope);
    }
  }, [applyPreferences, beginMutation, canApplyToScope, finishMutation]);

  return {
    snapshot: scopeMatches ? snapshot : null,
    list: scopeMatches ? list : [],
    isLoading: scopeMatches ? isLoading : true,
    isMutating: scopeMatches ? (pendingByScope[userScope] ?? 0) > 0 : false,
    error: scopeMatches ? error : null,
    refresh,
    renameNode,
    hideNode,
    unhideNode,
    mergeNodes,
    deleteNode,
    clearPreferences,
  };
}
