import { SESSIONS, SESSION_BY_ID } from '@/content/sessions';
import {
  greetingKey,
  resumableSession,
  searchSessions,
  sessionOfTheDay,
  toMinutes,
} from '@/lib/library';
import type { SessionProgress } from '@/lib/types';

const progressFor = (
  positionRatio: number,
  sessionId: string,
  lastPlayedISO: string
): SessionProgress => ({
  positionSec: Math.round(SESSION_BY_ID[sessionId].durationSec * positionRatio),
  completedCount: 0,
  lastPlayedISO,
});

describe('sessionOfTheDay', () => {
  it('returns the same session for the same day and goals', () => {
    const a = sessionOfTheDay('2026-08-19', ['sleep']);
    const b = sessionOfTheDay('2026-08-19', ['sleep']);
    expect(a.id).toBe(b.id);
  });

  it('stays inside the chosen goals', () => {
    for (const date of ['2026-08-19', '2026-08-20', '2026-08-21', '2026-09-01']) {
      const session = sessionOfTheDay(date, ['gratitude']);
      expect(session.categorySlug).toBe('gratitude');
    }
  });

  it('draws from the whole catalogue when no goal was chosen', () => {
    const picks = new Set(
      Array.from({ length: 60 }, (_, day) =>
        sessionOfTheDay(`2026-08-${String((day % 28) + 1).padStart(2, '0')}`, []).categorySlug
      )
    );
    // Not a distribution test — just proof the pool is not one category.
    expect(picks.size).toBeGreaterThan(1);
  });

  it('falls back to the catalogue rather than dividing by zero on an empty pool', () => {
    // @ts-expect-error deliberately passing a goal no session carries
    const session = sessionOfTheDay('2026-08-19', ['nonexistent-goal']);
    expect(SESSIONS).toContain(session);
  });

  it('does not always return the same session across dates', () => {
    const ids = new Set(
      Array.from({ length: 30 }, (_, day) =>
        sessionOfTheDay(`2026-08-${String(day + 1).padStart(2, '0')}`, ['sleep']).id
      )
    );
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe('resumableSession', () => {
  it('returns nothing when no session was started', () => {
    expect(resumableSession({})).toBeNull();
  });

  it('ignores a session barely started', () => {
    expect(
      resumableSession({ 'sleep-descent': progressFor(0.02, 'sleep-descent', '2026-08-19') })
    ).toBeNull();
  });

  it('ignores a session all but finished', () => {
    expect(
      resumableSession({ 'sleep-descent': progressFor(0.98, 'sleep-descent', '2026-08-19') })
    ).toBeNull();
  });

  it('picks the most recently played of several', () => {
    const result = resumableSession({
      'sleep-descent': progressFor(0.4, 'sleep-descent', '2026-08-17T21:00:00.000Z'),
      'focus-deep': progressFor(0.4, 'focus-deep', '2026-08-19T21:00:00.000Z'),
    });
    expect(result?.session.id).toBe('focus-deep');
  });

  it('reports the remaining time', () => {
    const result = resumableSession({
      'sleep-descent': progressFor(0.5, 'sleep-descent', '2026-08-19'),
    });
    expect(result?.remainingSec).toBe(SESSION_BY_ID['sleep-descent'].durationSec / 2);
  });

  it('survives an id that is no longer in the catalogue', () => {
    const result = resumableSession({
      'removed-session': { positionSec: 120, completedCount: 0, lastPlayedISO: '2026-08-19' },
    });
    expect(result).toBeNull();
  });
});

describe('greetingKey', () => {
  it.each([
    [6, 'home.greeting.morning'],
    [11, 'home.greeting.morning'],
    [12, 'home.greeting.afternoon'],
    [17, 'home.greeting.afternoon'],
    [18, 'home.greeting.evening'],
    [22, 'home.greeting.evening'],
    [23, 'home.greeting.night'],
    [3, 'home.greeting.night'],
  ])('maps %i h to %s', (hour, expected) => {
    expect(greetingKey(hour)).toBe(expected);
  });
});

describe('toMinutes', () => {
  it('rounds up so a remainder is never lost', () => {
    expect(toMinutes(90)).toBe(2);
    expect(toMinutes(600)).toBe(10);
  });

  it('never returns zero', () => {
    expect(toMinutes(5)).toBe(1);
    expect(toMinutes(0)).toBe(1);
  });
});

describe('searchSessions', () => {
  const t = (key: string) => (key.endsWith('.title') ? 'Descendre le souffle' : 'sommeil');

  it('returns everything for an empty query', () => {
    expect(searchSessions('   ', t)).toHaveLength(SESSIONS.length);
  });

  it('matches case-insensitively', () => {
    expect(searchSessions('SOUFFLE', t).length).toBe(SESSIONS.length);
  });

  it('returns nothing when no field matches', () => {
    expect(searchSessions('zzzz', t)).toHaveLength(0);
  });

  it('searches only within the list it is given', () => {
    const subset = SESSIONS.slice(0, 3);
    expect(searchSessions('souffle', t, subset)).toHaveLength(3);
  });
});
