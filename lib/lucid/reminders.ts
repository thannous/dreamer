import type { LucidTrainerContent } from '@/lib/lucid/content';
import type { LucidTrainerState } from '@/lib/lucid/model';
import type { LucidReminderDefinition, LucidReminderPlan } from '@/services/lucidTrainerNotifications';

const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7] as const;

function minuteOfDay(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function shiftLucidLocalTime(time: string, minutes: number): string {
  const shifted = ((minuteOfDay(time) + minutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(shifted / 60)).padStart(2, '0')}:${String(shifted % 60).padStart(2, '0')}`;
}

export function getLucidRealityReminderTimes(params: {
  wakeTime: string;
  bedtime: string;
  count: number;
}): string[] {
  const count = Math.max(0, Math.min(12, Math.floor(params.count)));
  if (count === 0) return [];
  const wake = minuteOfDay(params.wakeTime);
  let bed = minuteOfDay(params.bedtime);
  if (bed <= wake) bed += 1440;
  const span = bed - wake;
  return Array.from({ length: count }, (_, index) => {
    // Divide the actual waking interval into equal segments. The first and last
    // checks therefore stay naturally away from wake-up and bedtime without
    // applying a second, surprising margin to the user's schedule.
    const time = Math.round(wake + (span * (index + 1)) / (count + 1));
    const normalized = ((time % 1440) + 1440) % 1440;
    return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
  });
}

export function buildLucidReminderPlan(
  state: LucidTrainerState,
  content: LucidTrainerContent
): LucidReminderPlan {
  const enabled = state.preferences.notificationsEnabled;
  const schedule = state.onboarding.sleepSchedule;
  const realityTimes = getLucidRealityReminderTimes({
    wakeTime: schedule.wakeTime,
    bedtime: schedule.bedtime,
    count: state.preferences.realityCheckRemindersPerDay,
  });
  const reminders: LucidReminderDefinition[] = realityTimes.map((time, index) => ({
    id: `reality-${index + 1}`,
    family: 'reality_check',
    enabled,
    weekdays: [...EVERY_DAY],
    time,
    title: content.realityChecks.title,
    body: content.realityChecks.completionPrompt,
    url: '/lucid/reality-check',
  }));

  reminders.push({
    id: 'bedtime-preparation',
    family: 'bedtime',
    enabled,
    weekdays: [...EVERY_DAY],
    time: shiftLucidLocalTime(schedule.bedtime, -30),
    title: content.nightSignals.title,
    body: content.nightSignals.setupSteps[0],
    url: '/lucid/(tabs)/night',
  });
  reminders.push({
    id: 'morning-review',
    family: 'morning_review',
    enabled,
    weekdays: [...EVERY_DAY],
    time: shiftLucidLocalTime(schedule.wakeTime, 5),
    title: content.morningReview.title,
    body: content.morningReview.intro,
    url: '/lucid/morning',
  });

  const wbtbActive = state.progress.some(
    (progress) => progress.technique === 'wbtb' && progress.status === 'active'
  );
  reminders.push({
    id: 'wbtb-window',
    family: 'wbtb',
    enabled: enabled && wbtbActive,
    weekdays: [...EVERY_DAY],
    time: shiftLucidLocalTime(schedule.bedtime, 270),
    title: content.programs.wbtb.title,
    body: content.programs.wbtb.stopRules[0],
    url: '/lucid/program/wbtb',
  });

  return {
    version: 1,
    timeZone: schedule.timeZone || state.preferences.timeZone,
    reminders,
  };
}
