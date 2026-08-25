import {
  getLucidDayPhase,
  getLucidGuidanceProfile,
} from '@/lib/lucid/personalization';
import type {
  LucidExperienceLevel,
  LucidGoal,
  LucidSleepSchedule,
} from '@/lib/lucid/model';

const GOALS: readonly LucidGoal[] = [
  'first_lucid_dream',
  'improve_recall',
  'more_frequent_lucidity',
  'stabilize_lucidity',
];

const EXPERIENCES: readonly LucidExperienceLevel[] = [
  'beginner',
  'occasional',
  'experienced',
];

const FOCUS_BY_GOAL = {
  first_lucid_dream: 'notice',
  improve_recall: 'recall',
  more_frequent_lucidity: 'frequency',
  stabilize_lucidity: 'stability',
} as const;

const GUIDANCE_BY_EXPERIENCE = {
  beginner: 'guided',
  occasional: 'balanced',
  experienced: 'concise',
} as const;

function utcDate(isoLocal: string): Date {
  return new Date(`${isoLocal}:00.000Z`);
}

function schedule(
  bedtime: string,
  wakeTime: string,
  timeZone = 'UTC'
): LucidSleepSchedule {
  return { bedtime, wakeTime, timeZone };
}

describe('getLucidGuidanceProfile', () => {
  it('uses prudent MILD/guided/notice defaults when goal and experience are null', () => {
    expect(getLucidGuidanceProfile({ goal: null, experience: null })).toEqual({
      focus: 'notice',
      guidance: 'guided',
      recommendedTechnique: 'mild',
      cautionWbtb: true,
    });
  });

  it('keeps prudent MILD defaults when only one of the two values is missing', () => {
    expect(getLucidGuidanceProfile({ goal: null, experience: 'occasional' })).toEqual({
      focus: 'notice',
      guidance: 'balanced',
      recommendedTechnique: 'mild',
      cautionWbtb: false,
    });
    expect(getLucidGuidanceProfile({ goal: null, experience: 'experienced' })).toEqual({
      focus: 'notice',
      guidance: 'concise',
      recommendedTechnique: 'mild',
      cautionWbtb: false,
    });
    expect(getLucidGuidanceProfile({ goal: 'first_lucid_dream', experience: null })).toEqual({
      focus: 'notice',
      guidance: 'guided',
      recommendedTechnique: 'mild',
      cautionWbtb: true,
    });
    expect(getLucidGuidanceProfile({ goal: 'more_frequent_lucidity', experience: null })).toEqual({
      focus: 'frequency',
      guidance: 'guided',
      recommendedTechnique: 'mild',
      cautionWbtb: true,
    });
  });

  it.each(GOALS.flatMap((goal) => EXPERIENCES.map((experience) => [goal, experience] as const)))(
    'maps %s / %s without ever recommending WBTB',
    (goal, experience) => {
      const profile = getLucidGuidanceProfile({ goal, experience });
      const ssild = experience !== 'beginner' && goal === 'more_frequent_lucidity';

      expect(profile.focus).toBe(FOCUS_BY_GOAL[goal]);
      expect(profile.guidance).toBe(GUIDANCE_BY_EXPERIENCE[experience]);
      expect(profile.recommendedTechnique).toBe(ssild ? 'ssild' : 'mild');
      expect(profile.cautionWbtb).toBe(experience === 'beginner');
      expect(profile.recommendedTechnique).not.toBe('wbtb');
    }
  );

  it('recommends SSILD only for more frequent lucidity after the beginner stage', () => {
    expect(
      getLucidGuidanceProfile({
        goal: 'more_frequent_lucidity',
        experience: 'beginner',
      }).recommendedTechnique
    ).toBe('mild');
    expect(
      getLucidGuidanceProfile({
        goal: 'more_frequent_lucidity',
        experience: 'occasional',
      }).recommendedTechnique
    ).toBe('ssild');
    expect(
      getLucidGuidanceProfile({
        goal: 'more_frequent_lucidity',
        experience: 'experienced',
      }).recommendedTechnique
    ).toBe('ssild');
  });
});

describe('getLucidDayPhase', () => {
  const overnight = schedule('22:30', '07:00');

  it.each([
    ['06:59', 'sleep'],
    ['07:00', 'morning'],
    ['08:59', 'morning'],
    ['09:00', 'day'],
    ['20:59', 'day'],
    ['21:00', 'bedtime'],
    ['22:29', 'bedtime'],
    ['22:30', 'sleep'],
    ['00:00', 'sleep'],
  ] as const)('classifies %s as %s across an overnight sleep window', (clock, phase) => {
    expect(getLucidDayPhase(utcDate(`2026-08-24T${clock}`), overnight)).toBe(phase);
  });

  it('keeps daytime sleepers on a same-calendar sleep window', () => {
    const siesta = schedule('13:00', '15:00');
    expect(getLucidDayPhase(utcDate('2026-08-24T12:59'), siesta)).toBe('bedtime');
    expect(getLucidDayPhase(utcDate('2026-08-24T13:00'), siesta)).toBe('sleep');
    expect(getLucidDayPhase(utcDate('2026-08-24T14:59'), siesta)).toBe('sleep');
    expect(getLucidDayPhase(utcDate('2026-08-24T15:00'), siesta)).toBe('morning');
    expect(getLucidDayPhase(utcDate('2026-08-24T16:59'), siesta)).toBe('morning');
    expect(getLucidDayPhase(utcDate('2026-08-24T17:00'), siesta)).toBe('day');
  });

  it('lets morning win when a short waking day overlaps bedtime', () => {
    const shortDay = schedule('08:00', '07:00');
    expect(getLucidDayPhase(utcDate('2026-08-24T07:30'), shortDay)).toBe('morning');
    expect(getLucidDayPhase(utcDate('2026-08-24T08:00'), shortDay)).toBe('sleep');
    expect(getLucidDayPhase(utcDate('2026-08-24T06:59'), shortDay)).toBe('sleep');
  });

  it('reads clock minutes in the schedule timezone, not the host timezone', () => {
    const paris = schedule('22:30', '07:00', 'Europe/Paris');
    expect(getLucidDayPhase(utcDate('2026-08-24T04:59'), paris)).toBe('sleep');
    expect(getLucidDayPhase(utcDate('2026-08-24T05:00'), paris)).toBe('morning');
    expect(getLucidDayPhase(utcDate('2026-08-24T19:00'), paris)).toBe('bedtime');
    expect(getLucidDayPhase(utcDate('2026-08-24T20:30'), paris)).toBe('sleep');
  });

  it('accepts an epoch timestamp as well as a Date', () => {
    expect(getLucidDayPhase(Date.UTC(2026, 7, 24, 7, 0, 0), overnight)).toBe('morning');
    expect(getLucidDayPhase(Date.UTC(2026, 7, 24, 22, 30, 0), overnight)).toBe('sleep');
  });
});
