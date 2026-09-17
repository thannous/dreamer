import { useCallback, useEffect, useRef, useState } from 'react';

import {
  LucidMorningVoiceNoteError,
  classifyLucidMorningVoiceFailure,
  type LucidMorningVoiceErrorReason,
  type LucidMorningVoiceNote,
} from '@/lib/lucid/morningVoiceNote';
import {
  deleteLucidMorningVoiceNote,
  linkStoredLucidMorningVoiceNoteToExperiment,
  loadLucidMorningVoiceNotes,
  renameStoredLucidMorningVoiceNote,
  updateStoredLucidMorningVoiceNoteTranscript,
} from '@/services/lucidMorningVoiceNoteStorage';

export type UseLucidMorningVoiceNotesOptions = {
  userScope: string;
  onLinkedNoteDeleted?: (experimentId: string) => Promise<void>;
};

export type UseLucidMorningVoiceNotesResult = {
  notes: LucidMorningVoiceNote[];
  isLoading: boolean;
  isMutating: boolean;
  error: LucidMorningVoiceErrorReason | null;
  refresh: () => Promise<void>;
  getByExperimentId: (experimentId: string) => LucidMorningVoiceNote | null;
  renameNote: (noteId: string, title: string) => Promise<LucidMorningVoiceNote>;
  updateTranscript: (
    noteId: string,
    transcript: string | null
  ) => Promise<LucidMorningVoiceNote>;
  linkToExperiment: (
    noteId: string,
    experimentId: string
  ) => Promise<LucidMorningVoiceNote>;
  deleteNote: (noteId: string) => Promise<void>;
};

type NoteMutationKind = 'update' | 'delete';

function toTypedError(error: unknown): LucidMorningVoiceNoteError {
  if (error instanceof LucidMorningVoiceNoteError) return error;
  return new LucidMorningVoiceNoteError(classifyLucidMorningVoiceFailure(error));
}

function toErrorReason(error: unknown): LucidMorningVoiceErrorReason {
  return toTypedError(error).reason;
}

function sortNotes(notes: LucidMorningVoiceNote[]): LucidMorningVoiceNote[] {
  return [...notes].sort((left, right) => {
    if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
    return left.id.localeCompare(right.id);
  });
}

