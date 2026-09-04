/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppState, type AppStateStatus } from 'react-native';

import {
  addDreamRecallUserSegment,
  appendNeutralRecallQuestion,
  completeDreamRecallAssistant,
  markDreamRecallSegmentPersisted,
  pauseDreamRecallAssistant,
  skipDreamRecallAssistant,
  startDreamRecallAssistant,
  type DreamRecallAssistantState,
} from '@/lib/dreamRecallAssistant';
import {
  DREAM_RECALL_MAX_QUESTIONS,
  DREAM_RECALL_QUESTION_SEQUENCE,
  getDreamRecallQuestion,
} from '@/lib/dreamRecallQuestions';
import { useDreamRecallAssistant } from '../useDreamRecallAssistant';

const NOW = 1_700_000_000_000;
const DREAM_ID = 'dream-42';
const ORIGINAL = 'I flew over a quiet city with a blue door.';
const ORIGINAL_SEGMENT_ID = 'persisted-original-42';

const QUESTIONS: Record<string, string> = {
  'dream_recall.question.what_else': 'What else do you remember?',
  'dream_recall.question.where': 'Where did this take place?',
  'dream_recall.question.who_else': 'Who else was there?',
  'dream_recall.question.what_seen': 'What did you see?',
  'dream_recall.question.what_next': 'What happened next?',
};

const translate = (key: string): string => QUESTIONS[key] ?? '';

const mockLoad = jest.fn(
  async (_dreamId: string): Promise<DreamRecallAssistantState | null> => null
);
const mockSave = jest.fn(async (_state: DreamRecallAssistantState): Promise<void> => undefined);

