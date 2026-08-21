import { describe, expect, it } from '@jest/globals';

import {
  buildEngagementReminderPlan,
  differenceInCalendarDays,
  getEngagementReminderPlanSignature,
  getLatestDreamTimestamp,
  INACTIVITY_REMINDER_HOUR,
  resolveInactivityPlan,
  resolveStreakRiskPlan,
  STREAK_RISK_HOUR,
} from '@/lib/engagementReminders';
import type { DreamAnalysis } from '@/lib/types';

/** Local-time helper so every expectation is expressed in the device timezone. */
const at = (year: number, month: number, day: number, hour = 9, minute = 0): number =>
  new Date(year, month - 1, day, hour, minute, 0, 0).getTime();

const dream = (timestamp: number): DreamAnalysis =>
  ({ id: timestamp, transcript: 'x', title: 'x' } as unknown as DreamAnalysis);

const eveningOf = (year: number, month: number, day: number, hour: number): number =>
  at(year, month, day, hour, 0);

describe('differenceInCalendarDays', () => {
  it('counts whole local calendar days, not 24h blocks', () => {
    expect(differenceInCalendarDays(at(2026, 3, 10, 0, 5), at(2026, 3, 9, 23, 55))).toBe(1);
    expect(differenceInCalendarDays(at(2026, 3, 10, 23, 55), at(2026, 3, 10, 0, 5))).toBe(0);
    expect(differenceInCalendarDays(at(2026, 3, 17), at(2026, 3, 10))).toBe(7);
  });

  it('stays exact across a DST boundary, where a floored 24h quotient would drift', () => {
    // Europe/Paris springs forward on 2026-03-29; that calendar day is 23 h long.
    // Whatever the runner's timezone, two adjacent days must still read as 1.
    expect(differenceInCalendarDays(at(2026, 3, 30, 12), at(2026, 3, 29, 12))).toBe(1);
    expect(differenceInCalendarDays(at(2026, 3, 31, 12), at(2026, 3, 29, 12))).toBe(2);
    // …and the autumn boundary (25 h day) as well.
    expect(differenceInCalendarDays(at(2026, 10, 26, 12), at(2026, 10, 25, 12))).toBe(1);
  });
});

describe('getLatestDreamTimestamp', () => {
  it('returns the newest id whatever the list order', () => {
    expect(getLatestDreamTimestamp([dream(300), dream(100), dream(200)])).toBe(300);
  });

  it('returns null for an empty journal', () => {
    expect(getLatestDreamTimestamp([])).toBeNull();
  });
});

describe('resolveStreakRiskPlan', () => {
  it('warns tonight when the last dream is from yesterday', () => {
    const dreams = [dream(at(2026, 5, 11, 8)), dream(at(2026, 5, 10, 8)), dream(at(2026, 5, 9, 8))];
    const now = at(2026, 5, 12, 14);

    expect(resolveStreakRiskPlan(dreams, now)).toEqual({
      triggerAt: eveningOf(2026, 5, 12, STREAK_RISK_HOUR),
      streakLength: 3,
    });
  });

  it('never warns tonight when a dream was already recorded today: it arms tomorrow instead', () => {
    const dreams = [dream(at(2026, 5, 12, 7)), dream(at(2026, 5, 11, 8)), dream(at(2026, 5, 10, 8))];
    const now = at(2026, 5, 12, 14);

    expect(resolveStreakRiskPlan(dreams, now)).toEqual({
      triggerAt: eveningOf(2026, 5, 13, STREAK_RISK_HOUR),
      streakLength: 3,
    });
  });

  it('stays silent when there is no streak yet (a single night is not a streak)', () => {
    expect(resolveStreakRiskPlan([dream(at(2026, 5, 11, 8))], at(2026, 5, 12, 14))).toBeNull();
  });

  it('stays silent when the streak is already broken', () => {
    const dreams = [dream(at(2026, 5, 8, 8)), dream(at(2026, 5, 7, 8)), dream(at(2026, 5, 6, 8))];

    // Two silent days: calculateStreaks already reports current = 0.
    expect(resolveStreakRiskPlan(dreams, at(2026, 5, 10, 14))).toBeNull();
  });

  it('stays silent for an empty journal', () => {
    expect(resolveStreakRiskPlan([], at(2026, 5, 12, 14))).toBeNull();
  });

  it('does not fire after the deadline evening has passed', () => {
    const dreams = [dream(at(2026, 5, 11, 8)), dream(at(2026, 5, 10, 8))];

    // 22:30 — the 21:00 slot is gone and buzzing before midnight would only nag.
    expect(resolveStreakRiskPlan(dreams, at(2026, 5, 12, 22, 30))).toBeNull();
  });

  it('shifts the deadline with the day: the same journal warns tonight, then goes quiet', () => {
    const dreams = [dream(at(2026, 5, 11, 8)), dream(at(2026, 5, 10, 8))];

    expect(resolveStreakRiskPlan(dreams, at(2026, 5, 12, 9))).toEqual({
      triggerAt: eveningOf(2026, 5, 12, STREAK_RISK_HOUR),
      streakLength: 2,
    });
    // One day later the streak is over, so nothing is scheduled any more.
    expect(resolveStreakRiskPlan(dreams, at(2026, 5, 13, 9))).toBeNull();
  });

  it('clamps a dream dated in the future instead of pushing the deadline away', () => {
    // Clock skew or a server timestamp running ahead: the newest id is tomorrow.
    const dreams = [dream(at(2026, 5, 13, 8)), dream(at(2026, 5, 12, 8)), dream(at(2026, 5, 11, 8))];
    const plan = resolveStreakRiskPlan(dreams, at(2026, 5, 12, 14));

    expect(plan?.triggerAt).toBe(eveningOf(2026, 5, 13, STREAK_RISK_HOUR));
  });

  it('honours a custom evening hour', () => {
    const dreams = [dream(at(2026, 5, 11, 8)), dream(at(2026, 5, 10, 8))];

    expect(resolveStreakRiskPlan(dreams, at(2026, 5, 12, 9), 19)?.triggerAt).toBe(
      eveningOf(2026, 5, 12, 19)
    );
  });
});

