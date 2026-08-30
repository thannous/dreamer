import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { LucidGuidedRitualPlan } from '@/lib/lucid/guidedRitual';
import {
  completeLucidSsildSensoryLabSession,
  createLucidSsildSensoryLabSession,
  createLucidSsildSensoryLabSessionId,
  deriveLucidSsildSensoryLabPlan,
  exitLucidSsildSensoryLabSession,
  getLucidSsildSensoryLabCurrentPhase,
  getLucidSsildSensoryLabProgression,
  getLucidSsildSensoryLabRemainingMs,
  interruptLucidSsildSensoryLabSession,
  parseLucidSsildSensoryLabSession,
  pauseLucidSsildSensoryLabSession,
  resumeLucidSsildSensoryLabSession,
  startLucidSsildSensoryLabSession,
  tickLucidSsildSensoryLabSession,
  type LucidSsildSensoryLabPlan,
  type LucidSsildSensoryLabSession,
  type LucidSsildSensoryPhase,
} from '@/lib/lucid/ssildSensoryLab';
import {
  LucidSsildSensoryLabStorageError,
  clearLucidSsildSensoryLabCurrentSession,
  loadLucidSsildSensoryLabCurrentSession,
  updateLucidSsildSensoryLabCurrentSession,
  type LucidSsildSensoryLabStorageErrorReason,
} from '@/services/lucidSsildSensoryLabStorage';

export type UseLucidSsildSensoryLabOptions = {
  userScope: string;
  now?: number | (() => number);
  entropy?: string | (() => string);
};

export type UseLucidSsildSensoryLabResult = {
  currentSession: LucidSsildSensoryLabSession | null;
  plan: LucidSsildSensoryLabPlan | null;
  phase: LucidSsildSensoryPhase | null;
  progression: number;
  remainingMs: number;
  isLoading: boolean;
  isMutating: boolean;
  error: LucidSsildSensoryLabStorageErrorReason | null;
  refresh: () => Promise<void>;
  startNew: (guidedPlan: LucidGuidedRitualPlan) => Promise<LucidSsildSensoryLabSession | null>;
  tick: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  interruptAudio: () => Promise<void>;
  exit: () => Promise<void>;
  complete: () => Promise<void>;
  clear: () => Promise<void>;
};

function toErrorReason(error: unknown): LucidSsildSensoryLabStorageErrorReason {
  if (error instanceof LucidSsildSensoryLabStorageError) return error.reason;
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/ssild sensory lab|guided ritual|invalid ssild/i.test(message)) {
    return 'invalid_metadata';
  }
  return 'persistence_failed';
}

function cloneSession(session: LucidSsildSensoryLabSession): LucidSsildSensoryLabSession {
  const parsed = parseLucidSsildSensoryLabSession(session);
  if (!parsed) {
    throw new LucidSsildSensoryLabStorageError(
      'invalid_metadata',
      'Invalid SSILD sensory lab session'
    );
  }
  return parsed;
}

function cloneSessionOrNull(
  session: LucidSsildSensoryLabSession | null
): LucidSsildSensoryLabSession | null {
  return session ? cloneSession(session) : null;
}

