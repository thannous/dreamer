import { SESSIONS } from '@/content/sessions';
import { sessionOfTheDay, upcomingSessions, UPCOMING_JOURNEY_COUNT } from '@/lib/library';
import { shiftDay } from '@/lib/streak';
import type { PracticeGoal, SessionId } from '@/lib/types';

const DATE = '2026-08-19';
const GOALS: PracticeGoal[] = ['sleep'];

function expectedUpcoming(
  dateISO: string,
  goals: PracticeGoal[],
  activeSessionId: SessionId,
  count = UPCOMING_JOURNEY_COUNT
): SessionId[] {
  const seen = new Set<SessionId>([activeSessionId]);
  const ids: SessionId[] = [];
  const maxOffset = SESSIONS.length + Math.max(count, 1);

  for (let offset = 1; offset <= maxOffset && ids.length < count; offset += 1) {
    const session = sessionOfTheDay(shiftDay(dateISO, offset), goals);
    if (seen.has(session.id)) continue;
    seen.add(session.id);
    ids.push(session.id);
  }

  return ids;
}

describe('upcomingSessions', () => {
  it('is deterministic for the same day, goals and active session', () => {
    const active = sessionOfTheDay(DATE, GOALS).id;
    const a = upcomingSessions(DATE, GOALS, active);
    const b = upcomingSessions(DATE, GOALS, active);
    expect(a.map((session) => session.id)).toEqual(b.map((session) => session.id));
    expect(a.map((session) => session.id)).toEqual(expectedUpcoming(DATE, GOALS, active));
  });

  it('excludes the active session even when a later day would recommend it', () => {
    const active = sessionOfTheDay(DATE, GOALS);
    const results = upcomingSessions(DATE, GOALS, active.id);
    expect(results.map((session) => session.id)).not.toContain(active.id);
    expect(results).toHaveLength(UPCOMING_JOURNEY_COUNT);
  });

  it('returns unique sessions and never more than the default of 3', () => {
    const active = sessionOfTheDay(DATE, []).id;
    const results = upcomingSessions(DATE, [], active);
    const ids = results.map((session) => session.id);
    expect(ids).toHaveLength(new Set(ids).size);
    expect(ids.length).toBeLessThanOrEqual(3);
    expect(ids).toHaveLength(3);
  });

  it('honours an explicit count', () => {
    const active = sessionOfTheDay(DATE, GOALS).id;
    expect(upcomingSessions(DATE, GOALS, active, 1)).toHaveLength(1);
    expect(upcomingSessions(DATE, GOALS, active, 2)).toHaveLength(2);
    expect(upcomingSessions(DATE, GOALS, active, 0)).toHaveLength(0);
  });

  it('stays inside the chosen goals', () => {
    const goals: PracticeGoal[] = ['gratitude'];
    const active = sessionOfTheDay(DATE, goals).id;
    for (const session of upcomingSessions(DATE, goals, active)) {
      expect(session.categorySlug).toBe('gratitude');
    }
  });

  it('falls back to the whole catalogue when no goal was chosen', () => {
    const active = sessionOfTheDay(DATE, []).id;
    const picks = new Set(
      upcomingSessions(DATE, [], active, 8).map((session) => session.categorySlug)
    );
    expect(picks.size).toBeGreaterThan(1);
  });

  it('falls back to the catalogue when the goal pool is empty', () => {
    const goals = ['nonexistent-goal'] as unknown as PracticeGoal[];
    const active = sessionOfTheDay(DATE, goals).id;
    const results = upcomingSessions(DATE, goals, active);
    expect(results).toHaveLength(UPCOMING_JOURNEY_COUNT);
    for (const session of results) {
      expect(SESSIONS).toContain(session);
    }
  });

  it('skips colliding days and still fills the requested count', () => {
    const goals: PracticeGoal[] = ['gratitude'];
    let date = DATE;
    let collisionOffset = 0;
    let activeId: SessionId | null = null;

    for (let start = 0; start < 60 && collisionOffset === 0; start += 1) {
      date = shiftDay(DATE, start);
      const active = sessionOfTheDay(date, goals);
      for (let offset = 1; offset <= SESSIONS.length; offset += 1) {
        if (sessionOfTheDay(shiftDay(date, offset), goals).id === active.id) {
          collisionOffset = offset;
          activeId = active.id;
          break;
        }
      }
    }

    expect(activeId).not.toBeNull();
    expect(collisionOffset).toBeGreaterThan(0);

    const results = upcomingSessions(date, goals, activeId as SessionId);
    const ids = results.map((session) => session.id);
    expect(ids).not.toContain(activeId);
    expect(ids).toHaveLength(UPCOMING_JOURNEY_COUNT);
    expect(ids).toEqual(expectedUpcoming(date, goals, activeId as SessionId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('walks past duplicate future recommendations to keep uniqueness', () => {
    const goals: PracticeGoal[] = ['sleep'];
    let date = DATE;
    let duplicatePair: [number, number] | null = null;

    for (let start = 0; start < 40 && !duplicatePair; start += 1) {
      date = shiftDay(DATE, start);
      const seen = new Map<SessionId, number>();
      for (let offset = 1; offset <= 20; offset += 1) {
        const id = sessionOfTheDay(shiftDay(date, offset), goals).id;
        const previous = seen.get(id);
        if (previous !== undefined) {
          duplicatePair = [previous, offset];
          break;
        }
        seen.set(id, offset);
      }
    }

    expect(duplicatePair).not.toBeNull();
    const active = sessionOfTheDay(date, goals).id;
    const ids = upcomingSessions(date, goals, active).map((session) => session.id);
    expect(ids).toHaveLength(new Set(ids).size);
    expect(ids).toHaveLength(UPCOMING_JOURNEY_COUNT);
  });
});
