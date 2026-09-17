import {
  DreamRecallAssistantError,
  isNeutralRecallQuestion,
  type DreamRecallQuestionKind,
} from './dreamRecallAssistant';

export const DREAM_RECALL_QUESTION_SEQUENCE = [
  'what_else',
  'where',
  'who_else',
  'what_seen',
  'what_next',
] as const satisfies readonly DreamRecallQuestionKind[];

export const DREAM_RECALL_MAX_QUESTIONS = DREAM_RECALL_QUESTION_SEQUENCE.length;

export type DreamRecallSequenceKind = (typeof DREAM_RECALL_QUESTION_SEQUENCE)[number];

export type DreamRecallQuestionI18nKey = `dream_recall.question.${DreamRecallSequenceKind}`;

export const DREAM_RECALL_QUESTION_I18N_KEYS = {
  what_else: 'dream_recall.question.what_else',
  where: 'dream_recall.question.where',
  who_else: 'dream_recall.question.who_else',
  what_seen: 'dream_recall.question.what_seen',
  what_next: 'dream_recall.question.what_next',
} as const satisfies { readonly [K in DreamRecallSequenceKind]: `dream_recall.question.${K}` };

export type DreamRecallQuestionTranslator = (
  key: string,
  replacements?: Record<string, string | number>
) => unknown;

export type DreamRecallQuestion = {
  kind: DreamRecallSequenceKind;
  text: string;
};

const wrapIndex = (index: number): number => {
  const length = DREAM_RECALL_MAX_QUESTIONS;
  const raw = Number.isFinite(index) ? Math.trunc(index) : 0;
  return ((raw % length) + length) % length;
};

export function dreamRecallQuestionKey(kind: DreamRecallSequenceKind): DreamRecallQuestionI18nKey {
  return DREAM_RECALL_QUESTION_I18N_KEYS[kind];
}

export function getDreamRecallQuestion(
  index: number,
  t: DreamRecallQuestionTranslator
): DreamRecallQuestion {
  const kind = DREAM_RECALL_QUESTION_SEQUENCE[wrapIndex(index)];
  const key = DREAM_RECALL_QUESTION_I18N_KEYS[kind];
  const translated = t(key);
  const text = typeof translated === 'string' ? translated : '';
  const question = { kind, text };
  if (!isNeutralRecallQuestion(question)) {
    throw new DreamRecallAssistantError(
      'invalid_question',
      `Recall question "${key}" must be a non-empty, non-interpretive question.`
    );
  }
  return { kind, text: question.text };
}
