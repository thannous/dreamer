import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  completeLucidDreamRehearsalSession,
  confirmLucidDreamRehearsalIntention,
  createLucidDreamRehearsalSession,
  createLucidDreamRehearsalSessionId,
  interruptLucidDreamRehearsalSession,
  parseLucidDreamRehearsalCompletion,
  parseLucidDreamRehearsalSession,
  projectLucidDreamRehearsalCompletion,
  recognizeLucidDreamRehearsalSign,
  resumeLucidDreamRehearsalSession,
  type LucidDreamRehearsalCompletion,
  type LucidDreamRehearsalPresentation,
  type LucidDreamRehearsalScene,
  type LucidDreamRehearsalSession,
  type LucidDreamRehearsalSourceProgram,
} from '@/lib/lucid/dreamRehearsal';
import {
  LUCID_DREAM_REHEARSAL_MAX_STORED_COMPLETIONS,
  LucidDreamRehearsalStorageError,
  clearLucidDreamRehearsalCurrentSession,
  clearLucidDreamRehearsalState,
  loadLucidDreamRehearsalState,
  updateLucidDreamRehearsalState,
  type LucidDreamRehearsalStorageErrorReason,
  type LucidDreamRehearsalStoredEnvelope,
} from '@/services/lucidDreamRehearsalStorage';

export type UseLucidDreamRehearsalOptions = {
  userScope: string;
  now?: number | (() => number);
  entropy?: string | (() => string);
};

export type UseLucidDreamRehearsalResult = {
  currentSession: LucidDreamRehearsalSession | null;
  completions: LucidDreamRehearsalCompletion[];
  isLoading: boolean;
  isMutating: boolean;
  error: LucidDreamRehearsalStorageErrorReason | null;
  refresh: () => Promise<void>;
  start: (
    scene: LucidDreamRehearsalScene,
    sourceProgram: LucidDreamRehearsalSourceProgram,
    presentation: LucidDreamRehearsalPresentation
  ) => Promise<LucidDreamRehearsalSession | null>;
  recognize: (signId: string) => Promise<void>;
  confirmIntention: () => Promise<void>;
  interrupt: () => Promise<void>;
  resume: () => Promise<void>;
  complete: () => Promise<void>;
  clearCurrent: () => Promise<void>;
  clearAll: () => Promise<void>;
};

type RehearsalViewState = {
  currentSession: LucidDreamRehearsalSession | null;
  completions: LucidDreamRehearsalCompletion[];
};

function toErrorReason(error: unknown): LucidDreamRehearsalStorageErrorReason {
  if (error instanceof LucidDreamRehearsalStorageError) return error.reason;
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/dream rehearsal|recognized before intention|cannot complete before both actions|must target the chosen sign/i.test(message)) {
    return 'invalid_metadata';
  }
  return 'persistence_failed';
}

function cloneSession(session: LucidDreamRehearsalSession): LucidDreamRehearsalSession {
  const parsed = parseLucidDreamRehearsalSession(session);
  if (!parsed) {
    throw new LucidDreamRehearsalStorageError(
      'invalid_metadata',
      'Invalid dream rehearsal session'
    );
  }
  return parsed;
}

function cloneCompletion(
  completion: LucidDreamRehearsalCompletion
): LucidDreamRehearsalCompletion {
  const parsed = parseLucidDreamRehearsalCompletion(completion);
  if (!parsed) {
    throw new LucidDreamRehearsalStorageError(
      'invalid_metadata',
      'Invalid dream rehearsal completion'
    );
  }
  return parsed;
}

