import {
  calendarDays,
  computeStats,
  computeStreak,
  computeWeekPractice,
  dailyReturnOffer,
  daysBetween,
  practiceDays,
  shiftDay,
} from '@/lib/streak';
import type { PracticeEntry } from '@/lib/types';

const entry = (dateISO: string, seconds = 600): PracticeEntry => ({ dateISO, seconds });

describe('daysBetween', () => {
  it('counts calendar days', () => {
    expect(daysBetween('2026-08-18', '2026-08-19')).toBe(1);
    expect(daysBetween('2026-08-19', '2026-08-19')).toBe(0);
  });

  it('crosses month and year boundaries', () => {
    expect(daysBetween('2026-08-31', '2026-09-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('is unaffected by a daylight-saving change', () => {
    // Europe/Paris springs forward on 2026-03-29. A 23-hour day is still a day.
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });
});

describe('computeStreak', () => {
  const today = '2026-08-19';

  it('is zero with no practice at all', () => {
    expect(computeStreak([], today)).toMatchObject({ current: 0, longest: 0 });
  });

  it('counts a single day practised today', () => {
    expect(computeStreak([entry(today)], today)).toMatchObject({
      current: 1,
      practisedToday: true,
    });
  });

  it('counts consecutive days', () => {
    const log = [entry('2026-08-17'), entry('2026-08-18'), entry(today)];
    expect(computeStreak(log, today).current).toBe(3);
  });

  /** The acceptance criterion: one increment per LOCAL calendar day. */
  it('does not increment twice for two practices on the same day', () => {
    const log = [entry(today), entry(today), entry(today)];
    expect(computeStreak(log, today).current).toBe(1);
  });

  it('stays alive when today has not been practised yet', () => {
    // The day is not over — an unpractised today is not a broken streak.
    const log = [entry('2026-08-17'), entry('2026-08-18')];
    const streak = computeStreak(log, today);

    expect(streak.current).toBe(2);
    expect(streak.practisedToday).toBe(false);
  });

  /** The other half of the criterion: it breaks after a missed day. */
  it('breaks once a whole day has been missed', () => {
    const log = [entry('2026-08-16'), entry('2026-08-17')];
    expect(computeStreak(log, today).current).toBe(0);
  });

  it('restarts from a practice today after a gap', () => {
    const log = [entry('2026-08-10'), entry('2026-08-11'), entry(today)];
    expect(computeStreak(log, today).current).toBe(1);
  });

  it('remembers the longest run even after it is broken', () => {
    const log = [
      entry('2026-08-01'),
      entry('2026-08-02'),
      entry('2026-08-03'),
      entry('2026-08-04'),
      entry(today),
    ];
    const streak = computeStreak(log, today);

    expect(streak.current).toBe(1);
    expect(streak.longest).toBe(4);
  });

  it('never reports a longest shorter than the current', () => {
    const log = [entry('2026-08-18'), entry(today)];
    const streak = computeStreak(log, today);
    expect(streak.longest).toBeGreaterThanOrEqual(streak.current);
  });

  it('handles an unsorted log', () => {
    const log = [entry(today), entry('2026-08-17'), entry('2026-08-18')];
    expect(computeStreak(log, today).current).toBe(3);
  });
});

describe('computeStats', () => {
  it('sums minutes and counts practices', () => {
    const stats = computeStats([entry('2026-08-18', 600), entry('2026-08-19', 300)]);
    expect(stats).toMatchObject({ totalSessions: 2, totalMinutes: 15, totalDays: 2 });
  });

  it('counts two practices on one day as one day', () => {
    const stats = computeStats([entry('2026-08-19', 60), entry('2026-08-19', 60)]);
    expect(stats.totalSessions).toBe(2);
    expect(stats.totalDays).toBe(1);
  });

  it('ignores a negative duration rather than subtracting time', () => {
    expect(computeStats([entry('2026-08-19', -600)]).totalMinutes).toBe(0);
  });
});

describe('calendarDays', () => {
  it('ends on today', () => {
    const days = calendarDays([], '2026-08-19');
    expect(days[days.length - 1]).toMatchObject({ day: '2026-08-19', isToday: true });
  });

  it('starts on a Monday so the rows line up', () => {
    const days = calendarDays([], '2026-08-19');
    const [y, m, d] = days[0].day.split('-').map(Number);
    expect(new Date(Date.UTC(y, m - 1, d)).getUTCDay()).toBe(1);
  });

  it('marks the days that were practised', () => {
    const days = calendarDays([entry('2026-08-18')], '2026-08-19');
    expect(days.find((day) => day.day === '2026-08-18')?.practised).toBe(true);
    expect(days.find((day) => day.day === '2026-08-17')?.practised).toBe(false);
  });
});

describe('shiftDay', () => {
  it('moves forwards and backwards across a month boundary', () => {
    expect(shiftDay('2026-08-31', 1)).toBe('2026-09-01');
    expect(shiftDay('2026-09-01', -1)).toBe('2026-08-31');
  });
});

describe('practiceDays', () => {
  it('dedupes and sorts most recent first', () => {
    expect(practiceDays([entry('2026-08-17'), entry('2026-08-19'), entry('2026-08-17')])).toEqual([
      '2026-08-19',
      '2026-08-17',
    ]);
  });
});

describe('computeWeekPractice', () => {
  it('counts only this week practised days and minutes', () => {
    const week = computeWeekPractice(
      [
        entry('2026-08-17', 600),
        entry('2026-08-18', 300),
        entry('2026-08-19', 600),
        entry('2026-08-10', 1200),
      ],
      '2026-08-19'
    );

    expect(week).toEqual({ practisedDays: 3, minutes: 25 });
  });

  it('ignores a later day rather than inventing a deficit', () => {
    expect(computeWeekPractice([entry('2026-08-24')], '2026-08-19')).toEqual({
      practisedDays: 0,
      minutes: 0,
    });
  });
});

describe('dailyReturnOffer', () => {
  it('prefers the most recent practised session over a saved one', () => {
    const offer = dailyReturnOffer(
      [entry('2026-08-18'), { dateISO: '2026-08-19', sessionId: 'sleep-descent', seconds: 600 }],
      ['sleep-body-scan']
    );

    expect(offer).toMatchObject({ kind: 'recent', session: { id: 'sleep-descent' } });
  });

  it('falls back to a saved session when the log has no session id', () => {
    const offer = dailyReturnOffer([entry('2026-08-19')], ['sleep-body-scan']);
    expect(offer).toMatchObject({ kind: 'saved', session: { id: 'sleep-body-scan' } });
  });

  it('returns nothing when there is no familiar session to reopen', () => {
    expect(dailyReturnOffer([], [])).toBeNull();
  });
});
