import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  addDreamRecallUserSegment,
  appendNeutralRecallQuestion,
  completeDreamRecallAssistant,
  markDreamRecallSegmentPersisted,
  pauseDreamRecallAssistant,
  resumeDreamRecallAssistant,
  skipDreamRecallAssistant,
  startDreamRecallAssistant,
  type DreamRecallAssistantState,
} from '@/lib/dreamRecallAssistant';
import {
  DREAM_RECALL_MAX_QUESTIONS,
  getDreamRecallQuestion,
  type DreamRecallQuestion,
  type DreamRecallQuestionTranslator,
  type DreamRecallSequenceKind,
} from '@/lib/dreamRecallQuestions';
import {
  load as loadDreamRecallAssistantState,
  save as saveDreamRecallAssistantState,
} from '@/services/dreamRecallAssistantStorage';

export type UseDreamRecallAssistantParams = {
  dreamId: string;
  originalTranscript: string;
  originalPersistedSegmentId: string;
  t: DreamRecallQuestionTranslator;
};

export type UseDreamRecallAssistantResult = {
  loading: boolean;
  state: DreamRecallAssistantState | null;
  hasSession: boolean;
  currentQuestion: DreamRecallQuestion | null;
  isBusy: boolean;
  error: Error | null;
  start: () => Promise<void>;
  submitAnswer: (text: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  skip: () => Promise<void>;
  complete: () => Promise<void>;
};

const hasOpenQuestion = (state: DreamRecallAssistantState): boolean =>
  state.turns[state.turns.length - 1]?.role === 'question';

const openQuestionId = (state: DreamRecallAssistantState | null): string | null => {
  if (!state) return null;
  const last = state.turns[state.turns.length - 1];
  return last?.role === 'question' ? last.id : null;
};

const questionCount = (state: DreamRecallAssistantState): number =>
  state.turns.filter((turn) => turn.role === 'question').length;

const currentQuestionFrom = (state: DreamRecallAssistantState | null): DreamRecallQuestion | null => {
  if (!state || (state.status !== 'active' && state.status !== 'paused')) return null;
  const last = state.turns[state.turns.length - 1];
  if (!last || last.role !== 'question') return null;
  return { kind: last.kind as DreamRecallSequenceKind, text: last.text };
};

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error('Dream recall assistant failed.');

export function useDreamRecallAssistant({
  dreamId,
  originalTranscript,
  originalPersistedSegmentId,
  t,
}: UseDreamRecallAssistantParams): UseDreamRecallAssistantResult {
  const [loading, setLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [state, setState] = useState<DreamRecallAssistantState | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const stateRef = useRef<DreamRecallAssistantState | null>(null);
  const lastSavedRef = useRef<DreamRecallAssistantState | null>(null);
  const tRef = useRef(t);
  const inputRef = useRef({ dreamId, originalTranscript, originalPersistedSegmentId });
  const mountedRef = useRef(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const opChainRef = useRef(Promise.resolve());
  const busyCountRef = useRef(0);
  const hydrateGenerationRef = useRef(0);

  const publish = useCallback((next: DreamRecallAssistantState | null) => {
    stateRef.current = next;
    if (mountedRef.current) setState(next);
  }, []);

  const persist = useCallback(async (next: DreamRecallAssistantState): Promise<DreamRecallAssistantState> => {
    await saveDreamRecallAssistantState(next);
    lastSavedRef.current = next;
    stateRef.current = next;
    return next;
  }, []);

  const handleError = useCallback(
    (caught: unknown) => {
      if (!mountedRef.current) return;
      setError(toError(caught));
      publish(lastSavedRef.current);
    },
    [publish]
  );

  const setBusyCount = useCallback((delta: number) => {
    busyCountRef.current += delta;
    const nextBusy = busyCountRef.current > 0;
    if (mountedRef.current) setIsBusy(nextBusy);
  }, []);

  const enqueue = useCallback(
    (task: () => Promise<void>): Promise<void> => {
      const run = opChainRef.current.then(async () => {
        setBusyCount(1);
        try {
          await task();
        } catch (caught) {
          handleError(caught);
        } finally {
          setBusyCount(-1);
        }
      });
      opChainRef.current = run.then(
        () => undefined,
        () => undefined
      );
      return run;
    },
    [handleError, setBusyCount]
  );

  const advanceAfterPersisted = useCallback(
    async (
      current: DreamRecallAssistantState,
      translator: DreamRecallQuestionTranslator
    ): Promise<DreamRecallAssistantState> => {
      const asked = questionCount(current);
      if (asked >= DREAM_RECALL_MAX_QUESTIONS) {
        return persist(completeDreamRecallAssistant(current, Date.now()).state);
      }
      const question = getDreamRecallQuestion(asked, translator);
      return persist(
        appendNeutralRecallQuestion(
          current,
          { kind: question.kind, text: question.text },
          Date.now()
        ).state
      );
    },
    [persist]
  );

  const recoverActive = useCallback(
    async (
      current: DreamRecallAssistantState,
      translator: DreamRecallQuestionTranslator
    ): Promise<DreamRecallAssistantState> => {
      if (current.status !== 'active') return current;

      let next = current;
      if (next.pendingUserSegment && next.pendingUserSegment.persisted !== true) {
        next = await persist(markDreamRecallSegmentPersisted(next, Date.now()).state);
      }
      if (next.status !== 'active' || hasOpenQuestion(next)) return next;
      return advanceAfterPersisted(next, translator);
    },
    [advanceAfterPersisted, persist]
  );

  const runUserAction = useCallback(
    (task: () => Promise<void>): Promise<void> => {
      return enqueue(task);
    },
    [enqueue]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    inputRef.current = { dreamId, originalTranscript, originalPersistedSegmentId };
  }, [dreamId, originalTranscript, originalPersistedSegmentId]);

  useEffect(() => {
    const generation = ++hydrateGenerationRef.current;
    let cancelled = false;
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }
    lastSavedRef.current = null;
    publish(null);

    void enqueue(async () => {
      if (cancelled || hydrateGenerationRef.current !== generation) return;
      const loaded = await loadDreamRecallAssistantState(dreamId);
      if (cancelled || hydrateGenerationRef.current !== generation) return;
      lastSavedRef.current = loaded;
      stateRef.current = loaded;
      if (!loaded) {
        publish(null);
        return;
      }
      const recovered = await recoverActive(loaded, tRef.current);
      if (cancelled || hydrateGenerationRef.current !== generation) return;
      publish(recovered);
    }).finally(() => {
      if (!cancelled && mountedRef.current && hydrateGenerationRef.current === generation) {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [dreamId, enqueue, publish, recoverActive]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const previous = appStateRef.current;
      appStateRef.current = nextAppState;
      if (previous !== 'active' || !nextAppState.match(/inactive|background/)) return;

      void enqueue(async () => {
        const current = stateRef.current;
        if (!current || current.status !== 'active') return;
        const paused = pauseDreamRecallAssistant(current, Date.now());
        await persist(paused.state);
        publish(paused.state);
        if (mountedRef.current) setError(null);
      });
    });

    return () => {
      subscription.remove();
    };
  }, [enqueue, persist, publish]);

  const start = useCallback((): Promise<void> => {
    return runUserAction(async () => {
      const existing = stateRef.current;
      if (existing?.status === 'active') {
        const recovered = await recoverActive(existing, tRef.current);
        publish(recovered);
        if (mountedRef.current) setError(null);
        return;
      }
      if (existing?.status === 'paused') return;

      const input = inputRef.current;
      const started = startDreamRecallAssistant({
        dreamId: input.dreamId,
        originalTranscript: input.originalTranscript,
        originalPersistedSegmentId: input.originalPersistedSegmentId,
        now: Date.now(),
        maxQuestions: DREAM_RECALL_MAX_QUESTIONS,
      });
      await persist(started.state);
      const withQuestion = await recoverActive(started.state, tRef.current);
      publish(withQuestion);
      if (mountedRef.current) setError(null);
    });
  }, [persist, publish, recoverActive, runUserAction]);

  const submitAnswer = useCallback(
    (text: string): Promise<void> => {
      const questionId = openQuestionId(stateRef.current);
      return runUserAction(async () => {
        const current = stateRef.current;
        if (
          !current ||
          current.status !== 'active' ||
          questionId == null ||
          openQuestionId(current) !== questionId
        ) {
          return;
        }

        const added = addDreamRecallUserSegment(current, text, Date.now());
        await persist(added.state);

        const persisted = markDreamRecallSegmentPersisted(added.state, Date.now());
        await persist(persisted.state);

        const advanced = await advanceAfterPersisted(persisted.state, tRef.current);
        publish(advanced);
        if (mountedRef.current) setError(null);
      });
    },
    [advanceAfterPersisted, persist, publish, runUserAction]
  );

  const pause = useCallback((): Promise<void> => {
    return runUserAction(async () => {
      const current = stateRef.current;
      if (!current || current.status !== 'active') return;
      const paused = pauseDreamRecallAssistant(current, Date.now());
      await persist(paused.state);
      publish(paused.state);
      if (mountedRef.current) setError(null);
    });
  }, [persist, publish, runUserAction]);

  const resume = useCallback((): Promise<void> => {
    return runUserAction(async () => {
      const current = stateRef.current;
      if (!current || current.status !== 'paused') return;
      const resumed = resumeDreamRecallAssistant(current, Date.now());
      await persist(resumed.state);
      const recovered = await recoverActive(resumed.state, tRef.current);
      publish(recovered);
      if (mountedRef.current) setError(null);
    });
  }, [persist, publish, recoverActive, runUserAction]);

  const skip = useCallback((): Promise<void> => {
    return runUserAction(async () => {
      const current = stateRef.current;
      if (!current) return;
      const skipped = skipDreamRecallAssistant(current, Date.now());
      await persist(skipped.state);
      publish(skipped.state);
      if (mountedRef.current) setError(null);
    });
  }, [persist, publish, runUserAction]);

  const complete = useCallback((): Promise<void> => {
    return runUserAction(async () => {
      const current = stateRef.current;
      if (!current) return;
      const completed = completeDreamRecallAssistant(current, Date.now());
      await persist(completed.state);
      publish(completed.state);
      if (mountedRef.current) setError(null);
    });
  }, [persist, publish, runUserAction]);

  const currentQuestion = useMemo(() => currentQuestionFrom(state), [state]);

  return {
    loading,
    state,
    hasSession: state != null,
    currentQuestion,
    isBusy,
    error,
    start,
    submitAnswer,
    pause,
    resume,
    skip,
    complete,
  };
}
