import {
  getSessionPractice,
  SESSION_GUIDANCE_LEVELS,
  SESSION_METHODS,
  SESSION_PRACTICE_BY_ID,
} from '@/content/sessionPractice';
import { SESSIONS, SESSION_BY_ID } from '@/content/sessions';
import { translate } from '@/lib/i18n';

const LANGUAGES = ['en', 'fr', 'de', 'es', 'it', 'pt'] as const;
const METHOD_KEYS = SESSION_METHODS.map(
  (method) => `session.method.${method}` as const
);
const GUIDANCE_KEYS = SESSION_GUIDANCE_LEVELS.map(
  (level) => `session.guidance.${level}` as const
);

describe('session method and guidance metadata', () => {
  it('covers every catalogue session exactly once', () => {
    const sessionIds = SESSIONS.map((session) => session.id).sort();
    const practiceIds = Object.keys(SESSION_PRACTICE_BY_ID).sort();

    expect(practiceIds).toEqual(sessionIds);
    expect(practiceIds).toHaveLength(24);
  });

  it('keeps the method and guidance vocabularies small and typed', () => {
    expect([...SESSION_METHODS]).toEqual(['breath', 'body', 'attention', 'presence', 'reflection']);
    expect([...SESSION_GUIDANCE_LEVELS]).toEqual(['fading', 'guided', 'light']);

    for (const session of SESSIONS) {
      const practice = getSessionPractice(session.id);
      expect(SESSION_METHODS).toContain(practice.method);
      expect(SESSION_GUIDANCE_LEVELS).toContain(practice.guidance);
    }
  });

  it('exposes distinct method or guidance labels across Sleep sessions', () => {
    const sleep = SESSIONS.filter((session) => session.categorySlug === 'sleep');
    expect(sleep.map((session) => session.id)).toEqual([
      'sleep-descent',
      'sleep-quick-fall',
      'sleep-body-scan',
      'sleep-night-return',
    ]);

    const signatures = sleep.map((session) => {
      const practice = getSessionPractice(session.id);
      return `${practice.method}:${practice.guidance}`;
    });

    expect(new Set(signatures).size).toBe(sleep.length);
    expect(SESSION_PRACTICE_BY_ID['sleep-descent']).toEqual({
      method: 'breath',
      guidance: 'guided',
    });
    expect(SESSION_PRACTICE_BY_ID['sleep-quick-fall']).toEqual({
      method: 'breath',
      guidance: 'fading',
    });
    expect(SESSION_PRACTICE_BY_ID['sleep-body-scan']).toEqual({
      method: 'body',
      guidance: 'guided',
    });
    expect(SESSION_PRACTICE_BY_ID['sleep-night-return']).toEqual({
      method: 'presence',
      guidance: 'light',
    });
  });

  it('keeps method and guidance copy distinct in every language', () => {
    for (const language of LANGUAGES) {
      const methods = METHOD_KEYS.map((key) => translate(language, key));
      const guidance = GUIDANCE_KEYS.map((key) => translate(language, key));

      expect(new Set(methods).size).toBe(SESSION_METHODS.length);
      expect(new Set(guidance).size).toBe(SESSION_GUIDANCE_LEVELS.length);
      expect(translate(language, 'session.method.label')).toContain('{method}');
      expect(translate(language, 'session.guidance.label')).toContain('{guidance}');
    }
  });

  it('does not invent a practice for an unknown session id', () => {
    expect(() => getSessionPractice('not-a-session')).toThrow(
      'Missing method/guidance metadata for session not-a-session'
    );
    expect(SESSION_BY_ID['sleep-descent'].id).toBe('sleep-descent');
  });
});
