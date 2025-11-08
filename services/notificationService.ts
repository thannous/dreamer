/**
 * Conditional export for notificationService
 * Uses mock implementation if EXPO_PUBLIC_MOCK_MODE is enabled,
 * otherwise uses real implementation
 */

// Import both implementations
import * as realService from './notificationServiceReal';
import * as mockService from './mocks/notificationServiceMock';

// Select which implementation to use based on environment
const isMockMode = process.env.EXPO_PUBLIC_MOCK_MODE === 'true';
const service = isMockMode ? mockService : realService;

if (isMockMode) {
  console.log('[NOTIFICATION SERVICE] Using MOCK implementation');
} else {
  console.log('[NOTIFICATION SERVICE] Using REAL implementation');
}

// Re-export all functions from the selected service
export const configureNotificationHandler = service.configureNotificationHandler;
export const requestNotificationPermissions = service.requestNotificationPermissions;
export const scheduleDailyNotification = service.scheduleDailyNotification;
export const cancelAllNotifications = service.cancelAllNotifications;
export const getScheduledNotifications = service.getScheduledNotifications;
export const hasNotificationPermissions = service.hasNotificationPermissions;
