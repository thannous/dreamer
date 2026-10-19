import { scheduleTriggers, type ReminderSchedule } from '@/lib/reminders';

export async function requestPermission(): Promise<boolean> {
  return true;
}

export async function cancelAll(): Promise<void> {
  // This mock schedules no operating-system notifications.
}

export async function syncReminders(
  schedule: ReminderSchedule,
  _content: { title: string; body: string }
): Promise<number> {
  return scheduleTriggers(schedule).length;
}
