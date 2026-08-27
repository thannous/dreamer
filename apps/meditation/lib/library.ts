import { SESSION_BY_ID, SESSIONS } from '@/content/sessions';
import { shiftDay } from '@/lib/streak';
import {
  RESUME_MAX_RATIO,
  RESUME_MIN_RATIO,
  type DailyIntention,
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

/** Stable bounded index shared by deterministic editorial selectors. */
export function stableIndex(value: string, length: number): number {
  if (length <= 0) return 0;
  return hash(value) % length;
}

/**
 * The session of the day.
 *
 * Deterministic by date, so it does not change under the user between two
 * openings, and drawn from the categories they chose during onboarding — with
 * the whole catalogue as the pool if they chose none. Premium sessions stay in
 * the pool: the recommendation is also where a free user meets Noctalia Plus.
 */
export function sessionOfTheDay(
  dateISO: string,
  goals: PracticeGoal[],
  dailyIntentionMin?: DailyIntention | null
): MeditationSession {
  const pool = goals.length
    ? SESSIONS.filter((session) => goals.includes(session.categorySlug))
    : SESSIONS;

  // A goal set with no sessions would divide by zero; fall back to everything.
  const candidates = pool.length ? pool : SESSIONS;
  const preferred = sessionsMatchingIntention(candidates, dailyIntentionMin);
  const poolForDay = preferred.length ? preferred : candidates;
  const ordered = [...poolForDay].sort((a, b) => a.id.localeCompare(b.id));

  return ordered[stableIndex(dateISO, ordered.length)];
}

/** Keep the daily intention honest: never recommend a practice longer than the chosen pause. */
export function sessionsMatchingIntention(
  sessions: MeditationSession[],
  dailyIntentionMin?: DailyIntention | null
): MeditationSession[] {
  if (dailyIntentionMin == null) return sessions;

  const maxSec = dailyIntentionMin * 60;
  return sessions.filter((session) => session.durationSec <= maxSec);
}

export const UPCOMING_JOURNEY_COUNT = 3;

/**
 * The next practices after today, derived from the same daily recommendation
 * used on Home — never a slice of the catalogue.
 *
 * Walks tomorrow, the day after, then further local days until `count` unique
 * sessions are found or the catalogue is exhausted. The active session is
 * excluded so "up next" cannot repeat what the large card already offers.
 */
export function upcomingSessions(
  dateISO: string,
  goals: PracticeGoal[],
  activeSessionId: SessionId,
  count: number = UPCOMING_JOURNEY_COUNT
): MeditationSession[] {
  const limit = Math.max(0, count);
  const seen = new Set<SessionId>([activeSessionId]);
  const results: MeditationSession[] = [];
  const maxOffset = SESSIONS.length + Math.max(limit, 1);

  for (let offset = 1; offset <= maxOffset && results.length < limit; offset += 1) {
    const day = shiftDay(dateISO, offset);
    const session = sessionOfTheDay(day, goals);
    if (seen.has(session.id)) continue;
    seen.add(session.id);
    results.push(session);
  }

  return results;
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
