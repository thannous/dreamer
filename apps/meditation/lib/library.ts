import { SESSION_BY_ID, SESSIONS } from '@/content/sessions';
import {
  RESUME_MAX_RATIO,
  RESUME_MIN_RATIO,
  type MeditationSession,
  type PracticeGoal,
  type SessionId,
  type SessionProgress,
} from '@/lib/types';

/**
 * Pure selection logic for the library. Kept out of the components so the rules
 * that decide what a user is shown can be tested without rendering anything.
 */

/** Stable 32-bit string hash. Same input, same session, on every device. */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * The session of the day.
 *
 * Deterministic by date, so it does not change under the user between two
 * openings, and drawn from the categories they chose during onboarding — with
 * the whole catalogue as the pool if they chose none. Premium sessions stay in
 * the pool: the recommendation is also where a free user meets Noctalia Plus.
 */
export function sessionOfTheDay(dateISO: string, goals: PracticeGoal[]): MeditationSession {
  const pool = goals.length
    ? SESSIONS.filter((session) => goals.includes(session.categorySlug))
    : SESSIONS;

  // A goal set with no sessions would divide by zero; fall back to everything.
  const candidates = pool.length ? pool : SESSIONS;
  const ordered = [...candidates].sort((a, b) => a.id.localeCompare(b.id));

  return ordered[hash(dateISO) % ordered.length];
}

export type ResumableSession = {
  session: MeditationSession;
  progress: SessionProgress;
  remainingSec: number;
};

/**
 * The session worth offering to resume: started, not finished, most recently
 * played. Below 5% there is nothing to come back to; above 95% it is done.
 */
export function resumableSession(
  progress: Record<SessionId, SessionProgress>
): ResumableSession | null {
  const candidates = Object.entries(progress)
    .map(([id, entry]) => ({ session: SESSION_BY_ID[id], progress: entry }))
    .filter(({ session, progress: entry }) => {
      if (!session) return false; // A session removed from the catalogue since.
      const ratio = entry.positionSec / session.durationSec;
      return ratio >= RESUME_MIN_RATIO && ratio <= RESUME_MAX_RATIO;
    })
    .sort((a, b) => b.progress.lastPlayedISO.localeCompare(a.progress.lastPlayedISO));

  const best = candidates[0];
  if (!best) return null;

  return {
    session: best.session,
    progress: best.progress,
    remainingSec: Math.max(0, best.session.durationSec - best.progress.positionSec),
  };
}

export type GreetingKey =
  | 'home.greeting.morning'
  | 'home.greeting.afternoon'
  | 'home.greeting.evening'
  | 'home.greeting.night';

/** The evening greeting matters most: this app is used after dark. */
export function greetingKey(hour: number): GreetingKey {
  if (hour >= 5 && hour < 12) return 'home.greeting.morning';
  if (hour >= 12 && hour < 18) return 'home.greeting.afternoon';
  if (hour >= 18 && hour < 23) return 'home.greeting.evening';
  return 'home.greeting.night';
}

/** Rounds up: a 90-second remainder is "2 min", never "1 min". */
export const toMinutes = (seconds: number): number => Math.max(1, Math.ceil(seconds / 60));

/**
 * Free-text search over translated titles and descriptions. The catalogue is 24
 * items, so a linear scan is the right amount of machinery.
 */
export function searchSessions(
  query: string,
  translate: (key: string) => string,
  sessions: MeditationSession[] = SESSIONS
): MeditationSession[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return sessions;

  return sessions.filter((session) => {
    const haystack = [
      translate(`session.${session.id}.title`),
      translate(`session.${session.id}.description`),
      translate(`category.${session.categorySlug}.name`),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(needle);
  });
}
