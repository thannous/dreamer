import { describe, expect, it } from '@jest/globals';

import {
  addDreamRecallUserSegment,
  appendNeutralRecallQuestion,
  completeDreamRecallAssistant,
  DREAM_RECALL_ASSISTANT_SCHEMA_VERSION,
  DREAM_RECALL_QUESTION_INTENT,
  DreamRecallAssistantError,
  hydrateDreamRecallAssistantState,
  isDreamRecallAssistantState,
  isNeutralRecallQuestion,
  markDreamRecallSegmentPersisted,
  pauseDreamRecallAssistant,
  requestDreamRecallNextQuestion,
  resumeDreamRecallAssistant,
  serializeDreamRecallAssistantState,
  skipDreamRecallAssistant,
  startDreamRecallAssistant,
  validateDreamRecallAssistantState,
  type DreamRecallAssistantState,
} from '../dreamRecallAssistant';

const NOW = 1_700_000_000_000;
const ORIGINAL = 'I flew over a quiet city with a blue door.';
const ORIGINAL_SEGMENT_ID = 'persisted-original-42';

const start = (overrides: Partial<Parameters<typeof startDreamRecallAssistant>[0]> = {}) =>
  startDreamRecallAssistant({
    dreamId: 'dream-42',
    originalTranscript: ORIGINAL,
    originalPersistedSegmentId: ORIGINAL_SEGMENT_ID,
    now: NOW,
    maxQuestions: 2,
    ...overrides,
  });

const expectCode = (code: DreamRecallAssistantError['code'], run: () => unknown) => {
  try {
    run();
    throw new Error(`Expected DreamRecallAssistantError(${code})`);
  } catch (error) {
    expect(error).toBeInstanceOf(DreamRecallAssistantError);
    expect((error as DreamRecallAssistantError).code).toBe(code);
  }
};

describe('startDreamRecallAssistant', () => {
  it('requests the first question from the already persisted original without a new segment', () => {
    const { state, command } = start({ originalTranscriptRef: 'dreams/42' });

    expect(state.status).toBe('active');
    expect(state.schemaVersion).toBe(DREAM_RECALL_ASSISTANT_SCHEMA_VERSION);
    expect(state.originalTranscript).toBe(ORIGINAL);
    expect(state.originalPersistedSegmentId).toBe(ORIGINAL_SEGMENT_ID);
    expect(state.turns).toEqual([]);
    expect(state.pendingUserSegment).toBeNull();
    expect(command).toEqual({
      kind: 'request_next_question',
      intent: DREAM_RECALL_QUESTION_INTENT,
      dreamId: 'dream-42',
      originalTranscriptHash: state.originalTranscriptHash,
      originalPersistedSegmentId: ORIGINAL_SEGMENT_ID,
      originalTranscriptRef: 'dreams/42',
      questionIndex: 0,
      persistedSegmentId: ORIGINAL_SEGMENT_ID,
    });
    expect(JSON.stringify(command)).not.toContain(ORIGINAL);
    expect(JSON.stringify(state.turns)).not.toContain(ORIGINAL);
  });

  it('rejects empty dream, transcript, or original persistence ids', () => {
    expectCode('invalid_input', () =>
      startDreamRecallAssistant({
        dreamId: '  ',
        originalTranscript: ORIGINAL,
        originalPersistedSegmentId: ORIGINAL_SEGMENT_ID,
        now: NOW,
      })
    );
    expectCode('invalid_input', () =>
      start({ originalTranscript: '   ' })
    );
    expectCode('invalid_input', () =>
      start({ originalPersistedSegmentId: '  ' })
    );
  });
});

