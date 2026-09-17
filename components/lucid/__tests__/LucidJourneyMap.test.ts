import {
  buildLucidJourneyDays,
  canOpenLucidJourneySession,
  shouldUseLucidJourneyReflow,
  type LucidJourneyDay,
  type LucidJourneyStatus,
} from '@/components/lucid/LucidJourneyMap';
import { getLucidContent } from '@/lib/lucid/content';

jest.mock('expo-image', () => ({ Image: 'Image' }));

const sessions = getLucidContent('en').programs.mild.sessions;

function journeyDay(status: LucidJourneyStatus): LucidJourneyDay {
  return { session: sessions[0], status };
}

describe('LucidJourneyMap progress states', () => {
  it('does not invent completed sessions before the program starts', () => {
    const days = buildLucidJourneyDays({
      sessions,
      completedExerciseIds: [],
      currentDay: 1,
      started: false,
    });

    expect(days.map((day) => day.status)).toEqual([
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
    expect(canOpenLucidJourneySession(days[0], 0)).toBe(false);
  });

  it('distinguishes completed, current and upcoming sessions from stored progress', () => {
    const days = buildLucidJourneyDays({
      sessions,
      completedExerciseIds: ['mild-01', 'mild-02'],
      currentDay: 3,
      started: true,
    });

    expect(days.map((day) => day.status)).toEqual([
      'completed',
      'completed',
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
    expect(canOpenLucidJourneySession(days[2], 3)).toBe(true);
    expect(canOpenLucidJourneySession(days[3], 3)).toBe(false);
  });

  it.each([
    ['completed', true, true],
    ['available', true, true],
    ['current', true, true],
    ['current', false, false],
    ['upcoming', true, false],
  ] as const)('makes a %s session when started=%s openable: %s', (status, started, expected) => {
    expect(canOpenLucidJourneySession(journeyDay(status), started)).toBe(expected);
  });

  it('keeps only completed sessions open while training is paused', () => {
    expect(canOpenLucidJourneySession(journeyDay('completed'), true, false)).toBe(true);
    expect(canOpenLucidJourneySession(journeyDay('available'), true, false)).toBe(false);
    expect(canOpenLucidJourneySession(journeyDay('current'), true, false)).toBe(false);
    expect(canOpenLucidJourneySession(journeyDay('upcoming'), true, false)).toBe(false);
  });

  it.each([
    [360, 1, true],
    [390, 1.3, true],
    [390, 1, false],
  ] as const)('uses reflow at width %i and font scale %s: %s', (width, fontScale, expected) => {
    expect(shouldUseLucidJourneyReflow(width, fontScale)).toBe(expected);
  });

  it('keeps a missed earlier session available instead of pretending it is done', () => {
    const days = buildLucidJourneyDays({
      sessions,
      completedExerciseIds: ['mild-01'],
      currentDay: 3,
      started: true,
    });

    expect(days[1].status).toBe('available');
    expect(days[2].status).toBe('current');
  });

  it('bounds malformed current-day values without unlocking the journey', () => {
    const days = buildLucidJourneyDays({
      sessions,
      completedExerciseIds: [],
      currentDay: 99,
      started: true,
    });

    expect(days.at(-1)?.status).toBe('current');
    expect(days.slice(0, -1).every((day) => day.status === 'available')).toBe(true);
  });

  it('bounds a non-positive current day to session one', () => {
    const days = buildLucidJourneyDays({
      sessions,
      completedExerciseIds: [],
      currentDay: 0,
      started: true,
    });

    expect(days[0].status).toBe('current');
    expect(days.slice(1).every((day) => day.status === 'upcoming')).toBe(true);
  });
});
