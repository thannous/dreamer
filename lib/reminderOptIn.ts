import type { ReminderTimeBucket } from '@/lib/analytics';
import type { NotificationSettings } from '@/lib/types';

/** Wake-up presets offered by the in-app reminder opt-in card. */
export const REMINDER_OPT_IN_PRESETS = ['06:30', '07:00', '07:30', '08:00'] as const;
export type ReminderOptInPreset = (typeof REMINDER_OPT_IN_PRESETS)[number];
export const DEFAULT_REMINDER_OPT_IN_TIME: ReminderOptInPreset = '07:00';

/** Weekend reminders default to one hour after the weekday time, capped at 23:00. */
export const WEEKEND_OFFSET_MINUTES = 60;

const parseTime = (time: string): { hours: number; minutes: number } | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return { hours, minutes };
};

const formatTime = (hours: number, minutes: number): string =>
  `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

export function deriveWeekendTime(weekdayTime: string): string {
  const parsed = parseTime(weekdayTime);
  if (!parsed) return '10:00';
  const total = Math.min(parsed.hours * 60 + parsed.minutes + WEEKEND_OFFSET_MINUTES, 23 * 60);
  return formatTime(Math.floor(total / 60), total % 60);
}

/**
 * Settings written when the user accepts the opt-in card: weekdays at the chosen
 * time, weekends one hour later. Existing weekend preferences are preserved when
 * the user had already customised them.
 *
 * The card is a consent moment for the essential morning reminder and the
 * Sunday recap. Streak and inactivity reminders stay off unless the user already
 * enabled them in Settings. Anything enabled here must be spelled out in
 * `reminders.opt_in.includes`.
 */
export function buildOptInNotificationSettings(
  current: NotificationSettings,
  weekdayTime: string
): NotificationSettings {
  return {
    weekdayEnabled: true,
    weekdayTime,
    weekendEnabled: true,
    weekendTime: current.weekendEnabled ? current.weekendTime : deriveWeekendTime(weekdayTime),
    // Disclosed by `reminders.opt_in.includes`. Adding a family here without
    // updating that copy (in the six locales) breaks the informed consent the
    // card is built on.
    weeklyRecapEnabled: true,
    streakRiskEnabled: current.streakRiskEnabled === true,
    inactivityNudgeEnabled: current.inactivityNudgeEnabled === true,
  };
}

/** Categorical bucket for analytics — the exact reminder time is never sent. */
export function getReminderTimeBucket(time: string | null | undefined): ReminderTimeBucket {
  if (!time) return 'unknown';
  const parsed = parseTime(time);
  if (!parsed) return 'unknown';
  if (parsed.hours < 6) return 'before_6';
  if (parsed.hours < 7) return '6_7';
  if (parsed.hours < 8) return '7_8';
  if (parsed.hours < 9) return '8_9';
  return 'after_9';
}
