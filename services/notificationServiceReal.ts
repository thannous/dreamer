import * as Notifications from 'expo-notifications';
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';

import type {
  InactivityReminderPlan,
  InactivityReminderStage,
  StreakRiskReminderPlan,
} from '@/lib/engagementReminders';
import { getTranslator, loadTranslations } from '@/lib/i18n';
import { normalizeAppLanguage, resolveEffectiveLanguage } from '@/lib/language';
import type { RitualId } from '@/lib/inspirationRituals';
import type { LanguagePreference, NotificationSettings } from '@/lib/types';
import { getLanguagePreference } from '@/services/storageService';

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

type ReminderType = 'daily' | 'ritual' | 'weekly_recap' | 'streak_risk' | 'inactivity';
const REMINDER_TYPE_DATA_KEY = 'dreamerReminderType';
const REMINDER_TYPES: readonly ReminderType[] = [
  'daily',
  'ritual',
  'weekly_recap',
  'streak_risk',
  'inactivity',
];

/** Sunday, 10:00 local: late enough for a lie-in, early enough to plan the week. */
export const WEEKLY_RECAP_WEEKDAY = 1; // 1 = Sunday
export const WEEKLY_RECAP_TIME = '10:00';
export const WEEKLY_RECAP_URL = '/weekly-recap';

type NotificationTranslator = ReturnType<typeof getTranslator>;

/**
 * Resolve the user's chosen language (stored preference, 'auto' → system
 * language) and return a translator with that pack already loaded.
 * Falls back to English when storage or locale detection fails.
 */
