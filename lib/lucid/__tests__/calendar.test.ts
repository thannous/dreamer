import {
  buildLucidProgramCalendar,
  getLucidLocalDateKey,
} from '@/lib/lucid/calendar';

describe('Lucid program calendar', () => {
  it('spaces sessions from the selected weekly rhythm without DST-sensitive milliseconds', () => {
    expect(
      buildLucidProgramCalendar({
        startDateKey: '2026-03-27',
        todayDateKey: '2026-03-29',
        sessionCount: 7,
        weeklyTarget: 3,
        completedSessionCount: 1,
      })
    ).toEqual([
      { session: 1, dateKey: '2026-03-27', status: 'completed' },
      { session: 2, dateKey: '2026-03-29', status: 'today' },
      { session: 3, dateKey: '2026-03-31', status: 'upcoming' },
      { session: 4, dateKey: '2026-04-03', status: 'upcoming' },
      { session: 5, dateKey: '2026-04-05', status: 'upcoming' },
      { session: 6, dateKey: '2026-04-07', status: 'upcoming' },
      { session: 7, dateKey: '2026-04-10', status: 'upcoming' },
    ]);
  });

  it('leaves missed sessions available rather than compressing the plan', () => {
    const calendar = buildLucidProgramCalendar({
      startDateKey: '2026-08-01',
      todayDateKey: '2026-08-10',
      sessionCount: 3,
      weeklyTarget: 2,
      completedSessionCount: 0,
    });

    expect(calendar.map((entry) => entry.status)).toEqual([
      'available',
      'available',
      'available',
    ]);
  });

  it('rejects invalid date keys and bounds', () => {
    expect(
      buildLucidProgramCalendar({
        startDateKey: '2026-02-30',
        todayDateKey: '2026-03-01',
        sessionCount: 7,
        weeklyTarget: 3,
        completedSessionCount: 0,
      })
    ).toEqual([]);
    expect(getLucidLocalDateKey(new Date(2026, 7, 13).getTime())).toBe('2026-08-13');
  });
});
