import { describe, expect, it } from '@jest/globals';

import { isNeutralRecallQuestion } from '../dreamRecallAssistant';
import {
  DREAM_RECALL_MAX_QUESTIONS,
  DREAM_RECALL_QUESTION_I18N_KEYS,
  DREAM_RECALL_QUESTION_SEQUENCE,
  getDreamRecallQuestion,
} from '../dreamRecallQuestions';
import de from '../i18n/de';
import en from '../i18n/en';
import es from '../i18n/es';
import fr from '../i18n/fr';
import italian from '../i18n/it';
import pt from '../i18n/pt';

const packs = { de, en, es, fr, it: italian, pt } as const;

const dreamRecallKeys = [
  'dream_recall.question.what_else',
  'dream_recall.question.where',
  'dream_recall.question.who_else',
  'dream_recall.question.what_seen',
  'dream_recall.question.what_next',
  'dream_recall.offer.eyebrow',
  'dream_recall.offer.title',
  'dream_recall.offer.body',
  'dream_recall.offer.start',
  'dream_recall.offer.later',
  'dream_recall.session.title',
  'dream_recall.session.progress',
  'dream_recall.session.input_label',
  'dream_recall.session.input_placeholder',
  'dream_recall.session.submit',
  'dream_recall.session.pause',
  'dream_recall.session.resume',
  'dream_recall.session.skip',
  'dream_recall.session.complete',
  'dream_recall.session.completed_title',
  'dream_recall.session.completed_body',
  'dream_recall.session.saving',
  'dream_recall.session.error',
  'dream_recall.session.voice_start',
  'dream_recall.session.voice_stop',
  'dream_recall.session.voice_error',
] as const;

const placeholdersOf = (value: string): string[] =>
  [...value.matchAll(/\{\{?\s*([a-zA-Z_]+)\s*\}?\}/g)].map((match) => match[1]).sort();

describe('dream recall i18n', () => {
  it('covers the closed 26-key pack in every supported language', () => {
    expect(dreamRecallKeys).toHaveLength(26);

    for (const [language, translations] of Object.entries(packs)) {
      for (const key of dreamRecallKeys) {
        const value = translations[key];
        expect({ language, key, value }).toMatchObject({
          language,
          key,
          value: expect.any(String),
        });
        expect(value).not.toBe(key);
        expect(value.trim()).not.toBe('');
      }
    }
  });

  it('keeps progress placeholders identical across languages', () => {
    for (const [language, translations] of Object.entries(packs)) {
      expect({
        language,
        progress: translations['dream_recall.session.progress'],
      }).toEqual({
        language,
        progress: '{current}/{total}',
      });
      expect(placeholdersOf(translations['dream_recall.session.progress'])).toEqual(['current', 'total']);

      for (const key of dreamRecallKeys) {
        expect(placeholdersOf(translations[key])).toEqual(placeholdersOf(en[key]));
      }
    }
  });

  it('returns only neutral recall questions from each catalogue', () => {
    expect(DREAM_RECALL_MAX_QUESTIONS).toBe(5);
    expect(DREAM_RECALL_QUESTION_SEQUENCE).toEqual([
      'what_else',
      'where',
      'who_else',
      'what_seen',
      'what_next',
    ]);

    for (const [language, translations] of Object.entries(packs)) {
      const t = (key: string) => translations[key];

      for (let index = 0; index < DREAM_RECALL_MAX_QUESTIONS; index += 1) {
        const question = getDreamRecallQuestion(index, t);
        const kind = DREAM_RECALL_QUESTION_SEQUENCE[index];

        expect({ language, kind: question.kind, text: question.text }).toEqual({
          language,
          kind,
          text: translations[DREAM_RECALL_QUESTION_I18N_KEYS[kind]],
        });
        expect(question.text.endsWith('?')).toBe(true);
        expect(isNeutralRecallQuestion(question)).toBe(true);
      }
    }
  });

  it('keeps the offer optional after the dream is already saved', () => {
    expect(en['dream_recall.offer.body']).toMatch(/already saved/i);
    expect(en['dream_recall.offer.body']).toMatch(/optional/i);
    expect(fr['dream_recall.offer.body']).toMatch(/déjà enregistré/);
    expect(fr['dream_recall.offer.body']).toMatch(/facultatifs/);
    expect(es['dream_recall.offer.body']).toMatch(/ya está guardado/);
    expect(es['dream_recall.offer.body']).toMatch(/opcionales/);
    expect(de['dream_recall.offer.body']).toMatch(/bereits gespeichert/);
    expect(de['dream_recall.offer.body']).toMatch(/optional/);
    expect(italian['dream_recall.offer.body']).toMatch(/già salvato/);
    expect(italian['dream_recall.offer.body']).toMatch(/facoltativo/);
    expect(pt['dream_recall.offer.body']).toMatch(/já está salvo/);
    expect(pt['dream_recall.offer.body']).toMatch(/opcionais/);
  });
});
