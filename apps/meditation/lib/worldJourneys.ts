import { SESSION_BY_ID } from '@/content/sessions';
import {
  WORLD_BY_ID,
  type WorldId,
  type WorldJourneyStageId,
} from '@/constants/worlds';
import { stableIndex, type ResumableSession } from '@/lib/library';
import {
  RESUME_MAX_RATIO,
  RESUME_MIN_RATIO,
  type MeditationSession,
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

/** The path step drives the main CTA until all three practices are complete. */
export function recommendedSessionForWorld(
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
