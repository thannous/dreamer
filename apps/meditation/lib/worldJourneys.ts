import { SESSION_BY_ID, SESSIONS } from '@/content/sessions';
import {
  WORLD_BY_ID,
  type WorldId,
  type WorldJourneyStageId,
} from '@/constants/worlds';
import { sessionsMatchingIntention, stableIndex, type ResumableSession } from '@/lib/library';
import {
  RESUME_MAX_RATIO,
  RESUME_MIN_RATIO,
  type DailyIntention,
  type MeditationSession,
  type PracticeGoal,
  type SessionId,
  type SessionProgress,
} from '@/lib/types';

export type WorldJourneyState = {
  index: number;
  stageId: WorldJourneyStageId;
  session: MeditationSession;
};

/** The three curated practices are the world journey, in editorial order. */
export function sessionsForWorld(worldId: WorldId): MeditationSession[] {
  return WORLD_BY_ID[worldId].personality.progression.map(
    ({ sessionId }) => SESSION_BY_ID[sessionId]
  );
}

export function isSessionInWorldJourney(worldId: WorldId, sessionId: SessionId): boolean {
  return WORLD_BY_ID[worldId].personality.progression.some(
    (step) => step.sessionId === sessionId
  );
}

/** A one-time world purchase includes its three curated practices. */
export function isSessionIncludedInOwnedWorld(
  worldId: WorldId,
  sessionId: SessionId,
  isWorldOwned: (id: WorldId) => boolean
): boolean {
  const world = WORLD_BY_ID[worldId];
  return (
    world.access === 'purchase' &&
    isWorldOwned(worldId) &&
    isSessionInWorldJourney(worldId, sessionId)
  );
}

/** Current editorial step: the first practice not yet completed once. */
export function journeyStateForWorld(
  worldId: WorldId,
  progress: Record<SessionId, SessionProgress>
): WorldJourneyState {
  const progression = WORLD_BY_ID[worldId].personality.progression;
  const nextIndex = progression.findIndex(
    ({ sessionId }) => (progress[sessionId]?.completedCount ?? 0) === 0
  );
  const index = nextIndex === -1 ? progression.length - 1 : nextIndex;
  const step = progression[index];

  return {
    index,
    stageId: step.id,
    session: SESSION_BY_ID[step.sessionId],
  };
}

/**
 * Once the three-step path is complete, keep the recommendation fresh while
 * staying inside the world's curated lane.
 */
export function sessionOfTheDayForWorld(
  worldId: WorldId,
  dateISO: string
): MeditationSession {
  const sessions = sessionsForWorld(worldId);
  return sessions[stableIndex(`${worldId}:${dateISO}`, sessions.length)];
}

export type HomeRecommendationPreference = {
  goals?: PracticeGoal[];
  dailyIntentionMin?: DailyIntention | null;
  /**
   * Purchased worlds keep their curated path. When no world practice fits the
   * chosen duration, the editorial step stays and the UI can explain the
   * fallback instead of reaching into the global catalogue.
   */
  lockToWorld?: boolean;
};

export type HomeRecommendationReason = 'goal' | 'duration' | 'goal-duration' | 'editorial';

export type HomeRecommendation = {
  session: MeditationSession;
  reason: HomeRecommendationReason;
  matchedGoal: PracticeGoal | null;
  source: 'world' | 'catalogue';
};

/** The path step drives the main CTA until all three practices are complete. */
export function recommendedSessionForWorld(
  worldId: WorldId,
  dateISO: string,
  progress: Record<SessionId, SessionProgress>,
  isPlayable?: (session: MeditationSession) => boolean,
  preference?: HomeRecommendationPreference
): MeditationSession {
  return homeRecommendationForWorld(worldId, dateISO, progress, isPlayable, preference).session;
}

/**
 * Prefer a playable world practice that matches onboarding goals and duration.
 * If the world has nothing that fits the chosen pause, a free world may take a
 * playable catalogue session of the same duration. Purchased worlds stay locked
 * to their path and fall back to editorial order.
 */
export function homeRecommendationForWorld(
  worldId: WorldId,
  dateISO: string,
  progress: Record<SessionId, SessionProgress>,
  isPlayable?: (session: MeditationSession) => boolean,
  preference?: HomeRecommendationPreference
): HomeRecommendation {
  const worldSessions = sessionsForWorld(worldId);
  const editorial = editorialSessionForWorld(worldId, dateISO, progress);
  const playableWorld = isPlayable ? worldSessions.filter(isPlayable) : worldSessions;
  const preferredWorld = preferredSessionFromPool(
    playableWorld,
    dateISO,
    progress,
    preference,
    'world'
  );

  if (preferredWorld) return preferredWorld;

  if (!preference?.lockToWorld) {
    const cataloguePool = isPlayable ? SESSIONS.filter(isPlayable) : SESSIONS;
    const preferredCatalogue = preferredSessionFromPool(
      cataloguePool,
      dateISO,
      progress,
      preference,
      'catalogue',
      { requireDurationFit: true }
    );
    if (preferredCatalogue) return preferredCatalogue;
  }

  if (!isPlayable || isPlayable(editorial) || playableWorld.length === 0) {
    return recommendationFromSession(editorial, preference, 'world');
  }

  const incompletePlayable = playableWorld.filter(
    ({ id }) => (progress[id]?.completedCount ?? 0) === 0
  );
  return recommendationFromSession(incompletePlayable[0] ?? playableWorld[0], preference, 'world');
}