describe('first question then persist-before-request', () => {
  it('allows the first request immediately, then requires add -> persist for later questions', () => {
    const started = start();
    const requested = requestDreamRecallNextQuestion(started.state, NOW + 1);
    expect(requested.command.kind).toBe('request_next_question');
    if (requested.command.kind === 'request_next_question') {
      expect(requested.command.persistedSegmentId).toBe(ORIGINAL_SEGMENT_ID);
      expect(requested.command.originalPersistedSegmentId).toBe(ORIGINAL_SEGMENT_ID);
      expect(requested.command).not.toHaveProperty('originalTranscript');
    }

    const firstQuestion = appendNeutralRecallQuestion(
      requested.state,
      { kind: 'what_next', text: 'Que s’est-il passé ensuite ?' },
      NOW + 2
    );
    expect(firstQuestion.command).toEqual({ kind: 'await_user_segment' });
    expect(firstQuestion.state.turns).toEqual([
      expect.objectContaining({
        role: 'question',
        kind: 'what_next',
        text: 'Que s’est-il passé ensuite ?',
      }),
    ]);
    expectCode('open_question', () =>
      requestDreamRecallNextQuestion(firstQuestion.state, NOW + 3)
    );

    const added = addDreamRecallUserSegment(
      firstQuestion.state,
      'Un train est passé sous la porte.',
      NOW + 4
    );
    expect(added.command).toEqual({ kind: 'await_persist' });
    expectCode('segment_not_persisted', () =>
      requestDreamRecallNextQuestion(added.state, NOW + 5)
    );

    const persisted = markDreamRecallSegmentPersisted(added.state, NOW + 6);
    expect(persisted.state.turns.map((turn) => turn.role)).toEqual(['question', 'answer']);
    expect(persisted.state.turns.some((turn) => turn.text === ORIGINAL)).toBe(false);
    const later = requestDreamRecallNextQuestion(persisted.state, NOW + 7);
    expect(later.command.kind).toBe('request_next_question');
    if (later.command.kind === 'request_next_question') {
      expect(later.command.persistedSegmentId).toBe(persisted.state.pendingUserSegment?.id);
      expect(later.command.persistedSegmentId).not.toBe(ORIGINAL_SEGMENT_ID);
      expect(JSON.stringify(later.command)).not.toContain(ORIGINAL);
    }
  });
});

describe('pause, resume, skip, complete', () => {
  it('pauses and resumes the first-question command from the original persistence id', () => {
    const started = start();
    const paused = pauseDreamRecallAssistant(started.state, NOW + 10);
    expect(paused.command).toEqual({ kind: 'paused' });
    expectCode('paused', () => requestDreamRecallNextQuestion(paused.state, NOW + 11));

    const resumed = resumeDreamRecallAssistant(paused.state, NOW + 12);
    expect(resumed.state.status).toBe('active');
    expect(resumed.command).toMatchObject({
      kind: 'request_next_question',
      persistedSegmentId: ORIGINAL_SEGMENT_ID,
    });
  });

  it('skips from active or paused and completes as an explicit exit', () => {
    const started = start();
    const skipped = skipDreamRecallAssistant(started.state, NOW + 20);
    expect(skipped.state).toMatchObject({
      status: 'skipped',
      pendingUserSegment: null,
      completedAt: NOW + 20,
    });
    const completed = completeDreamRecallAssistant(started.state, NOW + 21);
    expect(completed.command).toEqual({ kind: 'completed' });
    expect(completed.state.turns).toEqual([]);
    const paused = pauseDreamRecallAssistant(started.state, NOW + 22);
    expect(skipDreamRecallAssistant(paused.state, NOW + 23).state.status).toBe('skipped');
    expectCode('terminal', () => skipDreamRecallAssistant(completed.state, NOW + 24));
  });
});

describe('max questions', () => {
  it('enforces a strict question cap after the original-backed first question', () => {
    let current = start().state;
    current = appendNeutralRecallQuestion(
      current,
      { kind: 'what_next', text: 'What happened next?' },
      NOW + 30
    ).state;
    current = addDreamRecallUserSegment(current, 'Rain on the glass.', NOW + 31).state;
    current = markDreamRecallSegmentPersisted(current, NOW + 32).state;
    current = appendNeutralRecallQuestion(
      current,
      { kind: 'who_else', text: 'Who else was there?' },
      NOW + 33
    ).state;
    current = addDreamRecallUserSegment(current, 'A quiet attendant.', NOW + 34).state;
    const last = markDreamRecallSegmentPersisted(current, NOW + 35);
    expect(last.state.turns.filter((turn) => turn.role === 'question')).toHaveLength(2);
    expectCode('max_questions', () => requestDreamRecallNextQuestion(last.state, NOW + 36));
    expectCode('max_questions', () =>
      appendNeutralRecallQuestion(last.state, { kind: 'what_seen', text: 'What did you see?' }, NOW + 37)
    );
  });
});

