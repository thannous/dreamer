import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  advanceLucidStabilizationLabSession,
  completeLucidStabilizationLabSession,
  createLucidStabilizationLabSession,
  createLucidStabilizationLabSessionId,
  interruptLucidStabilizationLabSession,
  parseLucidStabilizationLabSession,
  pauseLucidStabilizationLabSession,
  projectLucidStabilizationLabInsights,
  repeatLucidStabilizationLabStep,
  resumeLucidStabilizationLabSession,
  startLucidStabilizationLabSession,
  type LucidStabilizationLabInsights,
  type LucidStabilizationLabSession,
} from '@/lib/lucid/stabilizationLab';
import {
  LucidStabilizationLabStorageError,
  clearLucidStabilizationLabSessions,
  loadLucidStabilizationLabSessions,
  updateLucidStabilizationLabSessions,
  type LucidStabilizationLabStorageErrorReason,
} from '@/services/lucidStabilizationLabStorage';

const EMPTY_INSIGHTS: LucidStabilizationLabInsights = {
  completionCount: 0,
  practiceCount: 0,
  repeatCount: 0,
  lastPracticedAt: null,
  recentCompletedAt: null,
};

const MAX_VISIBLE_SESSIONS = 500;

export type UseLucidStabilizationLabOptions = {
  userScope: string;
  now?: number | (() => number);
  entropy?: string | (() => string);
};

export type UseLucidStabilizationLabResult = {
  sessions: LucidStabilizationLabSession[];
  currentSession: LucidStabilizationLabSession | null;
  insights: LucidStabilizationLabInsights;
  isLoading: boolean;
  isMutating: boolean;
  error: LucidStabilizationLabStorageErrorReason | null;
  refresh: () => Promise<void>;
  startNew: () => Promise<LucidStabilizationLabSession | null>;
  advance: () => Promise<void>;
  repeat: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  interrupt: () => Promise<void>;
  complete: () => Promise<void>;
  clear: () => Promise<void>;
};

function toErrorReason(error: unknown): LucidStabilizationLabStorageErrorReason {
  if (error instanceof LucidStabilizationLabStorageError) return error.reason;
  return 'persistence_failed';
}

function cloneSession(session: LucidStabilizationLabSession): LucidStabilizationLabSession {
  const parsed = parseLucidStabilizationLabSession(session);
  if (!parsed) {
    throw new LucidStabilizationLabStorageError('invalid_metadata', 'Invalid stabilization lab session');
  }
  return parsed;
}

function cloneSessions(sessions: readonly LucidStabilizationLabSession[]): LucidStabilizationLabSession[] {
  return sessions.map(cloneSession);
}

function compareSessions(
  left: LucidStabilizationLabSession,
  right: LucidStabilizationLabSession
): number {
  if (left.updatedAt !== right.updatedAt) return right.updatedAt - left.updatedAt;
  return left.sessionId < right.sessionId ? -1 : 1;
}

function rankSessions(
  sessions: readonly LucidStabilizationLabSession[]
): LucidStabilizationLabSession[] {
  const byId = new Map<string, LucidStabilizationLabSession>();
  for (const session of sessions) {
    const parsed = cloneSession(session);
    const existing = byId.get(parsed.sessionId);
    if (!existing || parsed.updatedAt > existing.updatedAt) {
      byId.set(parsed.sessionId, parsed);
    } else if (parsed.updatedAt === existing.updatedAt) {
      const leftJson = JSON.stringify(existing);
      const rightJson = JSON.stringify(parsed);
      byId.set(parsed.sessionId, leftJson >= rightJson ? existing : parsed);
    }
  }
  return [...byId.values()].sort(compareSessions).slice(0, MAX_VISIBLE_SESSIONS);
}

/**
 * Current practice is the newest non-idle session by updatedAt, then sessionId.
 * Leading idle rows are skipped so they cannot hide a newer resumable practice.
 * The first remaining row decides: completed => null, resumable => that session.
 * An older interruption cannot come back after a later completion.
 */
