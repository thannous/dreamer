import * as Notifications from 'expo-notifications';

import { scheduleTriggers, toNotificationWeekday, type ReminderSchedule } from '@/lib/reminders';

/** All of this app's notifications carry this tag, so it can clear its own. */
const CHANNEL_ID = 'practice-reminder';

export async function requestPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  // Asking again after a refusal does nothing on either platform; the settings
  // screen is what deep-links out.
  if (!current.canAskAgain) return false;

  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

let pendingSync: Promise<unknown> = Promise.resolve();

/**
 * Rewrites the whole schedule rather than diffing it: at most seven triggers,
 * and a reconciliation bug here means either a silent app or a reminder that
 * fires twice.
 */
export function syncReminders(
  schedule: ReminderSchedule,
  content: { title: string; body: string }
): Promise<number> {
  // One rewrite at a time: two overlapping cancel-then-schedule runs would
  // leave both schedules in place.
  const run = pendingSync.then(() => rewriteSchedule(schedule, content));
  pendingSync = run.catch(() => {});
  return run;
}

async function rewriteSchedule(
  schedule: ReminderSchedule,
  content: { title: string; body: string }
): Promise<number> {
  await cancelAll();

  const triggers = scheduleTriggers(schedule);
  for (const trigger of triggers) {
    await Notifications.scheduleNotificationAsync({
      content: { title: content.title, body: content.body, sound: false },
      // Daily and weekly triggers exist on both platforms; the calendar
      // trigger is iOS-only and Android rejects it.
      trigger: trigger.weekday
        ? {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: toNotificationWeekday(trigger.weekday),
            hour: trigger.hour,
            minute: trigger.minute,
            channelId: CHANNEL_ID,
          }
        : {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: trigger.hour,
            minute: trigger.minute,
            channelId: CHANNEL_ID,
          },
    });
  }

  return triggers.length;
}