describe('locale-safe neutrality', () => {
  it('accepts closed question kinds with localized factual text and rejects interpretive prompts', () => {
    expect(isNeutralRecallQuestion({ kind: 'what_next', text: 'What happened next?' })).toBe(true);
    expect(
      isNeutralRecallQuestion({ kind: 'what_next', text: 'Que s’est-il passé ensuite ?' })
    ).toBe(true);
    expect(isNeutralRecallQuestion({ kind: 'who_else', text: 'Qui d’autre était là ?' })).toBe(true);
    expect(
      isNeutralRecallQuestion({ kind: 'what_else', text: 'Que signifie cette porte bleue ?' })
    ).toBe(false);
    expect(
      isNeutralRecallQuestion({ kind: 'appearance', text: 'Quel symbole représente le train ?' })
    ).toBe(false);
    expect(isNeutralRecallQuestion({ kind: 'what_next', text: 'What does this symbol mean?' })).toBe(
      false
    );
    expect(isNeutralRecallQuestion({ kind: 'invented', text: 'What happened next?' })).toBe(false);

    const started = start();
    expect(
      appendNeutralRecallQuestion(
        started.state,
        { kind: 'what_next', text: 'Que s’est-il passé ensuite ?' },
        NOW + 40
      ).state.turns[0]
    ).toMatchObject({ role: 'question', kind: 'what_next' });
    expectCode('invalid_question', () =>
      appendNeutralRecallQuestion(
        started.state,
        { kind: 'what_else', text: 'Que signifie cette porte bleue ?' },
        NOW + 41
      )
    );
  });
});

describe('hydrate and validate', () => {
  it('round-trips a valid snapshot and rejects corrupted or legacy payloads', () => {
    const started = start();
    const json = serializeDreamRecallAssistantState(started.state);
    expect(hydrateDreamRecallAssistantState(json)).toEqual({ ok: true, state: started.state });
    expect(() => validateDreamRecallAssistantState(started.state)).not.toThrow();
    expect(JSON.parse(json).turns).toEqual([]);
    expect(JSON.parse(json).originalPersistedSegmentId).toBe(ORIGINAL_SEGMENT_ID);

    expect(hydrateDreamRecallAssistantState('{')).toEqual({ ok: false, reason: 'invalid_json' });
    expect(hydrateDreamRecallAssistantState({ schemaVersion: 0, status: 'active' })).toEqual({
      ok: false,
      reason: 'unsupported_schema',
    });
    expect(
      hydrateDreamRecallAssistantState({
        ...JSON.parse(json),
        turns: [{ id: 'q-1', role: 'question', kind: 'what_next', text: ORIGINAL, createdAt: NOW }],
      }).ok
    ).toBe(false);
    expect(
      isDreamRecallAssistantState({
        ...JSON.parse(json),
        turns: [{ id: 'a-1', role: 'answer', text: 'Too soon', createdAt: NOW, segmentId: 'seg' }],
      })
    ).toBe(false);
    expect(
      hydrateDreamRecallAssistantState({
        dreamId: 'dream-42',
        originalTranscript: ORIGINAL,
        status: 'active',
        turns: [],
      })
    ).toEqual({ ok: false, reason: 'unsupported_schema' });
  });
});

describe('immutability', () => {
  it('does not mutate the previous state object', () => {
    const started = start();
    const before = structuredClone(started.state);
    addDreamRecallUserSegment(started.state, 'A later fragment.', NOW + 50);
    expect(started.state).toEqual(before);
  });
});

true satisfies DreamRecallAssistantState['status'] extends
  | 'idle'
  | 'active'
  | 'paused'
  | 'completed'
  | 'skipped'
  ? true
  : false;
