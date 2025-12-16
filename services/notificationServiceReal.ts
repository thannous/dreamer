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

type ReminderType = 'daily' | 'ritual';
const REMINDER_TYPE_DATA_KEY = 'dreamerReminderType';

const getTimeParts = (time: string): { hours: number; minutes: number } => {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
};

const WEEKDAY_WEEKDAYS: number[] = [2, 3, 4, 5, 6]; // Mon-Fri (1 = Sun, 7 = Sat)
const WEEKEND_WEEKDAYS: number[] = [1, 7]; // Sun, Sat

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isReminderType(value: unknown): value is ReminderType {
  return value === 'daily' || value === 'ritual';
}

function matchesReminderType(request: Notifications.NotificationRequest, reminderType: ReminderType): boolean {
  const data = request.content.data;
  if (isRecord(data) && isReminderType(data[REMINDER_TYPE_DATA_KEY])) {
    return data[REMINDER_TYPE_DATA_KEY] === reminderType;
  }

  // Legacy fallback (before REMINDER_TYPE_DATA_KEY existed).
  const legacyUrl = isRecord(data) ? data.url : undefined;
  const legacyRitualId = isRecord(data) ? data.ritualId : undefined;
  const legacyIsTest = isRecord(data) ? data.test : undefined;

  if (reminderType === 'ritual') {
    return typeof legacyRitualId === 'string';
  }

  return (
    request.content.title === 'Dream Journal Reminder' &&
    legacyUrl === '/recording' &&
    legacyRitualId == null &&
    legacyIsTest !== true
  );
}

async function cancelScheduledReminders(reminderType: ReminderType): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const identifiers = scheduled
    .filter((request) => matchesReminderType(request, reminderType))
    .map((request) => request.identifier);

  await Promise.all(identifiers.map((id) => Notifications.cancelScheduledNotificationAsync(id)));

  if (__DEV__) {
    console.log(`Cancelled ${identifiers.length} scheduled ${reminderType} reminders`);
  }
}

async function scheduleWeeklyRemindersForDays(params: {
  days: number[];
  time: string;
  content: Notifications.NotificationContentInput;
}): Promise<void> {
  const { hours, minutes } = getTimeParts(params.time);

  await Promise.all(
    params.days.map((weekday) =>
      Notifications.scheduleNotificationAsync({
        content: params.content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour: hours,
          minute: minutes,
          channelId: NOTIFICATION_CHANNEL_ID,
        },
      })
    )
  );
}

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
 * Uses weekly triggers so weekday/weekend toggles actually control which days fire.
 */
export async function scheduleDailyNotification(settings: NotificationSettings): Promise<void> {
  if (Platform.OS === 'web') {
    // Web notifications not supported
    return;
  }

  // Replace only the daily reminders, leaving ritual reminders intact.
  await cancelScheduledReminders('daily');

  // Check if either weekday or weekend notifications are enabled
  if (!settings.weekdayEnabled && !settings.weekendEnabled) {
    if (__DEV__) {
      console.log('All notification types disabled');
    }
    return;
  }

  const baseContent: Omit<Notifications.NotificationContentInput, 'body'> = {
    title: 'Dream Journal Reminder',
    data: { url: '/recording', [REMINDER_TYPE_DATA_KEY]: 'daily' },
    sound: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  };

  if (settings.weekdayEnabled) {
    await scheduleWeeklyRemindersForDays({
      days: WEEKDAY_WEEKDAYS,
      time: settings.weekdayTime,
      content: { ...baseContent, body: getRandomPrompt() },
    });
  }

  if (settings.weekendEnabled) {
    await scheduleWeeklyRemindersForDays({
      days: WEEKEND_WEEKDAYS,
      time: settings.weekendTime,
      content: { ...baseContent, body: getRandomPrompt() },
    });
  }

  if (__DEV__) {
    const scheduled: string[] = [];
    if (settings.weekdayEnabled) {
      scheduled.push(`weekdays @ ${settings.weekdayTime}`);
    }
    if (settings.weekendEnabled) {
      scheduled.push(`weekends @ ${settings.weekendTime}`);
    }
    console.log(`Scheduled dream reminders: ${scheduled.join(', ')}`);
  }
}

export async function scheduleRitualReminder(settings: NotificationSettings, ritualId: RitualId): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  // Replace only the ritual reminders, leaving daily reminders intact.
  await cancelScheduledReminders('ritual');

  // Use same logic as scheduleDailyNotification - check if either is enabled
  if (!settings.weekdayEnabled && !settings.weekendEnabled) {
    return;
  }

  const t = getTranslator();

  const baseContent: Notifications.NotificationContentInput = {
    title: t('inspiration.ritual.title'),
    body: getRitualReminderBody(ritualId),
    data: { url: '/recording', ritualId, [REMINDER_TYPE_DATA_KEY]: 'ritual' },
    sound: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  };

  if (settings.weekdayEnabled) {
    await scheduleWeeklyRemindersForDays({
      days: WEEKDAY_WEEKDAYS,
      time: settings.weekdayTime,
      content: baseContent,
    });
  }

  if (settings.weekendEnabled) {
    await scheduleWeeklyRemindersForDays({
      days: WEEKEND_WEEKDAYS,
      time: settings.weekendTime,
      content: baseContent,
    });
  }

  if (__DEV__) {
    const scheduled: string[] = [];
    if (settings.weekdayEnabled) {
      scheduled.push(`weekdays @ ${settings.weekdayTime}`);
    }
    if (settings.weekendEnabled) {
      scheduled.push(`weekends @ ${settings.weekendTime}`);
    }
    console.log(`Scheduled ritual reminder (${ritualId}): ${scheduled.join(', ')}`);
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