describe('resolveInactivityPlan', () => {
  it('arms both stages right after a dream is recorded', () => {
    const dreams = [dream(at(2026, 5, 12, 8))];

    expect(resolveInactivityPlan(dreams, at(2026, 5, 12, 9))).toEqual([
      { stage: 3, triggerAt: eveningOf(2026, 5, 15, INACTIVITY_REMINDER_HOUR) },
      { stage: 7, triggerAt: eveningOf(2026, 5, 19, INACTIVITY_REMINDER_HOUR) },
    ]);
  });

  it('drops J+3 once its evening has passed and keeps only J+7', () => {
    const dreams = [dream(at(2026, 5, 12, 8))];

    expect(resolveInactivityPlan(dreams, at(2026, 5, 16, 10))).toEqual([
      { stage: 7, triggerAt: eveningOf(2026, 5, 19, INACTIVITY_REMINDER_HOUR) },
    ]);
  });

  it('stops entirely after the last stage — a dormant user is never nagged again', () => {
    const dreams = [dream(at(2026, 5, 12, 8))];

    expect(resolveInactivityPlan(dreams, at(2026, 5, 20, 10))).toEqual([]);
    expect(resolveInactivityPlan(dreams, at(2026, 6, 30, 10))).toEqual([]);
  });

  it('restarts the countdown from the newest dream', () => {
    const dreams = [dream(at(2026, 5, 18, 8)), dream(at(2026, 5, 12, 8))];

    expect(resolveInactivityPlan(dreams, at(2026, 5, 18, 9))).toEqual([
      { stage: 3, triggerAt: eveningOf(2026, 5, 21, INACTIVITY_REMINDER_HOUR) },
      { stage: 7, triggerAt: eveningOf(2026, 5, 25, INACTIVITY_REMINDER_HOUR) },
    ]);
  });

  it('sends nothing to a user who never recorded a dream', () => {
    expect(resolveInactivityPlan([], at(2026, 5, 12, 9))).toEqual([]);
  });
});

describe('buildEngagementReminderPlan', () => {
  it('resolves both families in one pass', () => {
    const dreams = [dream(at(2026, 5, 11, 8)), dream(at(2026, 5, 10, 8))];
    const plan = buildEngagementReminderPlan(dreams, at(2026, 5, 12, 9));

    expect(plan.streakRisk).toEqual({
      triggerAt: eveningOf(2026, 5, 12, STREAK_RISK_HOUR),
      streakLength: 2,
    });
    expect(plan.inactivity).toEqual([
      { stage: 3, triggerAt: eveningOf(2026, 5, 14, INACTIVITY_REMINDER_HOUR) },
      { stage: 7, triggerAt: eveningOf(2026, 5, 18, INACTIVITY_REMINDER_HOUR) },
    ]);
  });
});

describe('getEngagementReminderPlanSignature', () => {
  const dreams = [dream(at(2026, 5, 11, 8)), dream(at(2026, 5, 10, 8))];
  const settings = { streakRiskEnabled: true, inactivityNudgeEnabled: true };

  it('is stable for the same journal on the same day', () => {
    const morning = buildEngagementReminderPlan(dreams, at(2026, 5, 12, 8));
    const afternoon = buildEngagementReminderPlan(dreams, at(2026, 5, 12, 17));

    expect(getEngagementReminderPlanSignature(morning, settings)).toBe(
      getEngagementReminderPlanSignature(afternoon, settings)
    );
  });

  it('changes when the day rolls over', () => {
    const today = buildEngagementReminderPlan(dreams, at(2026, 5, 12, 8));
    const tomorrow = buildEngagementReminderPlan(dreams, at(2026, 5, 13, 8));

    expect(getEngagementReminderPlanSignature(today, settings)).not.toBe(
      getEngagementReminderPlanSignature(tomorrow, settings)
    );
  });

  it('changes when a toggle flips, so a settings change forces a reschedule', () => {
    const plan = buildEngagementReminderPlan(dreams, at(2026, 5, 12, 8));

    expect(getEngagementReminderPlanSignature(plan, settings)).not.toBe(
      getEngagementReminderPlanSignature(plan, { ...settings, streakRiskEnabled: false })
    );
  });
});
