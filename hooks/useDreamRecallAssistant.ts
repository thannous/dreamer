import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  updateDreamRecallAnswerDraft,
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
  hydrationStatus: 'loading' | 'error' | 'ready';
  retryHydration: () => Promise<void>;
  state: DreamRecallAssistantState | null;
  hasSession: boolean;
  currentQuestion: DreamRecallQuestion | null;
  draftAnswer: string;
  updateDraftAnswer: (text: string) => void;
  isBusy: boolean;
  error: Error | null;
  start: () => Promise<void>;
  submitAnswer: (text: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  skip: () => Promise<void>;
  complete: () => Promise<void>;
};

type SessionContext = {
  dreamId: string;
  state: DreamRecallAssistantState | null;
  hydration: UseDreamRecallAssistantResult['hydrationStatus'];
  readGeneration: number;
  busy: number;
  settlingQuestion: string | null;
  error: Error | null;
};

// A remount reads after the previous instance's queued writes. Other dreams
// remain independent, and rejections never poison a dream's queue.
const dreamQueues = new Map<string, Promise<void>>();
function queueForDream(dreamId: string, task: () => Promise<void>): Promise<void> {
  const run = (dreamQueues.get(dreamId) ?? Promise.resolve()).then(task);
  const settled = run.catch(() => undefined);
  dreamQueues.set(dreamId, settled);
  void settled.then(() => {
    if (dreamQueues.get(dreamId) === settled) dreamQueues.delete(dreamId);
  });
  return run;
}

const newContext = (dreamId: string): SessionContext => ({
  dreamId, state: null, hydration: 'loading', readGeneration: 0,
  busy: 0, settlingQuestion: null, error: null,
});

// Queue ownership outlives a mounted view; React renders immutable snapshots.
function createSession(dreamId: string) {
  const context = newContext(dreamId);
  return { getCurrent: () => context };
}

const openQuestion = (state: DreamRecallAssistantState | null) => {
  const last = state?.turns[state.turns.length - 1];
  return last?.role === 'question' ? last : null;
};

const draftAnswerFrom = (state: DreamRecallAssistantState | null): string => {
  if (!state || !openQuestion(state) || (state.status !== 'active' && state.status !== 'paused')) return '';
  // Legacy v1 snapshots stored submitted-but-unmarked text only in pending.
  // An explicitly edited empty draft takes precedence over that recovery text.
  return state.answerDraft?.text ??
    (state.pendingUserSegment?.persisted === false ? state.pendingUserSegment.text : '');
};

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error('Dream recall assistant failed.');