function compareCompletionIds(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function chooseNewestCompletion(
  left: LucidDreamRehearsalCompletion,
  right: LucidDreamRehearsalCompletion
): LucidDreamRehearsalCompletion {
  if (left.completedAt !== right.completedAt) {
    return left.completedAt > right.completedAt ? left : right;
  }
  const leftJson = JSON.stringify(left);
  const rightJson = JSON.stringify(right);
  return leftJson >= rightJson ? left : right;
}

function rankStoredCompletions(
  completions: readonly LucidDreamRehearsalCompletion[]
): LucidDreamRehearsalCompletion[] {
  const byId = new Map<string, LucidDreamRehearsalCompletion>();
  for (const completion of completions) {
    const parsed = cloneCompletion(completion);
    const existing = byId.get(parsed.sessionId);
    byId.set(parsed.sessionId, existing ? chooseNewestCompletion(existing, parsed) : parsed);
  }
  return [...byId.values()]
    .sort((left, right) => {
      if (left.completedAt !== right.completedAt) return right.completedAt - left.completedAt;
      return compareCompletionIds(left.sessionId, right.sessionId);
    })
    .slice(0, LUCID_DREAM_REHEARSAL_MAX_STORED_COMPLETIONS)
    .map(cloneCompletion);
}

function cloneView(view: RehearsalViewState): RehearsalViewState {
  return {
    currentSession: view.currentSession ? cloneSession(view.currentSession) : null,
    completions: view.completions.map(cloneCompletion),
  };
}

function viewFromEnvelope(envelope: LucidDreamRehearsalStoredEnvelope): RehearsalViewState {
  return {
    currentSession: envelope.currentSession ? cloneSession(envelope.currentSession) : null,
    completions: envelope.completions.map(cloneCompletion),
  };
}

function emptyView(): RehearsalViewState {
  return { currentSession: null, completions: [] };
}

function readClock(value: number | (() => number) | undefined): number {
  if (typeof value === 'function') return value();
  if (typeof value === 'number') return value;
  return Date.now();
}

function readEntropy(value: string | (() => string) | undefined, fallback: string): string {
  if (typeof value === 'function') return value();
  if (typeof value === 'string' && value.length > 0) return value;
  return fallback;
}

export function useLucidDreamRehearsal({
  userScope,
  now,
  entropy,
}: UseLucidDreamRehearsalOptions): UseLucidDreamRehearsalResult {
  const [stateScope, setStateScope] = useState(userScope);
  const [view, setView] = useState<RehearsalViewState>(emptyView);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingByScope, setPendingByScope] = useState<Record<string, number>>({});
  const [error, setError] = useState<LucidDreamRehearsalStorageErrorReason | null>(null);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);

  const scopeRef = useRef(userScope);
  const mountedRef = useRef(true);
  const loadGenerationRef = useRef(0);
  const loadedScopeRef = useRef<string | null>(null);
  const pendingByScopeRef = useRef<Record<string, number>>({});
  const viewRef = useRef<RehearsalViewState>(emptyView());
  const nowRef = useRef(now);
  const entropyRef = useRef(entropy);
  const entropyCounterRef = useRef(0);

  /* eslint-disable react-hooks/refs -- freeze ops to the new scope on the first mismatched render */
  if (scopeRef.current !== userScope) {
    scopeRef.current = userScope;
  }
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    nowRef.current = now;
    entropyRef.current = entropy;
    viewRef.current = view;
  }, [entropy, now, view]);

  const scopeMatches = stateScope === userScope;
  const visibleView = useMemo(
    () => (scopeMatches && loadedScope === userScope ? cloneView(view) : emptyView()),
    [loadedScope, scopeMatches, userScope, view]
  );

  const canApplyToScope = useCallback((scope: string, generation: number) => {
    return mountedRef.current && scopeRef.current === scope && loadGenerationRef.current === generation;
  }, []);

  const applyView = useCallback(
    (
      scope: string,
      generation: number,
      next: RehearsalViewState,
      options?: { clearError?: boolean }
    ) => {
      if (!canApplyToScope(scope, generation)) return false;
      const cloned = cloneView(next);
      viewRef.current = cloned;
      setView(cloned);
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
        const loaded = await loadLucidDreamRehearsalState(scope);
        applyView(scope, generation, viewFromEnvelope(loaded));
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
    [applyView, canApplyToScope]
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
    viewRef.current = emptyView();
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

  const currentClock = useCallback((session?: LucidDreamRehearsalSession | null) => {
    const clock = readClock(nowRef.current);
    if (session && clock < session.updatedAt) return session.updatedAt;
    return clock;
  }, []);

  const nextSessionId = useCallback(() => {
    entropyCounterRef.current += 1;
    const seed = readEntropy(entropyRef.current, `rehearse${entropyCounterRef.current}`);
    return createLucidDreamRehearsalSessionId(currentClock(), seed);
  }, [currentClock]);

  const runMutation = useCallback(
    async (
      apply: (current: LucidDreamRehearsalStoredEnvelope) => LucidDreamRehearsalStoredEnvelope,
      skipWriteIf?: (current: LucidDreamRehearsalStoredEnvelope) => boolean
    ) => {
      const scope = scopeRef.current;
      if (loadedScopeRef.current !== scope) return cloneView(viewRef.current);
      if (skipWriteIf?.({
        version: 1,
        userScope: scope,
        currentSession: viewRef.current.currentSession,
        completions: viewRef.current.completions,
      })) {
        return cloneView(viewRef.current);
      }
      const generation = beginMutation(scope);
      try {
        const next = await updateLucidDreamRehearsalState(scope, (current) => {
          const cloned = {
            version: current.version,
            userScope: current.userScope,
            currentSession: current.currentSession ? cloneSession(current.currentSession) : null,
            completions: current.completions.map(cloneCompletion),
          };
          if (skipWriteIf?.(cloned)) return cloned;
          return apply(cloned);
        });
        const nextView = viewFromEnvelope(next);
        if (canApplyToScope(scope, generation)) {
          applyView(scope, generation, nextView);
        }
        return cloneView(nextView);
      } catch (caught) {
        if (canApplyToScope(scope, generation)) {
          setError(toErrorReason(caught));
          setStateScope(scope);
        }
        if (!(caught instanceof LucidDreamRehearsalStorageError)) {
          throw new LucidDreamRehearsalStorageError(
            toErrorReason(caught),
            caught instanceof Error ? caught.message : String(caught)
          );
        }
        throw caught;
      } finally {
        finishMutation(scope);
      }
    },
    [applyView, beginMutation, canApplyToScope, finishMutation]
  );

  const mutateCurrent = useCallback(
    async (
      transition: (session: LucidDreamRehearsalSession, now: number) => LucidDreamRehearsalSession
    ) => {
      await runMutation((current) => {
        if (!current.currentSession) return current;
        const nextSession = transition(current.currentSession, currentClock(current.currentSession));
        const projected = projectLucidDreamRehearsalCompletion(nextSession);
        return {
          ...current,
          currentSession: nextSession,
          completions: projected
            ? rankStoredCompletions([projected, ...current.completions])
            : current.completions,
        };
      });
    },
    [currentClock, runMutation]
  );

  const start = useCallback(
    async (
      scene: LucidDreamRehearsalScene,
      sourceProgram: LucidDreamRehearsalSourceProgram,
      presentation: LucidDreamRehearsalPresentation
    ) => {
      const scope = scopeRef.current;
      if (loadedScopeRef.current !== scope) return null;
      const next = await runMutation(
        (current) => {
          if (current.currentSession && current.currentSession.status !== 'completed') {
            return current;
          }
          const createdAt = currentClock(current.currentSession);
          const created = createLucidDreamRehearsalSession({
            scene,
            sessionId: nextSessionId(),
            sourceProgram,
            presentation,
            now: createdAt,
          });
          return {
            ...current,
            currentSession: created,
          };
        },
        (current) => Boolean(current.currentSession && current.currentSession.status !== 'completed')
      );
      return next.currentSession;
    },
    [currentClock, nextSessionId, runMutation]
  );

  const recognize = useCallback(
    async (signId: string) => {
      await mutateCurrent((session, clock) =>
        recognizeLucidDreamRehearsalSign(session, signId, clock)
      );
    },
    [mutateCurrent]
  );

  const confirmIntention = useCallback(async () => {
    await mutateCurrent(confirmLucidDreamRehearsalIntention);
  }, [mutateCurrent]);

  const interrupt = useCallback(async () => {
    await mutateCurrent(interruptLucidDreamRehearsalSession);
  }, [mutateCurrent]);

  const resume = useCallback(async () => {
    await mutateCurrent(resumeLucidDreamRehearsalSession);
  }, [mutateCurrent]);

  const complete = useCallback(async () => {
    await mutateCurrent(completeLucidDreamRehearsalSession);
  }, [mutateCurrent]);

  const clearCurrent = useCallback(async () => {
    const scope = scopeRef.current;
    if (loadedScopeRef.current !== scope) return;
    const generation = beginMutation(scope);
    try {
      const next = await clearLucidDreamRehearsalCurrentSession(scope);
      applyView(scope, generation, viewFromEnvelope(next));
    } catch (caught) {
      if (canApplyToScope(scope, generation)) {
        setError(toErrorReason(caught));
        setStateScope(scope);
      }
      throw caught instanceof LucidDreamRehearsalStorageError
        ? caught
        : new LucidDreamRehearsalStorageError(toErrorReason(caught));
    } finally {
      finishMutation(scope);
    }
  }, [applyView, beginMutation, canApplyToScope, finishMutation]);

  const clearAll = useCallback(async () => {
    const scope = scopeRef.current;
    if (loadedScopeRef.current !== scope) return;
    const generation = beginMutation(scope);
    try {
      await clearLucidDreamRehearsalState(scope);
      applyView(scope, generation, emptyView());
    } catch (caught) {
      if (canApplyToScope(scope, generation)) {
        setError(toErrorReason(caught));
        setStateScope(scope);
      }
      throw caught instanceof LucidDreamRehearsalStorageError
        ? caught
        : new LucidDreamRehearsalStorageError(toErrorReason(caught));
    } finally {
      finishMutation(scope);
    }
  }, [applyView, beginMutation, canApplyToScope, finishMutation]);

  return {
    currentSession: scopeMatches ? visibleView.currentSession : null,
    completions: scopeMatches ? visibleView.completions : [],
    isLoading: scopeMatches ? isLoading : true,
    isMutating: scopeMatches ? (pendingByScope[userScope] ?? 0) > 0 : false,
    error: scopeMatches ? error : null,
    refresh,
    start,
    recognize,
    confirmIntention,
    interrupt,
    resume,
    complete,
    clearCurrent,
    clearAll,
  };
}
