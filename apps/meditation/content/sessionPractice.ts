import type { SessionId } from '@/lib/types';

import { SESSIONS } from './sessions';

/**
 * The method is editorial metadata for SessionCard, not player behaviour: it
 * names what the listener practises during the ambience. Sessions have no
 * spoken guidance in v1, so the card must not describe a guidance level.
 */
export const SESSION_METHODS = ['breath', 'body', 'attention', 'presence', 'reflection'] as const;
export type SessionMethod = (typeof SESSION_METHODS)[number];

export type SessionPracticeMeta = {
  method: SessionMethod;
};

const SESSION_PRACTICE = {
  'sleep-descent': { method: 'breath' },
  'sleep-quick-fall': { method: 'breath' },
  'sleep-body-scan': { method: 'body' },
  'sleep-night-return': { method: 'presence' },
  'stress-shoulders': { method: 'body' },
  'stress-unclench': { method: 'body' },
  'stress-day-close': { method: 'reflection' },
  'stress-storm': { method: 'presence' },
  'focus-morning': { method: 'attention' },
  'focus-one-thing': { method: 'breath' },
  'focus-thread': { method: 'breath' },
  'focus-deep': { method: 'attention' },
  'anxiety-ground': { method: 'body' },
  'anxiety-wave': { method: 'presence' },
  'anxiety-chest': { method: 'breath' },
  'anxiety-evening': { method: 'presence' },
  'gratitude-three': { method: 'reflection' },
  'gratitude-people': { method: 'reflection' },
  'gratitude-ordinary': { method: 'reflection' },
  'gratitude-year': { method: 'reflection' },
  'dream-threshold': { method: 'presence' },
  'dream-recall': { method: 'reflection' },
  'dream-question': { method: 'reflection' },
  'dream-lucid': { method: 'attention' },
} as const satisfies Record<string, SessionPracticeMeta>;

export type CatalogueSessionId = keyof typeof SESSION_PRACTICE;

export const SESSION_PRACTICE_BY_ID: Record<CatalogueSessionId, SessionPracticeMeta> =
  SESSION_PRACTICE;

export const getSessionPractice = (id: SessionId): SessionPracticeMeta => {
  const practice = SESSION_PRACTICE[id as CatalogueSessionId];
  if (!practice) {
    throw new Error(`Missing method metadata for session ${id}`);
  }
  return practice;
};

export const catalogueSessionIds = (): CatalogueSessionId[] =>
  SESSIONS.map((session) => session.id as CatalogueSessionId);

for (const session of SESSIONS) {
  if (!(session.id in SESSION_PRACTICE)) {
    throw new Error(`Missing method metadata for session ${session.id}`);
  }
}

const CATALOGUE_IDS = new Set(SESSIONS.map((session) => session.id));
for (const id of Object.keys(SESSION_PRACTICE)) {
  if (!CATALOGUE_IDS.has(id)) {
    throw new Error(`Unexpected method metadata for session ${id}`);
  }
}
