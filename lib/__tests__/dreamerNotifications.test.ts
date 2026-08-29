import { describe, expect, it } from '@jest/globals';

import {
  DREAMER_OCCURRENCE_ID_KEY,
  DREAMER_OFFSET_KEY,
  DREAMER_OWNER_KEY,
  DREAMER_REMINDER_TYPE_KEY,
  DREAMER_SIGNATURE_KEY,
  DREAMER_TIME_ZONE_KEY,
  LUCID_TRAINER_NOTIFICATION_OWNER,
  WEEKDAY_WEEKDAYS,
  WEEKEND_WEEKDAYS,
  WEEKLY_RECAP_TIME,
  WEEKLY_RECAP_WEEKDAY,
  analysisReadyNotificationUrl,
  buildDreamerNotificationContentData,
  buildDreamerNotificationPlan,
  isSafeDreamerNotificationRoute,
  normalizeNotificationSettings,
  parseJournalNotificationDreamId,
  reconcileDreamerNotificationPlan,
  shouldPresentAnalysisReadyNotification,
  type DreamerScheduledRequest,
  type DreamerTimeContext,
} from '@/lib/dreamerNotifications';

const PARIS_CEST: DreamerTimeContext = { timeZone: 'Europe/Paris', offsetMinutes: -120 };
const PARIS_CET: DreamerTimeContext = { timeZone: 'Europe/Paris', offsetMinutes: -60 };
const TOKYO: DreamerTimeContext = { timeZone: 'Asia/Tokyo', offsetMinutes: -540 };

const NOW = Date.UTC(2026, 2, 28, 12, 0, 0);
const IN_TWO_HOURS = NOW + 2 * 60 * 60 * 1000;

const essentialSettings = {
  weekdayEnabled: true,
  weekdayTime: '07:00',
  weekendEnabled: true,
  weekendTime: '10:00',
  weeklyRecapEnabled: true,
  streakRiskEnabled: false,
  inactivityNudgeEnabled: false,
};

function scheduled(
  identifier: string,
  data: Record<string, unknown>,
  title?: string
): DreamerScheduledRequest {
  return { identifier, data, title };
}

describe('normalizeNotificationSettings', () => {
  it('defaults optional families to off and never infers them from a legacy flag', () => {
    expect(normalizeNotificationSettings(undefined)).toEqual({
      weekdayEnabled: false,
      weekdayTime: '07:00',
      weekendEnabled: false,
      weekendTime: '10:00',
      weeklyRecapEnabled: false,
      streakRiskEnabled: false,
      inactivityNudgeEnabled: false,
    });

    expect(
      normalizeNotificationSettings({
        isEnabled: true,
        weekdayTime: '08:15',
      })
    ).toEqual({
      weekdayEnabled: true,
      weekdayTime: '08:15',
      weekendEnabled: true,
      weekendTime: '10:00',
      weeklyRecapEnabled: false,
      streakRiskEnabled: false,
      inactivityNudgeEnabled: false,
    });
  });

  it('treats missing optional flags as off even when morning reminders are on', () => {
    expect(
      normalizeNotificationSettings({
        weekdayEnabled: true,
        weekdayTime: '07:00',
        weekendEnabled: false,
        weekendTime: '10:00',
      })
    ).toMatchObject({
      weeklyRecapEnabled: false,
      streakRiskEnabled: false,
      inactivityNudgeEnabled: false,
    });
  });
});

