import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getSavedTranscript, saveTranscript } from '@/services/storageService';

export const RECORDING_DRAFT_AUTOSAVE_DELAY_MS = 300;

export type UseRecordingDraftPersistenceOptions = {
  transcript: string;
  onRestore: (savedTranscript: string) => void;
};

export type UseRecordingDraftPersistenceResult = {
  isHydrated: boolean;
  noteInput: (value: string) => boolean;
  clearAfterSuccessfulSave: () => void;
  lastPersistedValue: string | null;
};

/**
 * Durable recording-draft persistence.
 *
 * Hydration must finish before any write so the initial empty editor cannot
 * erase a stored draft. `noteInput` refuses input until the restore callback
 * has run, then accepts edits and schedules autosave. A stored draft is always
 * restored; early calls must not mark the editor as user-edited.
 * Writes are serialized on a generation-tagged queue so a stale autosave
 * cannot finish after a successful journal save and resurrect text.
 * A pending debounce is flushed immediately on AppState background/inactive
 * and on unmount so a kill during the 300ms window cannot drop the draft.
 */
export function useRecordingDraftPersistence({
  transcript,
  onRestore,
}: UseRecordingDraftPersistenceOptions): UseRecordingDraftPersistenceResult {
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);
  const userEditedRef = useRef(false);
  const latestValueRef = useRef(transcript);
  const lastScheduledRef = useRef<string | null>(null);
  const [lastPersistedValue, setLastPersistedValue] = useState<string | null>(null);
  const generationRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeChainRef = useRef(Promise.resolve());
  const onRestoreRef = useRef(onRestore);

  const enqueueWrite = useCallback((value: string, generation: number) => {
    const run = async () => {
      if (generation !== generationRef.current) {
        return;
      }
      try {
        await saveTranscript(value);
        if (generation !== generationRef.current) {
          return;
        }
        setLastPersistedValue(value);
      } catch {
        // Storage write errors must not block capture or journal success.
      }
    };
    writeChainRef.current = writeChainRef.current.then(run, run);
  }, []);

  const scheduleAutosave = useCallback(() => {
    if (!hydratedRef.current) {
      return;
    }
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const pending = latestValueRef.current;
    if (pending === lastScheduledRef.current) {
      return;
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      if (!hydratedRef.current) {
        return;
      }
      const value = latestValueRef.current;
      if (value === lastScheduledRef.current) {
        return;
      }
      lastScheduledRef.current = value;
      enqueueWrite(value, generationRef.current);
    }, RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
  }, [enqueueWrite]);

  const flushPending = useCallback(() => {
    if (!hydratedRef.current) {
      return;
    }
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const value = latestValueRef.current;
    if (value === lastScheduledRef.current) {
      return;
    }
    lastScheduledRef.current = value;
    enqueueWrite(value, generationRef.current);
  }, [enqueueWrite]);

  const noteInput = useCallback((value: string) => {
    if (!hydratedRef.current) {
      return false;
    }
    userEditedRef.current = true;
    latestValueRef.current = value;
    scheduleAutosave();
    return true;
  }, [scheduleAutosave]);

  const clearAfterSuccessfulSave = useCallback(() => {
    if (!hydratedRef.current) {
      return;
    }
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    generationRef.current += 1;
    const generation = generationRef.current;
    latestValueRef.current = '';
    lastScheduledRef.current = '';
    enqueueWrite('', generation);
  }, [enqueueWrite]);

  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let saved = '';
      try {
        saved = await getSavedTranscript();
      } catch {
        saved = '';
      }
      if (cancelled) {
        return;
      }

      if (saved) {
        latestValueRef.current = saved;
        lastScheduledRef.current = saved;
        setLastPersistedValue(saved);
        onRestoreRef.current(saved);
      } else {
        lastScheduledRef.current = '';
        setLastPersistedValue('');
      }

      hydratedRef.current = true;
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [scheduleAutosave]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (transcript === lastScheduledRef.current) {
      return;
    }
    // Parent has not applied onRestore yet: keep the stored draft.
    if (!userEditedRef.current && transcript === '' && lastScheduledRef.current) {
      return;
    }
    latestValueRef.current = transcript;
    scheduleAutosave();
  }, [hydrated, scheduleAutosave, transcript]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        flushPending();
      }
    });

    return () => {
      subscription.remove();
      flushPending();
    };
  }, [flushPending]);

  return {
    isHydrated: hydrated,
    noteInput,
    clearAfterSuccessfulSave,
    lastPersistedValue,
  };
}