jest.mock('@/services/dreamRecallAssistantStorage', () => ({
  load: (dreamId: string) => mockLoad(dreamId),
  save: (state: DreamRecallAssistantState) => mockSave(state),
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

function kernelStart(now = NOW): DreamRecallAssistantState {
  return startDreamRecallAssistant({
    dreamId: DREAM_ID,
    originalTranscript: ORIGINAL,
    originalPersistedSegmentId: ORIGINAL_SEGMENT_ID,
    now,
    maxQuestions: DREAM_RECALL_MAX_QUESTIONS,
  }).state;
}

function appendQuestion(
  state: DreamRecallAssistantState,
  index: number,
  now: number
): DreamRecallAssistantState {
  const question = getDreamRecallQuestion(index, translate);
  return appendNeutralRecallQuestion(
    state,
    { kind: question.kind, text: question.text },
    now
  ).state;
}

function answerQuestion(
  state: DreamRecallAssistantState,
  text: string,
  now: number,
  persistSegment: boolean
): DreamRecallAssistantState {
  const added = addDreamRecallUserSegment(state, text, now).state;
  if (!persistSegment) return added;
  return markDreamRecallSegmentPersisted(added, now + 1).state;
}

function activeEmpty(): DreamRecallAssistantState {
  return kernelStart();
}

function activeOpenQuestion(): DreamRecallAssistantState {
  return appendQuestion(kernelStart(), 0, NOW + 1);
}

function pendingUnpersisted(): DreamRecallAssistantState {
  return answerQuestion(activeOpenQuestion(), 'Rain on the glass.', NOW + 2, false);
}

function pendingPersistedNoOpenQuestion(): DreamRecallAssistantState {
  return answerQuestion(activeOpenQuestion(), 'Rain on the glass.', NOW + 2, true);
}

function pausedUnchanged(): DreamRecallAssistantState {
  return pauseDreamRecallAssistant(activeOpenQuestion(), NOW + 10).state;
}

function completedUnchanged(): DreamRecallAssistantState {
  return completeDreamRecallAssistant(activeOpenQuestion(), NOW + 20).state;
}

function skippedUnchanged(): DreamRecallAssistantState {
  return skipDreamRecallAssistant(activeOpenQuestion(), NOW + 21).state;
}

function fiveAnswersPendingPersisted(): DreamRecallAssistantState {
  let state = kernelStart();
  for (let index = 0; index < DREAM_RECALL_MAX_QUESTIONS; index += 1) {
    state = appendQuestion(state, index, NOW + index * 10);
    state = answerQuestion(
      state,
      `Fragment ${index + 1} on the quiet street.`,
      NOW + index * 10 + 1,
      true
    );
  }
  return state;
}

function savedStates(): DreamRecallAssistantState[] {
  return mockSave.mock.calls.map(
    (call: [DreamRecallAssistantState, ...unknown[]]) => call[0]
  );
}

function questionTurns(state: DreamRecallAssistantState | null) {
  return state?.turns.filter((turn) => turn.role === 'question') ?? [];
}

function answerTurns(state: DreamRecallAssistantState | null) {
  return state?.turns.filter((turn) => turn.role === 'answer') ?? [];
}

function expectTranscriptOnlyOnState(state: DreamRecallAssistantState): void {
  expect(state.originalTranscript).toBe(ORIGINAL);
  const { originalTranscript: _originalTranscript, ...rest } = state;
  expect(JSON.stringify(rest)).not.toContain(ORIGINAL);
  expect(JSON.stringify(state.turns)).not.toContain(ORIGINAL);
  if (state.pendingUserSegment) {
    expect(state.pendingUserSegment.text).not.toContain(ORIGINAL);
  }
}

function defaultParams() {
  return {
    dreamId: DREAM_ID,
    originalTranscript: ORIGINAL,
    originalPersistedSegmentId: ORIGINAL_SEGMENT_ID,
    t: translate,
  };
}

async function renderAssistant(params: Partial<ReturnType<typeof defaultParams>> = {}) {
  const view = renderHook(() => useDreamRecallAssistant({ ...defaultParams(), ...params }));
  await waitFor(() => {
    expect(view.result.current.loading).toBe(false);
  });
  return view;
}

let now = NOW;
let appStateListener: ((state: AppStateStatus) => void) | undefined;
let removeSubscription: jest.Mock;

describe('useDreamRecallAssistant', () => {
  beforeEach(() => {
    now = NOW;
    appStateListener = undefined;
    removeSubscription = jest.fn();
    mockLoad.mockReset();
    mockSave.mockReset();
    mockLoad.mockResolvedValue(null);
    mockSave.mockResolvedValue(undefined);
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    jest.spyOn(AppState, 'addEventListener').mockImplementation((
      _type: 'change',
      listener: (state: AppStateStatus) => void
    ) => {
      appStateListener = listener;
      return { remove: removeSubscription };
    });
    AppState.currentState = 'active';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('start persists the empty start state before Q1, then Q1', async () => {
    const { result } = await renderAssistant();
    expect(result.current.hasSession).toBe(false);
    expect(result.current.currentQuestion).toBeNull();

    await act(async () => {
      await result.current.start();
    });

    const saved = savedStates();
    expect(saved).toHaveLength(2);
    expect(saved[0]?.status).toBe('active');
    expect(saved[0]?.turns).toEqual([]);
    expect(saved[0]?.pendingUserSegment).toBeNull();
    expect(saved[0]?.originalPersistedSegmentId).toBe(ORIGINAL_SEGMENT_ID);

    expect(saved[1]?.status).toBe('active');
    expect(questionTurns(saved[1]!).map((turn) => turn.kind)).toEqual(['what_else']);
    expect(saved[1]?.turns[0]).toEqual(
      expect.objectContaining({
        role: 'question',
        kind: 'what_else',
        text: 'What else do you remember?',
      })
    );
    expect(saved[1]?.pendingUserSegment).toBeNull();

    expect(result.current.hasSession).toBe(true);
    expect(result.current.state?.status).toBe('active');
    expect(result.current.currentQuestion).toEqual({
      kind: 'what_else',
      text: 'What else do you remember?',
    });
    expect(result.current.error).toBeNull();
    expect(result.current.isBusy).toBe(false);
  });

  it('submitAnswer persists pending-unpersisted, then the persisted answer, then the next question', async () => {
    const { result } = await renderAssistant();
    await act(async () => {
      await result.current.start();
    });
    mockSave.mockClear();

    await act(async () => {
      await result.current.submitAnswer('A train passed under the door.');
    });

    const saved = savedStates();
    expect(saved).toHaveLength(3);

    expect(saved[0]?.pendingUserSegment).toEqual(
      expect.objectContaining({
        text: 'A train passed under the door.',
        persisted: false,
        persistedAt: null,
      })
    );
    expect(saved[0]?.turns.map((turn) => turn.role)).toEqual(['question']);

    expect(saved[1]?.pendingUserSegment).toEqual(
      expect.objectContaining({
        text: 'A train passed under the door.',
        persisted: true,
      })
    );
    expect(saved[1]?.pendingUserSegment?.persistedAt).not.toBeNull();
    expect(saved[1]?.turns.map((turn) => turn.role)).toEqual(['question', 'answer']);
    expect(saved[1]?.turns[1]).toEqual(
      expect.objectContaining({
        role: 'answer',
        text: 'A train passed under the door.',
      })
    );

    expect(saved[2]?.pendingUserSegment).toBeNull();
    expect(saved[2]?.turns.map((turn) => turn.role)).toEqual(['question', 'answer', 'question']);
    expect(saved[2]?.turns[2]).toEqual(
      expect.objectContaining({
        role: 'question',
        kind: 'where',
        text: 'Where did this take place?',
      })
    );

    expect(result.current.currentQuestion).toEqual({
      kind: 'where',
      text: 'Where did this take place?',
    });
    expect(result.current.error).toBeNull();
  });

  it('save failure gates the next prompt, exposes error, and start() retries an active persisted/no-question state', async () => {
    const { result } = await renderAssistant();

    mockSave
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('disk full'));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.error).toEqual(expect.objectContaining({ message: 'disk full' }));
    expect(result.current.state?.status).toBe('active');
    expect(result.current.state?.turns).toEqual([]);
    expect(result.current.currentQuestion).toBeNull();
    expect(savedStates()).toHaveLength(2);

    mockSave.mockClear();
    mockSave.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.currentQuestion).toEqual({
      kind: 'what_else',
      text: 'What else do you remember?',
    });
    expect(savedStates()).toHaveLength(1);
    expect(questionTurns(result.current.state).map((turn) => turn.kind)).toEqual(['what_else']);

    mockSave.mockClear();
    mockSave
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('write failed'));

    await act(async () => {
      await result.current.submitAnswer('Rain on the glass.');
    });

    expect(result.current.error).toEqual(expect.objectContaining({ message: 'write failed' }));
    expect(result.current.currentQuestion).toBeNull();
    expect(result.current.state?.status).toBe('active');
    expect(result.current.state?.pendingUserSegment?.persisted).toBe(true);
    expect(questionTurns(result.current.state)).toHaveLength(1);
    expect(answerTurns(result.current.state)).toHaveLength(1);
    expect(questionTurns(result.current.state)[0]?.kind).toBe('what_else');

    mockSave.mockClear();
    mockSave.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.currentQuestion).toEqual({
      kind: 'where',
      text: 'Where did this take place?',
    });
    expect(savedStates()).toHaveLength(1);
    expect(questionTurns(result.current.state).map((turn) => turn.kind)).toEqual([
      'what_else',
      'where',
    ]);
  });

  it('completes after 5 answers and never asks a sixth question', async () => {
    const { result } = await renderAssistant();
    await act(async () => {
      await result.current.start();
    });

    for (let index = 0; index < DREAM_RECALL_MAX_QUESTIONS; index += 1) {
      expect(result.current.state?.status).toBe('active');
      expect(result.current.currentQuestion?.kind).toBe(DREAM_RECALL_QUESTION_SEQUENCE[index]);
      await act(async () => {
        await result.current.submitAnswer(`Fragment ${index + 1} on the quiet street.`);
      });
    }

    expect(result.current.state?.status).toBe('completed');
    expect(result.current.currentQuestion).toBeNull();
    expect(questionTurns(result.current.state)).toHaveLength(5);
    expect(answerTurns(result.current.state)).toHaveLength(5);
    expect(questionTurns(result.current.state).map((turn) => turn.kind)).toEqual([
      ...DREAM_RECALL_QUESTION_SEQUENCE,
    ]);
    expect(result.current.state?.pendingUserSegment).toBeNull();
    expect(result.current.state?.completedAt).not.toBeNull();

    mockSave.mockClear();
    await act(async () => {
      await result.current.submitAnswer('A sixth fragment should not open Q6.');
    });
    expect(mockSave).not.toHaveBeenCalled();
    expect(questionTurns(result.current.state)).toHaveLength(5);
    expect(result.current.state?.status).toBe('completed');
  });

  describe('pause, resume, skip, complete', () => {
    it('pauses an active session and resume restores the open question', async () => {
      const { result } = await renderAssistant();
      await act(async () => {
        await result.current.start();
      });
      mockSave.mockClear();

      await act(async () => {
        await result.current.pause();
      });

      expect(result.current.state?.status).toBe('paused');
      expect(result.current.currentQuestion).toEqual({
        kind: 'what_else',
        text: 'What else do you remember?',
      });
      expect(savedStates()).toHaveLength(1);
      expect(savedStates()[0]?.status).toBe('paused');

      mockSave.mockClear();
      await act(async () => {
        await result.current.pause();
      });
      expect(mockSave).not.toHaveBeenCalled();

      await act(async () => {
        await result.current.resume();
      });

      expect(result.current.state?.status).toBe('active');
      expect(result.current.currentQuestion?.kind).toBe('what_else');
      expect(result.current.error).toBeNull();
    });

    it('pauses through AppState background without auto-resume', async () => {
      const { result } = await renderAssistant();
      await act(async () => {
        await result.current.start();
      });
      mockSave.mockClear();

      await act(async () => {
        appStateListener?.('background');
      });

      await waitFor(() => {
        expect(result.current.state?.status).toBe('paused');
      });
      expect(savedStates()[0]?.status).toBe('paused');

      await act(async () => {
        appStateListener?.('active');
      });
      expect(result.current.state?.status).toBe('paused');

      await act(async () => {
        await result.current.resume();
      });
      expect(result.current.state?.status).toBe('active');
    });

    it('skips and completes as explicit exits', async () => {
      const skippedView = await renderAssistant();
      await act(async () => {
        await skippedView.result.current.start();
      });
      mockSave.mockClear();

      await act(async () => {
        await skippedView.result.current.skip();
      });
      expect(skippedView.result.current.state?.status).toBe('skipped');
      expect(skippedView.result.current.currentQuestion).toBeNull();
      expect(skippedView.result.current.state?.pendingUserSegment).toBeNull();
      expect(skippedView.result.current.state?.completedAt).not.toBeNull();
      skippedView.unmount();

      const completedView = await renderAssistant();
      await act(async () => {
        await completedView.result.current.start();
      });
      mockSave.mockClear();

      await act(async () => {
        await completedView.result.current.complete();
      });
      expect(completedView.result.current.state?.status).toBe('completed');
      expect(completedView.result.current.currentQuestion).toBeNull();
      expect(completedView.result.current.state?.pendingUserSegment).toBeNull();
      expect(completedView.result.current.state?.completedAt).not.toBeNull();
    });
  });

  describe('hydration recovery', () => {
    it('recovers an active empty snapshot by persisting Q1', async () => {
      mockLoad.mockResolvedValue(activeEmpty());
      const { result } = await renderAssistant();

      expect(result.current.state?.status).toBe('active');
      expect(result.current.currentQuestion).toEqual({
        kind: 'what_else',
        text: 'What else do you remember?',
      });
      expect(savedStates()).toHaveLength(1);
      expect(questionTurns(savedStates()[0]!).map((turn) => turn.kind)).toEqual(['what_else']);
    });

    it('recovers pending unpersisted by persisting the answer then the next question', async () => {
      mockLoad.mockResolvedValue(pendingUnpersisted());
      const { result } = await renderAssistant();

      const saved = savedStates();
      expect(saved).toHaveLength(2);
      expect(saved[0]?.pendingUserSegment?.persisted).toBe(true);
      expect(saved[0]?.turns.map((turn) => turn.role)).toEqual(['question', 'answer']);
      expect(saved[1]?.pendingUserSegment).toBeNull();
      expect(saved[1]?.turns.map((turn) => turn.role)).toEqual(['question', 'answer', 'question']);
      expect(result.current.currentQuestion?.kind).toBe('where');
    });

    it('recovers pending persisted with no open question by asking the next question', async () => {
      mockLoad.mockResolvedValue(pendingPersistedNoOpenQuestion());
      const { result } = await renderAssistant();

      expect(savedStates()).toHaveLength(1);
      expect(result.current.currentQuestion).toEqual({
        kind: 'where',
        text: 'Where did this take place?',
      });
      expect(questionTurns(result.current.state).map((turn) => turn.kind)).toEqual([
        'what_else',
        'where',
      ]);
    });

    it('leaves paused and terminal snapshots unchanged', async () => {
      mockLoad.mockResolvedValue(pausedUnchanged());
      const paused = await renderAssistant();
      expect(paused.result.current.state?.status).toBe('paused');
      expect(paused.result.current.currentQuestion?.kind).toBe('what_else');
      expect(mockSave).not.toHaveBeenCalled();
      paused.unmount();

      mockLoad.mockResolvedValue(completedUnchanged());
      const completed = await renderAssistant();
      expect(completed.result.current.state?.status).toBe('completed');
      expect(completed.result.current.currentQuestion).toBeNull();
      expect(mockSave).not.toHaveBeenCalled();
      completed.unmount();

      mockLoad.mockResolvedValue(skippedUnchanged());
      const skipped = await renderAssistant();
      expect(skipped.result.current.state?.status).toBe('skipped');
      expect(skipped.result.current.currentQuestion).toBeNull();
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('completes a fully answered snapshot instead of asking Q6', async () => {
      mockLoad.mockResolvedValue(fiveAnswersPendingPersisted());
      const { result } = await renderAssistant();

      expect(result.current.state?.status).toBe('completed');
      expect(result.current.currentQuestion).toBeNull();
      expect(questionTurns(result.current.state)).toHaveLength(5);
      expect(savedStates()[0]?.status).toBe('completed');
    });
  });

  it('ignores a second submit from the same open question and accepts a later answer after the next question is shown', async () => {
    const { result } = await renderAssistant();
    await act(async () => {
      await result.current.start();
    });
    mockSave.mockClear();

    const gate = deferred<void>();
    let inFlight = 0;
    let maxInFlight = 0;
    mockSave.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      if (mockSave.mock.calls.length === 1) {
        await gate.promise;
      }
      inFlight -= 1;
    });

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.submitAnswer('First recall fragment.');
      second = result.current.submitAnswer('Second recall fragment.');
    });

    await waitFor(() => {
      expect(result.current.isBusy).toBe(true);
      expect(mockSave).toHaveBeenCalledTimes(1);
    });
    expect(result.current.currentQuestion?.kind).toBe('what_else');
    expect(savedStates()[0]?.pendingUserSegment?.text).toBe('First recall fragment.');
    expect(savedStates()[0]?.pendingUserSegment?.persisted).toBe(false);

    await act(async () => {
      gate.resolve();
      await Promise.all([first, second]);
    });

    expect(maxInFlight).toBe(1);
    expect(result.current.isBusy).toBe(false);
    expect(result.current.error).toBeNull();
    expect(answerTurns(result.current.state).map((turn) => turn.text)).toEqual([
      'First recall fragment.',
    ]);
    expect(result.current.currentQuestion).toEqual({
      kind: 'where',
      text: 'Where did this take place?',
    });
    expect(questionTurns(result.current.state).map((turn) => turn.kind)).toEqual([
      'what_else',
      'where',
    ]);
    expect(savedStates()).toHaveLength(3);
    expect(savedStates().map((state) => state.pendingUserSegment?.persisted ?? null)).toEqual([
      false,
      true,
      null,
    ]);
    expect(
      savedStates().some((state) =>
        JSON.stringify(state).includes('Second recall fragment.')
      )
    ).toBe(false);

    mockSave.mockClear();
    mockSave.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.submitAnswer('The canal beside the quiet street.');
    });

    expect(result.current.error).toBeNull();
    expect(answerTurns(result.current.state).map((turn) => turn.text)).toEqual([
      'First recall fragment.',
      'The canal beside the quiet street.',
    ]);
    expect(result.current.currentQuestion).toEqual({
      kind: 'who_else',
      text: 'Who else was there?',
    });
    expect(savedStates()).toHaveLength(3);
    expect(savedStates()[0]?.pendingUserSegment).toEqual(
      expect.objectContaining({
        text: 'The canal beside the quiet street.',
        persisted: false,
      })
    );
  });

  it('ignores submitAnswer when there is no open question', async () => {
    mockLoad.mockResolvedValue(pendingPersistedNoOpenQuestion());
    mockSave.mockRejectedValueOnce(new Error('blocked next question'));
    const { result } = await renderAssistant();

    expect(result.current.currentQuestion).toBeNull();
    expect(result.current.state?.status).toBe('active');
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'blocked next question' })
    );

    mockSave.mockClear();
    mockSave.mockResolvedValue(undefined);
    const snapshot = result.current.state;

    await act(async () => {
      await result.current.submitAnswer('This should not attach without an open question.');
    });

    expect(mockSave).not.toHaveBeenCalled();
    expect(result.current.state).toBe(snapshot);
    expect(answerTurns(result.current.state)).toHaveLength(1);
  });

  it('keeps the original transcript only on state.originalTranscript', async () => {
    const { result } = await renderAssistant();
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.submitAnswer('A red bicycle by the canal.');
    });

    expect(result.current.state).not.toBeNull();
    expectTranscriptOnlyOnState(result.current.state!);
    expect(JSON.stringify(result.current.currentQuestion)).not.toContain(ORIGINAL);
    expect(result.current.currentQuestion).toEqual({
      kind: 'where',
      text: 'Where did this take place?',
    });

    for (const saved of savedStates()) {
      expectTranscriptOnlyOnState(saved);
    }

    expect(mockLoad).toHaveBeenCalledWith(DREAM_ID);
    expect(mockLoad.mock.calls.flat().join(' ')).not.toContain(ORIGINAL);
  });

  it('cleans up the AppState subscription on unmount', async () => {
    const { unmount } = await renderAssistant();
    unmount();
    expect(removeSubscription).toHaveBeenCalled();
  });
});
