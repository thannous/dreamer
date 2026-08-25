import {
  canAccessLucidSession,
  evaluateLucidSessionAccess,
  getLucidSequentialSessionCursor,
} from '@/lib/lucid/safety';

describe('Lucid session access policy', () => {
  const progress = {
    currentDay: 3,
    completedExerciseIds: ['mild-01', 'mild-02'],
  };

  it('keeps the current sequential session open even if the calendar still says upcoming', () => {
    expect(
      evaluateLucidSessionAccess({
        sessionNumber: 3,
        sessionCount: 7,
        exerciseId: 'mild-03',
        progress,
        calendarStatus: 'upcoming',
      })
    ).toEqual({ allowed: true, reason: 'current' });
  });

  it('reopens a completed session and blocks a later sequential session', () => {
    expect(
      evaluateLucidSessionAccess({
        sessionNumber: 1,
        sessionCount: 7,
        exerciseId: 'mild-01',
        progress,
        calendarStatus: 'upcoming',
      })
    ).toEqual({ allowed: true, reason: 'completed' });

    expect(
      evaluateLucidSessionAccess({
        sessionNumber: 4,
        sessionCount: 7,
        exerciseId: 'mild-04',
        progress,
        calendarStatus: 'available',
      })
    ).toEqual({ allowed: false, reason: 'sequential_lock' });
  });

  it('does not treat a recommended calendar date as a sequential lock', () => {
    expect(
      canAccessLucidSession({
        sessionNumber: 1,
        sessionCount: 7,
        exerciseId: 'mild-01',
        progress: { currentDay: 1, completedExerciseIds: [] },
        calendarStatus: 'upcoming',
      })
    ).toBe(true);
    expect(getLucidSequentialSessionCursor(undefined)).toBe(1);
  });

  it('rejects an out-of-range session number', () => {
    expect(
      evaluateLucidSessionAccess({
        sessionNumber: 8,
        sessionCount: 7,
        progress,
      })
    ).toEqual({ allowed: false, reason: 'invalid' });
  });
});
