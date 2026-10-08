import {
  getSessionPractice,
  SESSION_METHODS,
  SESSION_PRACTICE_BY_ID,
} from '@/content/sessionPractice';
import { SESSIONS, SESSION_BY_ID } from '@/content/sessions';
import { translate } from '@/lib/i18n';

const LANGUAGES = ['en', 'fr', 'de', 'es', 'it', 'pt'] as const;
const METHOD_KEYS = SESSION_METHODS.map(
  (method) => `session.method.${method}` as const
);

describe('session method metadata', () => {
  it('covers every catalogue session exactly once', () => {
    const sessionIds = SESSIONS.map((session) => session.id).sort();
    const practiceIds = Object.keys(SESSION_PRACTICE_BY_ID).sort();

    expect(practiceIds).toEqual(sessionIds);
    expect(practiceIds).toHaveLength(24);
  });

  it('keeps the method vocabulary small and typed', () => {
    expect([...SESSION_METHODS]).toEqual(['breath', 'body', 'attention', 'presence', 'reflection']);

    for (const session of SESSIONS) {
      expect(SESSION_METHODS).toContain(getSessionPractice(session.id).method);
    }
  });

  it('keeps method copy distinct in every language', () => {
    for (const language of LANGUAGES) {
      const methods = METHOD_KEYS.map((key) => translate(language, key));

      expect(new Set(methods).size).toBe(SESSION_METHODS.length);
      expect(translate(language, 'session.method.label')).toContain('{method}');
    }
  });

  it('does not invent a practice for an unknown session id', () => {
    expect(() => getSessionPractice('not-a-session')).toThrow(
      'Missing method metadata for session not-a-session'
    );
    expect(SESSION_BY_ID['sleep-descent'].id).toBe('sleep-descent');
  });
});
