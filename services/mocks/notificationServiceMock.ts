/**
 * Mock implementation of notificationService for development mode
 * Logs to console instead of scheduling real notifications
 */

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
    hour: number;
    minute: number;
  };
}

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

  if (!settings.isEnabled) {
    console.log('[MOCK NOTIFICATIONS] Notifications disabled, not scheduling');
    return;
  }

  // Parse weekday time
  const [hours, minutes] = settings.weekdayTime.split(':').map(Number);

  // Create mock notification
  const mockNotification: MockNotificationRequest = {
    identifier: `mock-notification-${Date.now()}`,
    content: {
      title: 'Dream Journal Reminder',
      body: 'Good morning! Capture your dreams before they fade away.',
    },
    trigger: {
      type: 'daily',
      hour: hours,
      minute: minutes,
    },
  };

  mockScheduledNotifications.push(mockNotification);

  console.log(`[MOCK NOTIFICATIONS] Scheduled daily notification for ${settings.weekdayTime}`);
  console.log('[MOCK NOTIFICATIONS] Mock notification details:', mockNotification);
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