function selectCurrentSession(
  sessions: readonly LucidStabilizationLabSession[]
): LucidStabilizationLabSession | null {
  const ranked = [...sessions].sort(compareSessions);
  const newestRelevant = ranked.find((session) => session.status !== 'idle');
  if (!newestRelevant) return null;
  if (newestRelevant.status === 'completed') return null;
  if (
    newestRelevant.status === 'active' ||
    newestRelevant.status === 'paused' ||
    newestRelevant.status === 'interrupted'
  ) {
    return newestRelevant;
  }
  return null;
}

function selectIdleSession(
  sessions: readonly LucidStabilizationLabSession[]
): LucidStabilizationLabSession | null {
  return sessions.filter((session) => session.status === 'idle').sort(compareSessions)[0] ?? null;
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

export function useLucidStabilizationLab({
  userScope,
  now,
  entropy,
}: UseLucidStabilizationLabOptions): UseLucidStabilizationLabResult {
  const [stateScope, setStateScope] = useState(userScope);
  const [sessions, setSessions] = useState<LucidStabilizationLabSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingByScope, setPendingByScope] = useState<Record<string, number>>({});
  const [error, setError] = useState<LucidStabilizationLabStorageErrorReason | null>(null);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);

  const scopeRef = useRef(userScope);
  const mountedRef = useRef(true);
  const loadGenerationRef = useRef(0);
  const loadedScopeRef = useRef<string | null>(null);
  const pendingByScopeRef = useRef<Record<string, number>>({});
  const sessionsRef = useRef<LucidStabilizationLabSession[]>([]);
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
    sessionsRef.current = sessions;
  }, [entropy, now, sessions]);

  const scopeMatches = stateScope === userScope;
  const visibleSessions = useMemo(
    () => (scopeMatches && loadedScope === userScope ? cloneSessions(sessions) : []),
    [loadedScope, scopeMatches, sessions, userScope]
  );
  const currentSession = useMemo(
    () => (scopeMatches ? selectCurrentSession(visibleSessions) : null),
    [scopeMatches, visibleSessions]
  );
  const insights = useMemo(
    () => (scopeMatches ? projectLucidStabilizationLabInsights(visibleSessions) : EMPTY_INSIGHTS),
    [scopeMatches, visibleSessions]
  );

  const canApplyToScope = useCallback((scope: string, generation: number) => {
    return mountedRef.current && scopeRef.current === scope && loadGenerationRef.current === generation;
  }, []);

  const applySessions = useCallback(
    (
      scope: string,
      generation: number,
      next: readonly LucidStabilizationLabSession[],
      options?: { clearError?: boolean }
    ) => {
      if (!canApplyToScope(scope, generation)) return false;
      const cloned = cloneSessions(next);
      sessionsRef.current = cloned;
      setSessions(cloned);
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
        const loaded = await loadLucidStabilizationLabSessions(scope);
        applySessions(scope, generation, loaded);
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
    [applySessions, canApplyToScope]
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
    sessionsRef.current = [];
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

  const currentClock = useCallback((session?: LucidStabilizationLabSession | null) => {
    const now = readClock(nowRef.current);
    if (session && now < session.updatedAt) return session.updatedAt;
    return now;
  }, []);

  const nextSessionId = useCallback(() => {
    entropyCounterRef.current += 1;
    const seed = readEntropy(entropyRef.current, `lab${entropyCounterRef.current}`);
    return createLucidStabilizationLabSessionId(currentClock(), seed);
  }, [currentClock]);

  const runMutation = useCallback(
    async (
      apply: (current: LucidStabilizationLabSession[]) => LucidStabilizationLabSession[],
      skipWriteIf?: (current: LucidStabilizationLabSession[]) => boolean
    ) => {
      const scope = scopeRef.current;
      if (loadedScopeRef.current !== scope) return cloneSessions(sessionsRef.current);
      if (skipWriteIf?.(cloneSessions(sessionsRef.current))) {
        return cloneSessions(sessionsRef.current);
      }
      const generation = beginMutation(scope);
      try {
        const next = await updateLucidStabilizationLabSessions(scope, (current) => {
          const cloned = cloneSessions(current);
          if (skipWriteIf?.(cloned)) return cloned;
          return rankSessions(apply(cloned));
        });
        if (canApplyToScope(scope, generation)) {
          applySessions(scope, generation, next);
        }
        return cloneSessions(next);
      } catch (caught) {
        if (canApplyToScope(scope, generation)) {
          setError(toErrorReason(caught));
          setStateScope(scope);
        }
        if (!(caught instanceof LucidStabilizationLabStorageError)) {
          throw new LucidStabilizationLabStorageError(
            toErrorReason(caught),
            caught instanceof Error ? caught.message : String(caught)
          );
        }
        throw caught;
      } finally {
        finishMutation(scope);
      }
    },
    [applySessions, beginMutation, canApplyToScope, finishMutation]
  );

  const mutateCurrent = useCallback(
    async (
      transition: (session: LucidStabilizationLabSession, now: number) => LucidStabilizationLabSession
    ) => {
      const currentId = selectCurrentSession(sessionsRef.current)?.sessionId;
      if (!currentId) return;
      await runMutation((current) => {
        const latest = current.find((session) => session.sessionId === currentId);
        if (!latest) return current;
        const next = transition(latest, currentClock(latest));
        return [next, ...current.filter((session) => session.sessionId !== next.sessionId)];
      });
    },
    [currentClock, runMutation]
  );

  const startNew = useCallback(async () => {
    const scope = scopeRef.current;
    if (loadedScopeRef.current !== scope) return null;
    const next = await runMutation(
      (current) => {
        const resumable = selectCurrentSession(current);
        if (resumable) {
          if (resumable.status === 'paused' || resumable.status === 'interrupted') {
            const resumed = resumeLucidStabilizationLabSession(resumable, currentClock(resumable));
            return [resumed, ...current.filter((session) => session.sessionId !== resumed.sessionId)];
          }
          return current;
        }
        const idle = selectIdleSession(current);
        if (idle) {
          const started = startLucidStabilizationLabSession(idle, currentClock(idle));
          return [started, ...current.filter((session) => session.sessionId !== started.sessionId)];
        }
        const createdAt = currentClock();
        const created = startLucidStabilizationLabSession(
          createLucidStabilizationLabSession({
            now: createdAt,
            sessionId: nextSessionId(),
          }),
          createdAt
        );
        return [created, ...current];
      },
      (current) => selectCurrentSession(current)?.status === 'active'
    );
    return selectCurrentSession(next);
  }, [currentClock, nextSessionId, runMutation]);

  const advance = useCallback(async () => {
    await mutateCurrent(advanceLucidStabilizationLabSession);
  }, [mutateCurrent]);

  const repeat = useCallback(async () => {
    await mutateCurrent(repeatLucidStabilizationLabStep);
  }, [mutateCurrent]);

  const pause = useCallback(async () => {
    await mutateCurrent(pauseLucidStabilizationLabSession);
  }, [mutateCurrent]);

  const resume = useCallback(async () => {
    await mutateCurrent(resumeLucidStabilizationLabSession);
  }, [mutateCurrent]);

  const interrupt = useCallback(async () => {
    await mutateCurrent(interruptLucidStabilizationLabSession);
  }, [mutateCurrent]);

  const complete = useCallback(async () => {
    await mutateCurrent(completeLucidStabilizationLabSession);
  }, [mutateCurrent]);

  const clear = useCallback(async () => {
    const scope = scopeRef.current;
    if (loadedScopeRef.current !== scope) return;
    const generation = beginMutation(scope);
    try {
      await clearLucidStabilizationLabSessions(scope);
      applySessions(scope, generation, []);
    } catch (caught) {
      if (canApplyToScope(scope, generation)) {
        setError(toErrorReason(caught));
        setStateScope(scope);
      }
      throw caught instanceof LucidStabilizationLabStorageError
        ? caught
        : new LucidStabilizationLabStorageError(toErrorReason(caught));
    } finally {
      finishMutation(scope);
    }
  }, [applySessions, beginMutation, canApplyToScope, finishMutation]);

  return {
    sessions: scopeMatches ? visibleSessions : [],
    currentSession: scopeMatches ? currentSession : null,
    insights: scopeMatches ? insights : EMPTY_INSIGHTS,
    isLoading: scopeMatches ? isLoading : true,
    isMutating: scopeMatches ? (pendingByScope[userScope] ?? 0) > 0 : false,
    error: scopeMatches ? error : null,
    refresh,
    startNew,
    advance,
    repeat,
    pause,
    resume,
    interrupt,
    complete,
    clear,
  };
}