function isResumable(session: LucidSsildSensoryLabSession | null): boolean {
  return (
    session?.status === 'running' ||
    session?.status === 'paused' ||
    session?.status === 'interrupted'
  );
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

function derivedPlan(session: LucidSsildSensoryLabSession | null): LucidSsildSensoryLabPlan | null {
  return session ? deriveLucidSsildSensoryLabPlan(session) : null;
}

function derivedPhase(session: LucidSsildSensoryLabSession | null): LucidSsildSensoryPhase | null {
  return session ? getLucidSsildSensoryLabCurrentPhase(session) : null;
}

export function useLucidSsildSensoryLab({
  userScope,
  now,
  entropy,
}: UseLucidSsildSensoryLabOptions): UseLucidSsildSensoryLabResult {
  const [stateScope, setStateScope] = useState(userScope);
  const [currentSession, setCurrentSession] = useState<LucidSsildSensoryLabSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingByScope, setPendingByScope] = useState<Record<string, number>>({});
  const [error, setError] = useState<LucidSsildSensoryLabStorageErrorReason | null>(null);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);

  const scopeRef = useRef(userScope);
  const mountedRef = useRef(true);
  const loadGenerationRef = useRef(0);
  const loadedScopeRef = useRef<string | null>(null);
  const pendingByScopeRef = useRef<Record<string, number>>({});
  const sessionRef = useRef<LucidSsildSensoryLabSession | null>(null);
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
    sessionRef.current = currentSession;
  }, [currentSession, entropy, now]);

  const scopeMatches = stateScope === userScope;
  const visibleSession = useMemo(
    () =>
      scopeMatches && loadedScope === userScope ? cloneSessionOrNull(currentSession) : null,
    [currentSession, loadedScope, scopeMatches, userScope]
  );
  const plan = useMemo(() => derivedPlan(visibleSession), [visibleSession]);
  const phase = useMemo(() => derivedPhase(visibleSession), [visibleSession]);
  const progression = useMemo(
    () => (visibleSession ? getLucidSsildSensoryLabProgression(visibleSession) : 0),
    [visibleSession]
  );
  const remainingMs = useMemo(
    () => (visibleSession ? getLucidSsildSensoryLabRemainingMs(visibleSession) : 0),
    [visibleSession]
  );

  const canApplyToScope = useCallback((scope: string, generation: number) => {
    return mountedRef.current && scopeRef.current === scope && loadGenerationRef.current === generation;
  }, []);

  const applySession = useCallback(
    (
      scope: string,
      generation: number,
      next: LucidSsildSensoryLabSession | null,
      options?: { clearError?: boolean }
    ) => {
      if (!canApplyToScope(scope, generation)) return false;
      const cloned = cloneSessionOrNull(next);
      sessionRef.current = cloned;
      setCurrentSession(cloned);
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
        const loaded = await loadLucidSsildSensoryLabCurrentSession(scope);
        applySession(scope, generation, loaded);
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
    [applySession, canApplyToScope]
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
    sessionRef.current = null;
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

  const currentClock = useCallback((session?: LucidSsildSensoryLabSession | null) => {
    const clock = readClock(nowRef.current);
    if (session && clock < session.updatedAt) return session.updatedAt;
    return clock;
  }, []);

  const nextSessionId = useCallback(() => {
    entropyCounterRef.current += 1;
    const seed = readEntropy(entropyRef.current, `ssild${entropyCounterRef.current}`);
    return createLucidSsildSensoryLabSessionId(currentClock(), seed);
  }, [currentClock]);

  const runMutation = useCallback(
    async (
      apply: (
        current: LucidSsildSensoryLabSession | null
      ) => LucidSsildSensoryLabSession | null,
      skipWriteIf?: (current: LucidSsildSensoryLabSession | null) => boolean
    ) => {
      const scope = scopeRef.current;
      if (loadedScopeRef.current !== scope) return cloneSessionOrNull(sessionRef.current);
      if (skipWriteIf?.(cloneSessionOrNull(sessionRef.current))) {
        return cloneSessionOrNull(sessionRef.current);
      }
      const generation = beginMutation(scope);
      try {
        const next = await updateLucidSsildSensoryLabCurrentSession(scope, (current) => {
          const cloned = cloneSessionOrNull(current);
          if (skipWriteIf?.(cloned)) return cloned;
          return apply(cloned);
        });
        if (canApplyToScope(scope, generation)) {
          applySession(scope, generation, next);
        }
        return cloneSessionOrNull(next);
      } catch (caught) {
        if (canApplyToScope(scope, generation)) {
          setError(toErrorReason(caught));
          setStateScope(scope);
        }
        if (!(caught instanceof LucidSsildSensoryLabStorageError)) {
          throw new LucidSsildSensoryLabStorageError(
            toErrorReason(caught),
            caught instanceof Error ? caught.message : String(caught)
          );
        }
        throw caught;
      } finally {
        finishMutation(scope);
      }
    },
    [applySession, beginMutation, canApplyToScope, finishMutation]
  );

  const mutateCurrent = useCallback(
    async (
      transition: (session: LucidSsildSensoryLabSession, now: number) => LucidSsildSensoryLabSession
    ) => {
      await runMutation((current) => {
        if (!current) return current;
        return transition(current, currentClock(current));
      });
    },
    [currentClock, runMutation]
  );

  const startNew = useCallback(
    async (guidedPlan: LucidGuidedRitualPlan) => {
      const scope = scopeRef.current;
      if (loadedScopeRef.current !== scope) return null;
      return runMutation(
        (current) => {
          if (isResumable(current)) return current;
          const createdAt = currentClock(current);
          const created = createLucidSsildSensoryLabSession({
            plan: guidedPlan,
            sessionId: nextSessionId(),
            now: createdAt,
          });
          return startLucidSsildSensoryLabSession(created, createdAt);
        },
        (current) => isResumable(current)
      );
    },
    [currentClock, nextSessionId, runMutation]
  );

  const tick = useCallback(async () => {
    await runMutation((current) => {
      if (!current || current.status !== 'running') return current;
      return tickLucidSsildSensoryLabSession(current, currentClock(current)).session;
    });
  }, [currentClock, runMutation]);

  const pause = useCallback(async () => {
    await mutateCurrent(pauseLucidSsildSensoryLabSession);
  }, [mutateCurrent]);

  const resume = useCallback(async () => {
    await mutateCurrent(resumeLucidSsildSensoryLabSession);
  }, [mutateCurrent]);

  const interruptAudio = useCallback(async () => {
    await mutateCurrent((session, clock) =>
      interruptLucidSsildSensoryLabSession(session, clock, 'audio_route')
    );
  }, [mutateCurrent]);

  const exit = useCallback(async () => {
    await mutateCurrent(exitLucidSsildSensoryLabSession);
  }, [mutateCurrent]);

  const complete = useCallback(async () => {
    await mutateCurrent(completeLucidSsildSensoryLabSession);
  }, [mutateCurrent]);

  const clear = useCallback(async () => {
    const scope = scopeRef.current;
    if (loadedScopeRef.current !== scope) return;
    const generation = beginMutation(scope);
    try {
      await clearLucidSsildSensoryLabCurrentSession(scope);
      applySession(scope, generation, null);
    } catch (caught) {
      if (canApplyToScope(scope, generation)) {
        setError(toErrorReason(caught));
        setStateScope(scope);
      }
      throw caught instanceof LucidSsildSensoryLabStorageError
        ? caught
        : new LucidSsildSensoryLabStorageError(toErrorReason(caught));
    } finally {
      finishMutation(scope);
    }
  }, [applySession, beginMutation, canApplyToScope, finishMutation]);

  return {
    currentSession: scopeMatches ? visibleSession : null,
    plan: scopeMatches ? plan : null,
    phase: scopeMatches ? phase : null,
    progression: scopeMatches ? progression : 0,
    remainingMs: scopeMatches ? remainingMs : 0,
    isLoading: scopeMatches ? isLoading : true,
    isMutating: scopeMatches ? (pendingByScope[userScope] ?? 0) > 0 : false,
    error: scopeMatches ? error : null,
    refresh,
    startNew,
    tick,
    pause,
    resume,
    interruptAudio,
    exit,
    complete,
    clear,
  };
}
