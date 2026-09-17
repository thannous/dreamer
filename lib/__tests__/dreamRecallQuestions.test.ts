import { describe, expect, it, jest } from '@jest/globals';

import { DreamRecallAssistantError, isNeutralRecallQuestion } from '../dreamRecallAssistant';
import {
  DREAM_RECALL_MAX_QUESTIONS,
  DREAM_RECALL_QUESTION_I18N_KEYS,
  DREAM_RECALL_QUESTION_SEQUENCE,
  dreamRecallQuestionKey,
  getDreamRecallQuestion,
} from '../dreamRecallQuestions';

const ORIGINAL = 'I flew over a quiet city with a blue door.';

const QUESTIONS: Record<string, string> = {
  'dream_recall.question.what_else': 'What else do you remember?',
  'dream_recall.question.where': 'Where did this take place?',
  'dream_recall.question.who_else': 'Who else was there?',
  'dream_recall.question.what_seen': 'What did you see?',
  'dream_recall.question.what_next': 'What happened next?',
};

const translator = (overrides: Record<string, string> = {}) =>
  jest.fn((key: string) => overrides[key] ?? QUESTIONS[key] ?? '');

describe('dream recall question keys', () => {
  it('exports i18n keys for the closed 5-kind sequence', () => {
    expect(DREAM_RECALL_QUESTION_SEQUENCE).toEqual([
      'what_else',
      'where',
      'who_else',
      'what_seen',
      'what_next',
    ]);
    expect(DREAM_RECALL_MAX_QUESTIONS).toBe(5);
    expect(DREAM_RECALL_QUESTION_I18N_KEYS).toEqual({
      what_else: 'dream_recall.question.what_else',
      where: 'dream_recall.question.where',
      who_else: 'dream_recall.question.who_else',
      what_seen: 'dream_recall.question.what_seen',
      what_next: 'dream_recall.question.what_next',
    });
    for (const kind of DREAM_RECALL_QUESTION_SEQUENCE) {
      expect(dreamRecallQuestionKey(kind)).toBe(`dream_recall.question.${kind}`);
    }
  });
});

describe('getDreamRecallQuestion', () => {
  it('returns the deterministic sequence through a compatible translator', () => {
    const t = translator();
    const questions = Array.from({ length: DREAM_RECALL_MAX_QUESTIONS }, (_, index) =>
      getDreamRecallQuestion(index, t)
    );

    expect(questions.map((question) => question.kind)).toEqual([...DREAM_RECALL_QUESTION_SEQUENCE]);
    expect(questions.map((question) => question.text)).toEqual([
      'What else do you remember?',
      'Where did this take place?',
      'Who else was there?',
      'What did you see?',
      'What happened next?',
    ]);
    expect(t.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      'dream_recall.question.what_else',
      'dream_recall.question.where',
      'dream_recall.question.who_else',
      'dream_recall.question.what_seen',
      'dream_recall.question.what_next',
    ]);
  });

  it('wraps indexes within the max-5 bounds', () => {
    const t = translator();
    expect(getDreamRecallQuestion(5, t).kind).toBe('what_else');
    expect(getDreamRecallQuestion(6, t).kind).toBe('where');
    expect(getDreamRecallQuestion(-1, t).kind).toBe('what_next');
    expect(getDreamRecallQuestion(9, t).kind).toBe('what_next');
    expect(getDreamRecallQuestion(Number.NaN, t).kind).toBe('what_else');
  });

  it('returns only questions accepted by isNeutralRecallQuestion', () => {
    const t = translator();
    for (let index = 0; index < DREAM_RECALL_MAX_QUESTIONS; index += 1) {
      const question = getDreamRecallQuestion(index, t);
      expect(isNeutralRecallQuestion(question)).toBe(true);
    }
  });

  it('throws when a translation is empty, not a question, or interpretive', () => {
    expect(() => getDreamRecallQuestion(0, () => '')).toThrow(DreamRecallAssistantError);
    expect(() => getDreamRecallQuestion(0, () => '   ')).toThrow(DreamRecallAssistantError);
    expect(() => getDreamRecallQuestion(0, () => 'Remember more')).toThrow(DreamRecallAssistantError);
    expect(() => getDreamRecallQuestion(0, () => 'What does this symbol mean?')).toThrow(
      DreamRecallAssistantError
    );
    try {
      getDreamRecallQuestion(1, () => 'Que signifie cette porte bleue ?');
      throw new Error('expected invalid_question');
    } catch (error) {
      expect(error).toBeInstanceOf(DreamRecallAssistantError);
      expect((error as DreamRecallAssistantError).code).toBe('invalid_question');
    }
  });

  it('never uses the original dream text', () => {
    const t = translator();
    const question = getDreamRecallQuestion(0, t);

    expect(t).toHaveBeenCalledTimes(1);
    expect(t.mock.calls[0]?.[0]).toBe('dream_recall.question.what_else');
    expect(JSON.stringify(t.mock.calls)).not.toContain(ORIGINAL);
    expect(question.text).not.toContain(ORIGINAL);
    expect(Object.keys(question)).toEqual(['kind', 'text']);
  });
});