export function useDreamRecallAssistant({
  dreamId, originalTranscript, originalPersistedSegmentId, t,
}: UseDreamRecallAssistantParams): UseDreamRecallAssistantResult {
  const session = useMemo(() => createSession(dreamId), [dreamId]);
  const activeSessionRef = useRef(session);
  const [snapshot, setSnapshot] = useState(() => ({ owner: session, ...newContext(dreamId) }));
  const mountedRef = useRef(true);
  const tRef = useRef(t);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const publish = useCallback((owner: SessionContext) => {
    if (mountedRef.current && activeSessionRef.current.getCurrent() === owner) {
      setSnapshot({ owner: activeSessionRef.current, ...owner });
    }
  }, []);

  const enqueue = useCallback((
    owner: SessionContext, task: () => Promise<void>, busy = true
  ): Promise<void> => {
    if (busy) owner.busy += 1;
    publish(owner);
    return queueForDream(owner.dreamId, async () => {
      try {
        await task();
        owner.error = null;
      } catch (caught) {
        // Keep optimistic input and the last durable progress on failure.
        owner.error = toError(caught);
      } finally {
        if (busy) owner.busy -= 1;
        publish(owner);
      }
    });
  }, [publish]);

  const persist = useCallback(async (
    owner: SessionContext, next: DreamRecallAssistantState
  ): Promise<DreamRecallAssistantState> => {
    const before = owner.state;
    await saveDreamRecallAssistantState(next);
    const latest = owner.state;
    const question = openQuestion(next);
    // A partial transcript may arrive while a background pause is saving.
    // Preserve the edited draft and its matching pending segment together.
    // Marking an answer or ending the session owns the durable progression.
    const hasNewerEdit = latest !== before && latest?.answerDraft != null &&
      latest.answerDraft !== before?.answerDraft && question != null &&
      (next.status === 'active' || next.status === 'paused') &&
      latest.dreamId === next.dreamId && latest.startedAt === next.startedAt &&
      openQuestion(latest)?.id === question.id && latest.answerDraft.questionId === question.id;
    owner.state = hasNewerEdit
      ? {
          ...next,
          answerDraft: latest.answerDraft,
          pendingUserSegment: latest.pendingUserSegment,
          updatedAt: Math.max(next.updatedAt, latest.updatedAt),
        }
      : next;
    return owner.state;
  }, []);

  const advance = useCallback(async (owner: SessionContext): Promise<void> => {
    const current = owner.state!;
    const asked = current.turns.filter((turn) => turn.role === 'question').length;
    if (asked >= DREAM_RECALL_MAX_QUESTIONS) {
      await persist(owner, completeDreamRecallAssistant(current, Date.now()).state);
      return;
    }
    const question = getDreamRecallQuestion(asked, tRef.current);
    await persist(owner, appendNeutralRecallQuestion(current, question, Date.now()).state);
  }, [persist]);

  const recover = useCallback(async (
    owner: SessionContext, isCurrent: () => boolean = () => true
  ): Promise<void> => {
    if (!isCurrent()) return;
    let current = owner.state;
    if (current?.status !== 'active') return;
    if (current.pendingUserSegment?.persisted === false) {
      current = await persist(owner, markDreamRecallSegmentPersisted(current, Date.now()).state);
    }
    if (isCurrent() && !openQuestion(current)) await advance(owner);
  }, [advance, persist]);

  const hydrate = useCallback((): Promise<void> => {
    const context = session.getCurrent();
    const generation = ++context.readGeneration;
    context.hydration = 'loading';
    context.error = null;
    const isCurrentRead = () => generation === context.readGeneration &&
      activeSessionRef.current === session && mountedRef.current;
    return enqueue(context, async () => {
      if (!isCurrentRead()) return;
      try {
        const loaded = await loadDreamRecallAssistantState(context.dreamId);
        if (!isCurrentRead()) return;
        context.state = loaded;
        context.hydration = 'ready';
      } catch (caught) {
        if (generation === context.readGeneration) context.hydration = 'error';
        throw caught;
      }
      // Recovery write errors retain the successfully restored state.
      await recover(context, isCurrentRead);
    }, false);
  }, [session, enqueue, recover]);

  const retryHydration = useCallback(() => {
    const context = session.getCurrent();
    if (context.hydration !== 'error') return Promise.resolve();
    return hydrate();
  }, [session, hydrate]);

  const ready = useCallback(() =>
    session.getCurrent().hydration === 'ready' && activeSessionRef.current === session && mountedRef.current,
  [session]);

  const updateDraftAnswer = useCallback((text: string) => {
    if (!ready()) return;
    const context = session.getCurrent();
    const current = context.state;
    const question = openQuestion(current);
    if (!current || !question || context.settlingQuestion === question.id ||
      (current.status !== 'active' && current.status !== 'paused')) return;
    context.state = updateDreamRecallAnswerDraft(current, question.id, text, Date.now());
    publish(context);
    const sessionStartedAt = current.startedAt;
    void enqueue(context, async () => {
      const latest = context.state;
      if (!latest || latest.startedAt !== sessionStartedAt || openQuestion(latest)?.id !== question.id ||
        (latest.status !== 'active' && latest.status !== 'paused')) return;
      await persist(context, latest);
    }, false);
  }, [session, enqueue, persist, publish, ready]);

  const start = useCallback((): Promise<void> => {
    if (!ready()) return Promise.resolve();
    const context = session.getCurrent();
    return enqueue(context, async () => {
      if (context.state?.status === 'paused') return;
      if (context.state?.status !== 'active') {
        await persist(context, startDreamRecallAssistant({
          dreamId, originalTranscript, originalPersistedSegmentId,
          now: Date.now(), maxQuestions: DREAM_RECALL_MAX_QUESTIONS,
        }).state);
      }
      await recover(context);
    });
  }, [session, dreamId, enqueue, originalPersistedSegmentId, originalTranscript, persist, ready, recover]);

  const persistAnswer = useCallback(async (owner: SessionContext, text: string, terminal: boolean) => {
    let current = owner.state!;
    if (current.status === 'paused') current = resumeDreamRecallAssistant(current, Date.now()).state;
    const added = addDreamRecallUserSegment(current, text, Date.now()).state;
    // A crash between terminal writes restores a paused answer, without Q+1.
    const pending = terminal ? pauseDreamRecallAssistant(added, Date.now()).state : added;
    await persist(owner, pending);
    const marked = markDreamRecallSegmentPersisted(added, Date.now()).state;
    await persist(owner, terminal ? pauseDreamRecallAssistant(marked, Date.now()).state : marked);
  }, [persist]);

  const submitAnswer = useCallback((text: string): Promise<void> => {
    const context = session.getCurrent();
    if (!ready() || context.state?.status !== 'active') return Promise.resolve();
    const question = openQuestion(context.state);
    if (!question || context.settlingQuestion) return Promise.resolve();
    // Direct callers also retain recoverable input if the first write fails.
    context.state = updateDreamRecallAnswerDraft(context.state, question.id, text, Date.now());
    context.settlingQuestion = question.id;
    return enqueue(context, async () => {
      try {
        if (openQuestion(context.state)?.id !== question.id) return;
        await persistAnswer(context, text, false);
        await advance(context);
      } finally {
        context.settlingQuestion = null;
      }
    });
  }, [advance, session, enqueue, persistAnswer, ready]);

  const pause = useCallback((): Promise<void> => {
    if (!ready()) return Promise.resolve();
    const context = session.getCurrent();
    return enqueue(context, async () => {
      if (context.state?.status !== 'active') return;
      await persist(context, pauseDreamRecallAssistant(context.state, Date.now()).state);
    });
  }, [session, enqueue, persist, ready]);

  const resume = useCallback((): Promise<void> => {
    if (!ready()) return Promise.resolve();
    const context = session.getCurrent();
    return enqueue(context, async () => {
      if (context.state?.status !== 'paused') return;
      await persist(context, resumeDreamRecallAssistant(context.state, Date.now()).state);
      await recover(context);
    });
  }, [session, enqueue, persist, ready, recover]);

  const finish = useCallback((action: 'skip' | 'complete'): Promise<void> => {
    const context = session.getCurrent();
    if (!ready() || !context.state || context.settlingQuestion ||
      (context.state.status !== 'active' && context.state.status !== 'paused')) return Promise.resolve();
    context.settlingQuestion = openQuestion(context.state)?.id ?? null;
    return enqueue(context, async () => {
      try {
        const current = context.state!;
        const text = draftAnswerFrom(current);
        if (openQuestion(current) && text.trim()) await persistAnswer(context, text, true);
        const terminal = action === 'skip' ? skipDreamRecallAssistant : completeDreamRecallAssistant;
        await persist(context, terminal(context.state!, Date.now()).state);
      } finally {
        context.settlingQuestion = null;
      }
    });
  }, [session, enqueue, persist, persistAnswer, ready]);

  const skip = useCallback(() => finish('skip'), [finish]);
  const complete = useCallback(() => finish('complete'), [finish]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useLayoutEffect(() => {
    activeSessionRef.current = session;
    tRef.current = t;
  }, [session, t]);

  useEffect(() => { void hydrate(); }, [hydrate]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      const previous = appStateRef.current;
      appStateRef.current = next;
      if (previous === 'active' && /inactive|background/.test(next)) void pause();
    });
    return () => subscription.remove();
  }, [pause]);

  const visible = snapshot.owner === session ? snapshot : newContext(dreamId);
  const state = visible.state;
  const question = openQuestion(state);
  return {
    loading: visible.hydration === 'loading',
    hydrationStatus: visible.hydration,
    retryHydration,
    state,
    hasSession: state != null,
    currentQuestion: question && (state?.status === 'active' || state?.status === 'paused')
      ? { kind: question.kind as DreamRecallSequenceKind, text: question.text } : null,
    draftAnswer: draftAnswerFrom(state),
    updateDraftAnswer,
    isBusy: visible.busy > 0,
    error: visible.error,
    start, submitAnswer, pause, resume, skip, complete,
  };
}
