import type { SessionId } from '@/lib/types';

import { SESSIONS } from './sessions';

/**
 * Method and guidance are editorial metadata for SessionCard, not player
 * behaviour. They are derived from the existing session descriptions, not from
 * unshipped audio scripts. Keep the vocabularies small so two Sleep cards can
 * differ without inventing a unique technique for every title.
 */
export const SESSION_METHODS = ['breath', 'body', 'attention', 'presence', 'reflection'] as const;
export type SessionMethod = (typeof SESSION_METHODS)[number];

export const SESSION_GUIDANCE_LEVELS = ['fading', 'guided', 'light'] as const;
export type SessionGuidanceLevel = (typeof SESSION_GUIDANCE_LEVELS)[number];

export type SessionPracticeMeta = {
  method: SessionMethod;
  guidance: SessionGuidanceLevel;
};

const SESSION_PRACTICE = {
  'sleep-descent': { method: 'breath', guidance: 'guided' },
  'sleep-quick-fall': { method: 'breath', guidance: 'fading' },
  'sleep-body-scan': { method: 'body', guidance: 'guided' },
  'sleep-night-return': { method: 'presence', guidance: 'light' },
  'stress-shoulders': { method: 'body', guidance: 'guided' },
  'stress-unclench': { method: 'body', guidance: 'guided' },
  'stress-day-close': { method: 'reflection', guidance: 'guided' },
  'stress-storm': { method: 'presence', guidance: 'light' },
  'focus-morning': { method: 'attention', guidance: 'light' },
  'focus-one-thing': { method: 'breath', guidance: 'guided' },
  'focus-thread': { method: 'breath', guidance: 'fading' },
  'focus-deep': { method: 'attention', guidance: 'guided' },
  'anxiety-ground': { method: 'body', guidance: 'light' },
  'anxiety-wave': { method: 'presence', guidance: 'guided' },
  'anxiety-chest': { method: 'breath', guidance: 'guided' },
  'anxiety-evening': { method: 'presence', guidance: 'light' },
  'gratitude-three': { method: 'reflection', guidance: 'light' },
  'gratitude-people': { method: 'reflection', guidance: 'guided' },
  'gratitude-ordinary': { method: 'reflection', guidance: 'guided' },
  'gratitude-year': { method: 'reflection', guidance: 'guided' },
  'dream-threshold': { method: 'presence', guidance: 'light' },
  'dream-recall': { method: 'reflection', guidance: 'light' },
  'dream-question': { method: 'reflection', guidance: 'light' },
  'dream-lucid': { method: 'attention', guidance: 'guided' },
} as const satisfies Record<string, SessionPracticeMeta>;

export type CatalogueSessionId = keyof typeof SESSION_PRACTICE;

export const SESSION_PRACTICE_BY_ID: Record<CatalogueSessionId, SessionPracticeMeta> =
  SESSION_PRACTICE;

export const getSessionPractice = (id: SessionId): SessionPracticeMeta => {
  const practice = SESSION_PRACTICE[id as CatalogueSessionId];
  if (!practice) {
    throw new Error(`Missing method/guidance metadata for session ${id}`);
  }
  return practice;
};

export const catalogueSessionIds = (): CatalogueSessionId[] =>
  SESSIONS.map((session) => session.id as CatalogueSessionId);

for (const session of SESSIONS) {
  if (!(session.id in SESSION_PRACTICE)) {
    throw new Error(`Missing method/guidance metadata for session ${session.id}`);
  }
}

const CATALOGUE_IDS = new Set(SESSIONS.map((session) => session.id));
for (const id of Object.keys(SESSION_PRACTICE)) {
  if (!CATALOGUE_IDS.has(id)) {
    throw new Error(`Unexpected method/guidance metadata for session ${id}`);
  }
}