describe('buildDreamerNotificationPlan', () => {
  it('schedules only the essential families by default', () => {
    const plan = buildDreamerNotificationPlan({
      settings: essentialSettings,
      timeContext: PARIS_CEST,
      now: NOW,
      streakRisk: { triggerAt: IN_TWO_HOURS, streakLength: 4 },
      inactivity: [{ stage: 3, triggerAt: IN_TWO_HOURS }],
    });

    expect(plan.map((item) => item.reminderType).sort()).toEqual([
      ...WEEKDAY_WEEKDAYS.map(() => 'daily'),
      ...WEEKEND_WEEKDAYS.map(() => 'daily'),
      'weekly_recap',
    ].sort());
    expect(plan.some((item) => item.reminderType === 'streak_risk')).toBe(false);
    expect(plan.some((item) => item.reminderType === 'inactivity')).toBe(false);
    expect(plan.find((item) => item.reminderType === 'daily')?.url).toBe('/recording');
    expect(plan.find((item) => item.reminderType === 'weekly_recap')).toMatchObject({
      url: '/weekly-recap',
      weekday: WEEKLY_RECAP_WEEKDAY,
      time: WEEKLY_RECAP_TIME,
    });
  });

  it('keeps streak and inactivity off until the user opts in', () => {
    const optedIn = buildDreamerNotificationPlan({
      settings: { ...essentialSettings, streakRiskEnabled: true, inactivityNudgeEnabled: true },
      timeContext: PARIS_CEST,
      now: NOW,
      streakRisk: { triggerAt: IN_TWO_HOURS, streakLength: 4 },
      inactivity: [
        { stage: 3, triggerAt: IN_TWO_HOURS },
        { stage: 7, triggerAt: IN_TWO_HOURS + 4 * 24 * 60 * 60 * 1000 },
      ],
    });

    expect(optedIn.some((item) => item.occurrenceId === 'streak_risk:once')).toBe(true);
    expect(optedIn.filter((item) => item.reminderType === 'inactivity').map((item) => item.url)).toEqual([
      '/recording',
      '/recording',
    ]);
  });

  it('deep-links analysis-ready to the existing journal detail screen', () => {
    const plan = buildDreamerNotificationPlan({
      settings: essentialSettings,
      timeContext: PARIS_CEST,
      now: NOW,
      analysisReady: { dreamId: 42, triggerAt: IN_TWO_HOURS },
    });
    const ready = plan.find((item) => item.reminderType === 'analysis_ready');
    expect(ready).toMatchObject({
      url: '/journal/42',
      dreamId: 42,
      occurrenceId: 'analysis_ready:42',
    });
  });

  it('stamps wall-clock signatures with the current timezone and offset', () => {
    const cest = buildDreamerNotificationPlan({
      settings: { ...essentialSettings, weekendEnabled: false },
      timeContext: PARIS_CEST,
      now: NOW,
    });
    const cet = buildDreamerNotificationPlan({
      settings: { ...essentialSettings, weekendEnabled: false },
      timeContext: PARIS_CET,
      now: NOW,
    });
    const monday = cest.find((item) => item.occurrenceId === 'daily:weekday:2');
    const mondayAfterDst = cet.find((item) => item.occurrenceId === 'daily:weekday:2');
    expect(monday?.time).toBe('07:00');
    expect(mondayAfterDst?.time).toBe('07:00');
    expect(monday?.signature).not.toBe(mondayAfterDst?.signature);
  });
});

describe('reconcileDreamerNotificationPlan', () => {
  it('rebuilds wall-clock reminders across a DST offset change and leaves Lucid untouched', () => {
    const desiredCest = buildDreamerNotificationPlan({
      settings: { ...essentialSettings, weekendEnabled: false },
      timeContext: PARIS_CEST,
      now: NOW,
    });
    const monday = desiredCest.find((item) => item.occurrenceId === 'daily:weekday:2');
    if (!monday) throw new Error('expected weekday occurrence');

    const scheduledRequests: DreamerScheduledRequest[] = [
      scheduled('dreamer-mon', {
        ...buildDreamerNotificationContentData(monday, PARIS_CEST),
      }),
      scheduled('lucid-night', {
        [DREAMER_OWNER_KEY]: LUCID_TRAINER_NOTIFICATION_OWNER,
        url: '/lucid/(tabs)/night',
      }),
      scheduled('legacy-ritual', { url: '/recording', ritualId: 'starter' }, "Today's ritual"),
      scheduled('legacy-daily', { url: '/recording' }, 'Dream Journal Reminder'),
    ];

    const afterDst = reconcileDreamerNotificationPlan(
      scheduledRequests,
      buildDreamerNotificationPlan({
        settings: { ...essentialSettings, weekendEnabled: false },
        timeContext: PARIS_CET,
        now: NOW,
      }),
      PARIS_CET
    );

    expect(afterDst.timeContextChanged).toBe(true);
    expect(afterDst.toCancel).toEqual(expect.arrayContaining(['dreamer-mon', 'legacy-ritual', 'legacy-daily']));
    expect(afterDst.toCancel).not.toContain('lucid-night');
    expect(afterDst.orphanIdentifiers).toEqual(expect.arrayContaining(['legacy-ritual', 'legacy-daily']));
    expect(afterDst.toSchedule.map((item) => item.occurrenceId)).toEqual(
      expect.arrayContaining(['daily:weekday:2', 'weekly_recap:weekday:1'])
    );
  });

  it('keeps matching occurrences when the timezone context is unchanged', () => {
    const desired = buildDreamerNotificationPlan({
      settings: { ...essentialSettings, weekendEnabled: false, weeklyRecapEnabled: false },
      timeContext: PARIS_CEST,
      now: NOW,
    });
    const scheduledRequests = desired.map((occurrence) =>
      scheduled(occurrence.occurrenceId, buildDreamerNotificationContentData(occurrence, PARIS_CEST))
    );

    const result = reconcileDreamerNotificationPlan(scheduledRequests, desired, PARIS_CEST);
    expect(result.timeContextChanged).toBe(false);
    expect(result.toCancel).toEqual([]);
    expect(result.toSchedule).toEqual([]);
    expect(result.unchangedOccurrenceIds).toEqual(desired.map((item) => item.occurrenceId));
  });

  it('rebuilds dated reminders after a timezone move so the local evening stays local', () => {
    const parisPlan = buildDreamerNotificationPlan({
      settings: { ...essentialSettings, streakRiskEnabled: true, weekendEnabled: false, weeklyRecapEnabled: false },
      timeContext: PARIS_CEST,
      now: NOW,
      streakRisk: { triggerAt: IN_TWO_HOURS, streakLength: 3 },
    });
    const tokyoPlan = buildDreamerNotificationPlan({
      settings: { ...essentialSettings, streakRiskEnabled: true, weekendEnabled: false, weeklyRecapEnabled: false },
      timeContext: TOKYO,
      now: NOW,
      streakRisk: { triggerAt: IN_TWO_HOURS + 7 * 60 * 60 * 1000, streakLength: 3 },
    });
    const parisStreak = parisPlan.find((item) => item.reminderType === 'streak_risk');
    if (!parisStreak) throw new Error('expected streak occurrence');

    const result = reconcileDreamerNotificationPlan(
      [scheduled('streak-paris', buildDreamerNotificationContentData(parisStreak, PARIS_CEST))],
      tokyoPlan,
      TOKYO
    );

    expect(result.timeContextChanged).toBe(true);
    expect(result.toCancel).toEqual(['streak-paris']);
    expect(result.toSchedule.find((item) => item.reminderType === 'streak_risk')?.triggerAt).toBe(
      IN_TWO_HOURS + 7 * 60 * 60 * 1000
    );
  });
});

