import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getTranslator } from '@/lib/i18n';
import type { RitualId } from '@/lib/inspirationRituals';
import type { NotificationSettings } from '@/lib/types';

// Array of smart, motivational notification prompt keys
const NOTIFICATION_PROMPT_KEYS = [
  'notifications.prompt.morning_1',
  'notifications.prompt.morning_2',
  'notifications.prompt.morning_3',
  'notifications.prompt.morning_4',
  'notifications.prompt.morning_5',
  'notifications.prompt.morning_6',
  'notifications.prompt.morning_7',
  'notifications.prompt.morning_8',
  'notifications.prompt.morning_9',
  'notifications.prompt.morning_10',
  'notifications.prompt.morning_11',
  'notifications.prompt.morning_12',
  'notifications.prompt.morning_13',
  'notifications.prompt.morning_14',
  'notifications.prompt.morning_15',
];

// Notification channel for Android
const NOTIFICATION_CHANNEL_ID = 'dream-reminders';

const getTimeParts = (time: string): { hours: number; minutes: number } => {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
};

/**
 * Normalize permission status across platforms (handles iOS provisional/ephemeral)
 */
function allowsNotifications(permission: Notifications.NotificationPermissionsStatus): boolean {
  const iosStatus = permission.ios?.status;
  return (
    permission.granted ||
    permission.status === 'granted' ||
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

/**
 * Configure default notification behavior
 */
export function configureNotificationHandler(): void {
  if (Platform.OS === 'web') {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request notification permissions from the user
 * Returns true if granted, false otherwise
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    // Web notifications require different handling
    return false;
  }

  const existingPermissions = await Notifications.getPermissionsAsync();
  let permissionResult = existingPermissions;

  if (!allowsNotifications(existingPermissions)) {
    permissionResult = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
  }

  const isGranted = allowsNotifications(permissionResult);

  // Android: Create notification channel
  if (isGranted && Platform.OS === 'android') {
    // Get system language for channel name (can't be changed after creation)
    const t = getTranslator();
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: t('notifications.channel_name'),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B6B',
    });
  }

  return isGranted;
}

/**
 * Get a random notification prompt from the array
 */
function getRandomPrompt(): string {
  const t = getTranslator();
  const randomIndex = Math.floor(Math.random() * NOTIFICATION_PROMPT_KEYS.length);
  return t(NOTIFICATION_PROMPT_KEYS[randomIndex]);
}

function getRitualReminderBody(ritualId: RitualId): string {
  const t = getTranslator();
  switch (ritualId) {
    case 'starter':
      return t('notifications.ritual.body.starter');
    case 'memory':
      return t('notifications.ritual.body.memory');
    case 'lucid':
      return t('notifications.ritual.body.lucid');
    default:
      return getRandomPrompt();
  }
}

/**
 * Schedule daily notification based on settings
 * Note: expo-notifications doesn't support weekday-specific triggers directly.
 * To implement different times for weekdays vs weekends, we use a simplified
 * approach: schedule using weekday time if enabled, otherwise weekend time if enabled.
 * For a complete implementation with both times firing on their respective days,
 * a backend service or more sophisticated scheduling would be required.
 */
export async function scheduleDailyNotification(settings: NotificationSettings): Promise<void> {
  if (Platform.OS === 'web') {
    // Web notifications not supported
    return;
  }

  // Cancel all existing notifications first
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Check if either weekday or weekend notifications are enabled
  if (!settings.weekdayEnabled && !settings.weekendEnabled) {
    if (__DEV__) {
      console.log('All notification types disabled');
    }
    return;
  }

  // Determine which time to use
  // If weekday is enabled, use weekday time; otherwise use weekend time
  const timeToUse = settings.weekdayEnabled ? settings.weekdayTime : settings.weekendTime;
  const { hours, minutes } = getTimeParts(timeToUse);

  // Schedule daily notification
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Dream Journal Reminder',
      body: getRandomPrompt(),
      data: { url: '/recording' },
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: hours,
      minute: minutes,
    },
  });

  if (__DEV__) {
    if (settings.weekdayEnabled && settings.weekendEnabled) {
      console.log(`Scheduled daily notification for ${timeToUse} (weekday time used - platform doesn't support different times for weekdays/weekends)`);
    } else if (settings.weekdayEnabled) {
      console.log(`Scheduled daily notification for ${settings.weekdayTime} (weekday only)`);
    } else {
      console.log(`Scheduled daily notification for ${settings.weekendTime} (weekend only)`);
    }
  }
}

export async function scheduleRitualReminder(settings: NotificationSettings, ritualId: RitualId): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  // Use same logic as scheduleDailyNotification - check if either is enabled
  if (!settings.weekdayEnabled && !settings.weekendEnabled) {
    return;
  }

  // Use weekday time if enabled, otherwise weekend time
  const timeToUse = settings.weekdayEnabled ? settings.weekdayTime : settings.weekendTime;
  const { hours, minutes } = getTimeParts(timeToUse);
  const t = getTranslator();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('inspiration.ritual.title'),
      body: getRitualReminderBody(ritualId),
      data: { url: '/recording', ritualId },
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: hours,
      minute: minutes,
    },
  });

  if (__DEV__) {
    console.log(`Scheduled ritual reminder for ${timeToUse} (${ritualId})`);
  }
}

export async function sendTestNotification(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Dream Journal Reminder',
      body: getRandomPrompt(),
      data: { url: '/recording', test: true },
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
    },
  });

  if (__DEV__) {
    console.log('Scheduled test notification in 5 seconds');
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  if (__DEV__) {
    console.log('Cancelled all notifications');
  }
}

/**
 * Get list of scheduled notifications (useful for debugging)
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  if (Platform.OS === 'web') {
    return [];
  }

  return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Check if notification permissions are granted
 */
export async function hasNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const permissions = await Notifications.getPermissionsAsync();
  return allowsNotifications(permissions);
}
