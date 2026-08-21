import { useEngagementReminders } from '@/hooks/useEngagementReminders';

/**
 * Headless host for the streak-risk and comeback reminders. Mounted inside
 * `DreamsProvider` so the scheduler sees every dream mutation, wherever it was
 * triggered from (recording screen, journal deletion, remote sync).
 */
export function EngagementRemindersHost(): null {
  useEngagementReminders();
  return null;
}

export default EngagementRemindersHost;