describe('deep-link routing', () => {
  it('accepts only the existing capture, recap and journal detail screens', () => {
    expect(isSafeDreamerNotificationRoute('/recording')).toBe(true);
    expect(isSafeDreamerNotificationRoute('/weekly-recap')).toBe(true);
    expect(isSafeDreamerNotificationRoute('/journal/91')).toBe(true);
    expect(isSafeDreamerNotificationRoute('/journal/[id]')).toBe(false);
    expect(isSafeDreamerNotificationRoute('/settings')).toBe(false);
    expect(isSafeDreamerNotificationRoute('https://evil.example/journal/91')).toBe(false);
    expect(parseJournalNotificationDreamId('/journal/91')).toBe(91);
    expect(analysisReadyNotificationUrl(91)).toBe('/journal/91');
  });

  it('stamps content data with the family, occurrence and time context', () => {
    const plan = buildDreamerNotificationPlan({
      settings: essentialSettings,
      timeContext: PARIS_CEST,
      now: NOW,
      analysisReady: { dreamId: 7, triggerAt: IN_TWO_HOURS },
    });
    const ready = plan.find((item) => item.reminderType === 'analysis_ready');
    if (!ready) throw new Error('expected analysis-ready occurrence');
    expect(buildDreamerNotificationContentData(ready, PARIS_CEST)).toMatchObject({
      url: '/journal/7',
      [DREAMER_OWNER_KEY]: 'dreamer',
      [DREAMER_REMINDER_TYPE_KEY]: 'analysis_ready',
      [DREAMER_OCCURRENCE_ID_KEY]: 'analysis_ready:7',
      [DREAMER_TIME_ZONE_KEY]: 'Europe/Paris',
      [DREAMER_OFFSET_KEY]: -120,
      [DREAMER_SIGNATURE_KEY]: ready.signature,
      dreamId: 7,
    });
  });
});

describe('shouldPresentAnalysisReadyNotification', () => {
  const outcome = { dreamId: 12, status: 'done' as const, completedAt: NOW };

  it('notifies only when the user is away from the app and the outcome is new', () => {
    expect(
      shouldPresentAnalysisReadyNotification({
        appState: 'background',
        outcome,
        lastNotified: null,
      })
    ).toEqual({ dreamId: 12 });
    expect(
      shouldPresentAnalysisReadyNotification({
        appState: 'active',
        outcome,
        lastNotified: null,
      })
    ).toBeNull();
    expect(
      shouldPresentAnalysisReadyNotification({
        appState: 'background',
        outcome,
        lastNotified: { dreamId: 12, completedAt: NOW },
      })
    ).toBeNull();
    expect(
      shouldPresentAnalysisReadyNotification({
        appState: 'background',
        outcome: { ...outcome, status: 'failed' },
        lastNotified: null,
      })
    ).toBeNull();
  });
});