async function getNotificationTranslator(): Promise<NotificationTranslator> {
  let preference: LanguagePreference = 'auto';
  try {
    preference = await getLanguagePreference();
  } catch {
    // Keep 'auto' and fall back to the system language below.
  }

  const systemLanguage = normalizeAppLanguage(getLocales()[0]?.languageCode);
  const language = resolveEffectiveLanguage(preference, systemLanguage);
  await loadTranslations(language);
  return getTranslator(language);
}

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
  return typeof value === 'string' && (REMINDER_TYPES as readonly string[]).includes(value);
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

  // Only 'daily' and 'ritual' ever shipped without the marker: without this
  // guard, cancelling a newer family would sweep away legacy daily reminders.
  if (reminderType !== 'daily') {
    return false;
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
  content:
    | Notifications.NotificationContentInput
    | ((weekday: number) => Notifications.NotificationContentInput);
}): Promise<void> {
  const { hours, minutes } = getTimeParts(params.time);

  await Promise.all(
    params.days.map((weekday) =>
      Notifications.scheduleNotificationAsync({
        content: typeof params.content === 'function' ? params.content(weekday) : params.content,
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
 * One-shot reminder fired at an exact local instant. Used by the engagement
 * families, whose deadline is a specific evening rather than a weekly rhythm.
 */
async function scheduleDatedReminder(params: {
  triggerAt: number;
  content: Notifications.NotificationContentInput;
}): Promise<void> {
  if (params.triggerAt <= Date.now()) {
    // Defensive: expo fires a past DATE trigger immediately, which would turn a
    // stale plan into an unexpected buzz.
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: params.content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(params.triggerAt),
      channelId: NOTIFICATION_CHANNEL_ID,
    },
  });
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

  // Android 13+ only shows the notification permission prompt after at least
  // one notification channel exists. Create it before reading or requesting
  // permissions so first-run users can actually receive the system prompt.
  if (Platform.OS === 'android') {
    const t = await getNotificationTranslator();
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: t('notifications.channel_name'),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B6B',
    });
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

  return isGranted;
}

/**
 * Get a random notification prompt from the array
 */
function getRandomPrompt(t: NotificationTranslator): string {
  const randomIndex = Math.floor(Math.random() * NOTIFICATION_PROMPT_KEYS.length);
  return t(NOTIFICATION_PROMPT_KEYS[randomIndex]);
}

/**
 * Pick one distinct prompt per weekday (1 = Sunday … 7 = Saturday) so the
 * repeating weekly reminders do not show the same sentence every morning.
 * The rotation is reshuffled each time the schedule is rebuilt.
 */
export function buildWeeklyPromptRotation(
  t: NotificationTranslator,
  random: () => number = Math.random
): Record<number, string> {
  const keys = [...NOTIFICATION_PROMPT_KEYS];
  for (let index = keys.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [keys[index], keys[swap]] = [keys[swap], keys[index]];
  }
  const rotation: Record<number, string> = {};
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    rotation[weekday] = t(keys[(weekday - 1) % keys.length]);
  }
  return rotation;
}

function getRitualReminderBody(t: NotificationTranslator, ritualId: RitualId): string {
  switch (ritualId) {
    case 'starter':
      return t('notifications.ritual.body.starter');
    case 'memory':
      return t('notifications.ritual.body.memory');
    case 'lucid':
      return t('notifications.ritual.body.lucid');
    default:
      return getRandomPrompt(t);
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

  const t = await getNotificationTranslator();

  const baseContent: Omit<Notifications.NotificationContentInput, 'body'> = {
    title: t('notifications.reminder.title'),
    data: { url: '/recording', [REMINDER_TYPE_DATA_KEY]: 'daily' },
    sound: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  };
  const promptByWeekday = buildWeeklyPromptRotation(t);
  const contentForWeekday = (weekday: number): Notifications.NotificationContentInput => ({
    ...baseContent,
    body: promptByWeekday[weekday] ?? getRandomPrompt(t),
  });

  if (settings.weekdayEnabled) {
    await scheduleWeeklyRemindersForDays({
      days: WEEKDAY_WEEKDAYS,
      time: settings.weekdayTime,
      content: contentForWeekday,
    });
  }

  if (settings.weekendEnabled) {
    await scheduleWeeklyRemindersForDays({
      days: WEEKEND_WEEKDAYS,
      time: settings.weekendTime,
      content: contentForWeekday,
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

  const t = await getNotificationTranslator();

  const baseContent: Notifications.NotificationContentInput = {
    title: t('inspiration.ritual.title'),
    body: getRitualReminderBody(t, ritualId),
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

  const t = await getNotificationTranslator();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('notifications.reminder.title'),
      body: getRandomPrompt(t),
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
/**
 * Schedule (or cancel) the weekly "your week in dreams" recap. It repeats every
 * Sunday morning and deep-links to the recap screen. Independent from the daily
 * reminders so a user can keep one without the other.
 */
export async function scheduleWeeklyRecapReminder(settings: NotificationSettings): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  await cancelScheduledReminders('weekly_recap');
  if (!settings.weeklyRecapEnabled) {
    return;
  }

  const t = await getNotificationTranslator();
  await scheduleWeeklyRemindersForDays({
    days: [WEEKLY_RECAP_WEEKDAY],
    time: WEEKLY_RECAP_TIME,
    content: {
      title: t('notifications.weekly_recap.title'),
      body: t('notifications.weekly_recap.body'),
      data: { url: WEEKLY_RECAP_URL, [REMINDER_TYPE_DATA_KEY]: 'weekly_recap' },
      sound: true,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
    },
  });
}

/**
 * Schedule (or clear) the single evening reminder for a streak that would end
 * at the next local midnight. Always replaces the previous one, so saving a
 * dream simply re-runs this with a fresh plan (or `null` to cancel).
 *
 * Independent from the daily reminders, the ritual reminders and the weekly
 * recap: only the `streak_risk` family is touched.
 */
export async function scheduleStreakRiskReminder(
  settings: NotificationSettings,
  plan: StreakRiskReminderPlan | null
): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  await cancelScheduledReminders('streak_risk');
  if (settings.streakRiskEnabled !== true || plan === null) {
    return;
  }

  const t = await getNotificationTranslator();
  await scheduleDatedReminder({
    triggerAt: plan.triggerAt,
    content: {
      title: t('notifications.streak_risk.title', { count: plan.streakLength }),
      body: t('notifications.streak_risk.body', { count: plan.streakLength }),
      data: { url: '/recording', [REMINDER_TYPE_DATA_KEY]: 'streak_risk' },
      sound: true,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
    },
  });

  if (__DEV__) {
    console.log(
      `Scheduled streak risk reminder for ${new Date(plan.triggerAt).toISOString()} (streak ${plan.streakLength})`
    );
  }
}

function getInactivityCopy(
  t: NotificationTranslator,
  stage: InactivityReminderStage
): { title: string; body: string } {
  const prefix = stage === 3 ? 'notifications.inactivity.day3' : 'notifications.inactivity.day7';
  return { title: t(`${prefix}.title`), body: t(`${prefix}.body`) };
}

/**
 * Schedule (or clear) the comeback reminders. The plan carries at most the two
 * stages still ahead (3 and 7 silent nights) and nothing beyond, so a dormant
 * user is nudged twice and then left alone.
 */
export async function scheduleInactivityReminders(
  settings: NotificationSettings,
  plans: readonly InactivityReminderPlan[]
): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  await cancelScheduledReminders('inactivity');
  if (settings.inactivityNudgeEnabled !== true || plans.length === 0) {
    return;
  }

  const t = await getNotificationTranslator();
  for (const plan of plans) {
    const copy = getInactivityCopy(t, plan.stage);
    await scheduleDatedReminder({
      triggerAt: plan.triggerAt,
      content: {
        title: copy.title,
        body: copy.body,
        data: {
          url: '/recording',
          [REMINDER_TYPE_DATA_KEY]: 'inactivity',
          inactivityStage: plan.stage,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
    });
  }

  if (__DEV__) {
    console.log(
      `Scheduled inactivity reminders: ${plans.map((plan) => `J+${plan.stage}`).join(', ')}`
    );
  }
}

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
