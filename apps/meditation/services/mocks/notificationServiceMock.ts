import { scheduleTriggers, type ReminderSchedule } from '@/lib/reminders';

/** Counts what would have been scheduled. Nothing is ever delivered. */
let scheduled = 0;

export async function requestPermission(): Promise<boolean> {
  return true;
}

export async function cancelAll(): Promise<void> {
  scheduled = 0;
}

export async function syncReminders(
  schedule: ReminderSchedule,
  _content: { title: string; body: string }
): Promise<number> {
  scheduled = scheduleTriggers(schedule).length;
  return scheduled;
}

export const __scheduledCount = (): number => scheduled;
