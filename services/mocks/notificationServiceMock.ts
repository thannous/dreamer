/**
 * Mock implementation of notificationService for development mode
 * Logs to console instead of scheduling real notifications
 */

import type { RitualId } from '@/lib/inspirationRituals';
import type { NotificationSettings } from '@/lib/types';

// Mock notification requests for getScheduledNotifications
interface MockNotificationRequest {
  identifier: string;
  content: {
    title: string;
    body: string;
  };
  trigger: {
    type: string;
    weekday?: number;
    hour: number;
    minute: number;
  };
}

const WEEKDAY_WEEKDAYS: number[] = [2, 3, 4, 5, 6]; // Mon-Fri (1 = Sun, 7 = Sat)
const WEEKEND_WEEKDAYS: number[] = [1, 7]; // Sun, Sat

// Track mock notification state
let mockPermissionsGranted = true;
let mockScheduledNotifications: MockNotificationRequest[] = [];

/**
 * Mock configure notification handler
 */
export function configureNotificationHandler(): void {
  console.log('[MOCK NOTIFICATIONS] Notification handler configured');
}

/**
 * Mock request notification permissions
 * Always returns true in mock mode
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  console.log('[MOCK NOTIFICATIONS] Requesting notification permissions');
  mockPermissionsGranted = true;
  console.log('[MOCK NOTIFICATIONS] Permissions granted (mocked)');
  return true;
}

/**
 * Mock schedule daily notification
 */
export async function scheduleDailyNotification(settings: NotificationSettings): Promise<void> {
  console.log('[MOCK NOTIFICATIONS] scheduleDailyNotification called with settings:', settings);

  // Clear existing mock notifications
  mockScheduledNotifications = [];

  if (!settings.weekdayEnabled && !settings.weekendEnabled) {
    console.log('[MOCK NOTIFICATIONS] Notifications disabled, not scheduling');
    return;
  }

  const createWeeklyMock = (weekday: number, time: string): MockNotificationRequest => {
    const [hours, minutes] = time.split(':').map(Number);
    return {
      identifier: `mock-notification-${weekday}-${Date.now()}`,
      content: {
        title: 'Dream Journal Reminder',
        body: 'Good morning! Capture your dreams before they fade away.',
      },
      trigger: {
        type: 'weekly',
        weekday,
        hour: hours,
        minute: minutes,
      },
    };
  };

  if (settings.weekdayEnabled) {
    WEEKDAY_WEEKDAYS.forEach((weekday) => {
      mockScheduledNotifications.push(createWeeklyMock(weekday, settings.weekdayTime));
    });
    console.log(`[MOCK NOTIFICATIONS] Scheduled weekday notifications @ ${settings.weekdayTime}`);
  }

  if (settings.weekendEnabled) {
    WEEKEND_WEEKDAYS.forEach((weekday) => {
      mockScheduledNotifications.push(createWeeklyMock(weekday, settings.weekendTime));
    });
    console.log(`[MOCK NOTIFICATIONS] Scheduled weekend notifications @ ${settings.weekendTime}`);
  }

  console.log('[MOCK NOTIFICATIONS] Mock notifications:', mockScheduledNotifications);
}

export async function scheduleRitualReminder(settings: NotificationSettings, ritualId: RitualId): Promise<void> {
  console.log('[MOCK NOTIFICATIONS] scheduleRitualReminder called with settings:', settings, 'ritualId:', ritualId);

  mockScheduledNotifications = [];

  if (!settings.weekdayEnabled && !settings.weekendEnabled) {
    console.log('[MOCK NOTIFICATIONS] Notifications disabled, not scheduling ritual reminder');
    return;
  }

  const createWeeklyMock = (weekday: number, time: string): MockNotificationRequest => {
    const [hours, minutes] = time.split(':').map(Number);
    return {
      identifier: `mock-ritual-${weekday}-${Date.now()}`,
      content: {
        title: "Today's ritual",
        body: `Ritual ${ritualId} reminder (mock)`,
      },
      trigger: {
        type: 'weekly',
        weekday,
        hour: hours,
        minute: minutes,
      },
    };
  };

  if (settings.weekdayEnabled) {
    WEEKDAY_WEEKDAYS.forEach((weekday) => {
      mockScheduledNotifications.push(createWeeklyMock(weekday, settings.weekdayTime));
    });
    console.log(`[MOCK NOTIFICATIONS] Scheduled weekday ritual reminders @ ${settings.weekdayTime}`);
  }

  if (settings.weekendEnabled) {
    WEEKEND_WEEKDAYS.forEach((weekday) => {
      mockScheduledNotifications.push(createWeeklyMock(weekday, settings.weekendTime));
    });
    console.log(`[MOCK NOTIFICATIONS] Scheduled weekend ritual reminders @ ${settings.weekendTime}`);
  }
}

export async function sendTestNotification(): Promise<void> {
  console.log('[MOCK NOTIFICATIONS] sendTestNotification called');
  console.log('[MOCK NOTIFICATIONS] Would schedule a test notification in 5 seconds (mock)');
}

/**
 * Mock cancel all notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  console.log('[MOCK NOTIFICATIONS] Cancelling all scheduled notifications');
  mockScheduledNotifications = [];
  console.log('[MOCK NOTIFICATIONS] All notifications cancelled');
}

/**
 * Mock get scheduled notifications
 * Returns mock notification requests
 */
export async function getScheduledNotifications(): Promise<MockNotificationRequest[]> {
  console.log('[MOCK NOTIFICATIONS] Getting scheduled notifications');
  console.log(`[MOCK NOTIFICATIONS] Found ${mockScheduledNotifications.length} scheduled notifications`);
  return mockScheduledNotifications;
}

/**
 * Mock check if notification permissions are granted
 * Always returns true in mock mode
 */
export async function hasNotificationPermissions(): Promise<boolean> {
  console.log('[MOCK NOTIFICATIONS] Checking notification permissions');
  console.log(`[MOCK NOTIFICATIONS] Permissions granted: ${mockPermissionsGranted}`);
  return mockPermissionsGranted;
}

/**
 * Utility function to reset mock notification state (useful for testing)
 */
export function resetMockNotifications(): void {
  console.log('[MOCK NOTIFICATIONS] Resetting mock notification state');
  mockPermissionsGranted = true;
  mockScheduledNotifications = [];
}