function editorialSessionForWorld(
  worldId: WorldId,
  dateISO: string,
  progress: Record<SessionId, SessionProgress>
): MeditationSession {
  const progression = WORLD_BY_ID[worldId].personality.progression;
  const hasIncompleteStep = progression.some(
    ({ sessionId }) => (progress[sessionId]?.completedCount ?? 0) === 0
  );

  return hasIncompleteStep
    ? journeyStateForWorld(worldId, progress).session
    : sessionOfTheDayForWorld(worldId, dateISO);
}

function preferredSessionFromPool(
  pool: MeditationSession[],
  dateISO: string,
  progress: Record<SessionId, SessionProgress>,
  preference: HomeRecommendationPreference | undefined,
  source: 'world' | 'catalogue',
  options: { requireDurationFit?: boolean } = {}
): HomeRecommendation | null {
  const goals = preference?.goals ?? [];
  const dailyIntentionMin = preference?.dailyIntentionMin ?? null;
  if (!pool.length || (!goals.length && dailyIntentionMin == null)) return null;

  const matchingGoals = goals.length
    ? pool.filter((session) => goals.includes(session.categorySlug))
    : [];
  const matchingDuration = sessionsMatchingIntention(pool, dailyIntentionMin);
  const matchingBoth = sessionsMatchingIntention(matchingGoals, dailyIntentionMin);
  const requireDuration = Boolean(options.requireDurationFit || dailyIntentionMin != null);

  const candidates = matchingBoth.length
    ? matchingBoth
    : matchingDuration.length
      ? matchingDuration
      : requireDuration
        ? []
        : matchingGoals;
  if (!candidates.length) return null;

  const incomplete = candidates.filter(
    ({ id }) => (progress[id]?.completedCount ?? 0) === 0
  );
  const ranked = incomplete.length ? incomplete : candidates;
  const ordered = [...ranked].sort((a, b) => a.id.localeCompare(b.id));
  const session = ordered[stableIndex(`pref:${dateISO}`, ordered.length)];
  return recommendationFromSession(session, preference, source);
}

function recommendationFromSession(
  session: MeditationSession,
  preference: HomeRecommendationPreference | undefined,
  source: 'world' | 'catalogue'
): HomeRecommendation {
  const goals = preference?.goals ?? [];
  const matchedGoal = goals.includes(session.categorySlug) ? session.categorySlug : null;
  const fitsDuration =
    preference?.dailyIntentionMin != null &&
    session.durationSec <= preference.dailyIntentionMin * 60;
  const reason: HomeRecommendationReason =
    matchedGoal && fitsDuration
      ? 'goal-duration'
      : matchedGoal
        ? 'goal'
        : fitsDuration
          ? 'duration'
          : 'editorial';

  return {
    session,
    reason,
    matchedGoal,
    source,
  };
}

/** Later steps stay in editorial order; no unrelated fourth category item. */
export function upcomingSessionsForWorld(
  worldId: WorldId,
  activeSessionId: SessionId,
  progress: Record<SessionId, SessionProgress> = {},
  count: number = 3
): MeditationSession[] {
  const sessions = sessionsForWorld(worldId);
  const activeIndex = sessions.findIndex(({ id }) => id === activeSessionId);
  const ordered =
    activeIndex === -1
      ? sessions
      : [...sessions.slice(activeIndex + 1), ...sessions.slice(0, activeIndex)];

  const candidates = ordered.filter(({ id }) => id !== activeSessionId);
  const incomplete = candidates.filter(
    ({ id }) => (progress[id]?.completedCount ?? 0) === 0
  );
  const visible = incomplete.length > 0 ? incomplete : candidates;

  return visible.slice(0, Math.max(0, count));
}

/** Resume only one of the three practices explicitly assigned to this world. */
export function resumableSessionForWorld(
  worldId: WorldId,
  progress: Record<SessionId, SessionProgress>
): ResumableSession | null {
  const worldSessionIds = new Set(sessionsForWorld(worldId).map(({ id }) => id));
  const candidates = Object.entries(progress)
    .filter(([sessionId]) => worldSessionIds.has(sessionId))
    .map(([sessionId, entry]) => ({ session: SESSION_BY_ID[sessionId], progress: entry }))
    .filter(({ session, progress: entry }) => {
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