export function useLucidMorningVoiceNotes({
  userScope,
  onLinkedNoteDeleted,
}: UseLucidMorningVoiceNotesOptions): UseLucidMorningVoiceNotesResult {
  const [stateScope, setStateScope] = useState(userScope);
  const [notes, setNotes] = useState<LucidMorningVoiceNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingByScope, setPendingByScope] = useState<Record<string, number>>({});
  const [error, setError] = useState<LucidMorningVoiceErrorReason | null>(null);

  const notesRef = useRef<LucidMorningVoiceNote[]>([]);
  const notesScopeRef = useRef<string | null>(null);
  const scopeRef = useRef(userScope);
  const mountedRef = useRef(true);
  const loadGenerationRef = useRef(0);
  const mutationGenerationRef = useRef(0);
  const pendingByScopeRef = useRef<Record<string, number>>({});
  const noteSeqRef = useRef(new Map<string, number>());
  const tombstoneSeqRef = useRef(new Map<string, number>());
  const loadScopeRef = useRef<(scope: string, options?: { markLoading?: boolean }) => Promise<void>>(
    async () => undefined
  );
  const deferredReloadByScopeRef = useRef(new Set<string>());

  /* eslint-disable react-hooks/refs -- freeze ops to the new scope on the first mismatched render */
  if (scopeRef.current !== userScope) {
    scopeRef.current = userScope;
  }
  /* eslint-enable react-hooks/refs */

  const scopeMatches = stateScope === userScope;
  const visibleNotes = scopeMatches ? notes : [];
  const visibleError = scopeMatches ? error : null;
  const visibleLoading = scopeMatches ? isLoading : true;
  const visibleMutating = scopeMatches ? (pendingByScope[userScope] ?? 0) > 0 : false;

  const setNotesSafe = useCallback((next: LucidMorningVoiceNote[]) => {
    notesRef.current = next;
    if (mountedRef.current) setNotes(next);
  }, []);

  const noteKey = useCallback((scope: string, noteId: string) => `${scope}:${noteId}`, []);

  const canApplyToScope = useCallback((scope: string) => {
    return mountedRef.current && scopeRef.current === scope;
  }, []);

  const canApplyLoad = useCallback(
    (scope: string, loadGeneration: number, mutationGeneration: number) => {
      return (
        canApplyToScope(scope) &&
        loadGenerationRef.current === loadGeneration &&
        mutationGenerationRef.current === mutationGeneration &&
        (pendingByScopeRef.current[scope] ?? 0) === 0
      );
    },
    [canApplyToScope]
  );

  const requestDeferredReload = useCallback((scope: string) => {
    deferredReloadByScopeRef.current.add(scope);
  }, []);

  const handleInvalidatedLoad = useCallback(
    async (scope: string, loadGeneration: number, mutationGeneration: number) => {
      if (!canApplyToScope(scope) || loadGenerationRef.current !== loadGeneration) {
        return;
      }
      const pending = pendingByScopeRef.current[scope] ?? 0;
      if (pending > 0) {
        requestDeferredReload(scope);
        return;
      }
      if (mutationGenerationRef.current !== mutationGeneration) {
        await loadScopeRef.current(scope);
      }
    },
    [canApplyToScope, requestDeferredReload]
  );

  const applyLoadedNotes = useCallback(
    (scope: string, loaded: LucidMorningVoiceNote[]) => {
      if (!canApplyToScope(scope)) return;
      notesScopeRef.current = scope;
      setNotesSafe(sortNotes(loaded));
      setError(null);
      setIsLoading(false);
      setStateScope(scope);
    },
    [canApplyToScope, setNotesSafe]
  );

  const loadScope = useCallback(
    async (scope: string, options?: { markLoading?: boolean }) => {
      if (!canApplyToScope(scope)) return;
      const loadGeneration = loadGenerationRef.current + 1;
      loadGenerationRef.current = loadGeneration;
      const mutationGeneration = mutationGenerationRef.current;
      if (options?.markLoading && canApplyToScope(scope)) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const loaded = await loadLucidMorningVoiceNotes(scope);
        if (!canApplyLoad(scope, loadGeneration, mutationGeneration)) {
          await handleInvalidatedLoad(scope, loadGeneration, mutationGeneration);
          return;
        }
        applyLoadedNotes(scope, loaded);
      } catch (caught) {
        if (!canApplyLoad(scope, loadGeneration, mutationGeneration)) {
          await handleInvalidatedLoad(scope, loadGeneration, mutationGeneration);
          return;
        }
        setError(toErrorReason(caught));
        setIsLoading(false);
        if (notesScopeRef.current !== scope) {
          notesScopeRef.current = scope;
          setNotesSafe([]);
        }
        setStateScope(scope);
      }
    },
    [applyLoadedNotes, canApplyLoad, canApplyToScope, handleInvalidatedLoad, setNotesSafe]
  );

  const refresh = useCallback(async () => {
    await loadScope(scopeRef.current, { markLoading: true });
  }, [loadScope]);

  useEffect(() => {
    loadScopeRef.current = loadScope;
  }, [loadScope]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    scopeRef.current = userScope;
    loadGenerationRef.current += 1;
    mutationGenerationRef.current += 1;
    notesScopeRef.current = userScope;
    setNotesSafe([]);
    deferredReloadByScopeRef.current.delete(userScope);
    /* eslint-disable react-hooks/set-state-in-effect -- kick off the local load for the current scope */
    void loadScope(userScope);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loadScope, setNotesSafe, userScope]);

  const beginMutation = useCallback((noteId: string, kind: NoteMutationKind) => {
    const scope = scopeRef.current;
    const key = noteKey(scope, noteId);
    const seq = (noteSeqRef.current.get(key) ?? 0) + 1;
    noteSeqRef.current.set(key, seq);
    mutationGenerationRef.current += 1;
    if (kind === 'delete') {
      tombstoneSeqRef.current.set(key, seq);
    }
    const nextCount = (pendingByScopeRef.current[scope] ?? 0) + 1;
    pendingByScopeRef.current = { ...pendingByScopeRef.current, [scope]: nextCount };
    if (mountedRef.current) {
      setPendingByScope(pendingByScopeRef.current);
    }
    return { scope, seq, mutationGeneration: mutationGenerationRef.current };
  }, [noteKey]);

  const finishMutation = useCallback((scope: string) => {
    const nextCount = Math.max(0, (pendingByScopeRef.current[scope] ?? 0) - 1);
    const nextPending = { ...pendingByScopeRef.current };
    if (nextCount === 0) {
      delete nextPending[scope];
    } else {
      nextPending[scope] = nextCount;
    }
    pendingByScopeRef.current = nextPending;
    if (mountedRef.current) {
      setPendingByScope(nextPending);
    }
    const shouldReloadNow =
      nextCount === 0 &&
      deferredReloadByScopeRef.current.has(scope) &&
      canApplyToScope(scope);
    if (shouldReloadNow) {
      deferredReloadByScopeRef.current.delete(scope);
    }
    return { remaining: nextCount, shouldReloadNow };
  }, [canApplyToScope]);

  const canApplyMutation = useCallback(
    (noteId: string, seq: number, kind: NoteMutationKind, scope: string) => {
      if (!canApplyToScope(scope)) return false;
      const key = noteKey(scope, noteId);
      const tombstone = tombstoneSeqRef.current.get(key);
      if (kind === 'delete') return tombstone === seq;
      if (tombstone != null) return false;
      return noteSeqRef.current.get(key) === seq;
    },
    [canApplyToScope, noteKey]
  );

  const applyUpdatedNote = useCallback(
    (next: LucidMorningVoiceNote, scope: string) => {
      if (next.userScope !== scope || !canApplyToScope(scope)) return;
      const current =
        notesScopeRef.current === scope
          ? notesRef.current.filter((note) => note.id !== next.id)
          : [];
      notesScopeRef.current = scope;
      setNotesSafe(sortNotes([...current, next]));
      setStateScope(scope);
    },
    [canApplyToScope, setNotesSafe]
  );

  const runUpdate = useCallback(
    async (
      noteId: string,
      work: (scope: string) => Promise<LucidMorningVoiceNote>
    ) => {
      const { scope, seq } = beginMutation(noteId, 'update');
      try {
        const next = await work(scope);
        if (canApplyMutation(noteId, seq, 'update', scope)) {
          applyUpdatedNote(next, scope);
          setError(null);
        }
        return next;
      } catch (caught) {
        const typed = toTypedError(caught);
        if (canApplyMutation(noteId, seq, 'update', scope)) {
          setError(typed.reason);
        }
        throw typed;
      } finally {
        const { remaining, shouldReloadNow } = finishMutation(scope);
        if (shouldReloadNow) {
          void loadScopeRef.current(scope);
        } else if (remaining > 0) {
          requestDeferredReload(scope);
        }
      }
    },
    [applyUpdatedNote, beginMutation, canApplyMutation, finishMutation, requestDeferredReload]
  );

  const renameNote = useCallback(
    (noteId: string, title: string) =>
      runUpdate(noteId, (scope) => renameStoredLucidMorningVoiceNote(scope, noteId, title)),
    [runUpdate]
  );

  const updateTranscript = useCallback(
    (noteId: string, transcript: string | null) =>
      runUpdate(noteId, (scope) =>
        updateStoredLucidMorningVoiceNoteTranscript(scope, noteId, transcript)
      ),
    [runUpdate]
  );

  const linkToExperiment = useCallback(
    (noteId: string, experimentId: string) =>
      runUpdate(noteId, (scope) =>
        linkStoredLucidMorningVoiceNoteToExperiment(scope, noteId, experimentId)
      ),
    [runUpdate]
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      const { scope, seq } = beginMutation(noteId, 'delete');
      let finished = false;
      try {
        const deleted = await deleteLucidMorningVoiceNote(scope, noteId);
        if (deleted?.experimentId) {
          await onLinkedNoteDeleted?.(deleted.experimentId);
        }
        if (canApplyMutation(noteId, seq, 'delete', scope)) {
          const current =
            notesScopeRef.current === scope
              ? notesRef.current.filter((note) => note.id !== noteId)
              : [];
          notesScopeRef.current = scope;
          setNotesSafe(current);
          setError(null);
          setStateScope(scope);
        }
      } catch (caught) {
        const typed = toTypedError(caught);
        const key = noteKey(scope, noteId);
        if (tombstoneSeqRef.current.get(key) === seq) {
          tombstoneSeqRef.current.delete(key);
        }
        if (canApplyToScope(scope) && noteSeqRef.current.get(key) === seq) {
          const { remaining } = finishMutation(scope);
          finished = true;
          if (remaining > 0) {
            requestDeferredReload(scope);
          } else {
            await loadScopeRef.current(scope);
          }
          if (canApplyToScope(scope)) {
            setError(typed.reason);
          }
        }
        throw typed;
      } finally {
        if (!finished) {
          const { remaining, shouldReloadNow } = finishMutation(scope);
          if (shouldReloadNow) {
            void loadScopeRef.current(scope);
          } else if (remaining > 0) {
            requestDeferredReload(scope);
          }
        }
      }
    },
    [
      beginMutation,
      canApplyMutation,
      canApplyToScope,
      finishMutation,
      noteKey,
      onLinkedNoteDeleted,
      requestDeferredReload,
      setNotesSafe,
    ]
  );

  const getByExperimentId = useCallback(
    (experimentId: string) => {
      if (stateScope !== userScope) return null;
      return notesRef.current.find((note) => note.experimentId === experimentId) ?? null;
    },
    [stateScope, userScope]
  );

  return {
    notes: visibleNotes,
    isLoading: visibleLoading,
    isMutating: visibleMutating,
    error: visibleError,
    refresh,
    getByExperimentId,
    renameNote,
    updateTranscript,
    linkToExperiment,
    deleteNote,
  };
}
