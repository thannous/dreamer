import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationSettings } from '@/lib/types';

// Array of smart, motivational notification prompts
const NOTIFICATION_PROMPTS = [
  'Good morning! Capture your dreams before they fade away.',
  'What did you dream about last night? Take a moment to record it.',
  'Your dreams are waiting to be remembered. Open your journal.',
  'Morning check-in: Did you have any interesting dreams?',
  'Dreams hold valuable insights. Record yours now.',
  'Time to journal! What messages did your dreams bring?',
  'Your subconscious has been busy. What did you dream?',
  'Start your day by recording last night\'s dreams.',
  'Don\'t let your dreams slip away. Journal them now.',
  'Good morning dreamer! What adventures did you have last night?',
  'Your dream journal is calling. What did you experience?',
  'Unlock the meaning of your dreams. Record them while fresh.',
  'Morning ritual: Capture your dreams for reflection.',
  'What story did your mind tell you last night?',
  'Dreams fade fast. Take a minute to preserve yours.',
];

// Notification channel for Android
const NOTIFICATION_CHANNEL_ID = 'dream-reminders';

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

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  // Android: Create notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: 'Dream Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B6B',
    });
  }

  return finalStatus === 'granted';
}

/**
 * Get a random notification prompt from the array
 */
function getRandomPrompt(): string {
  const randomIndex = Math.floor(Math.random() * NOTIFICATION_PROMPTS.length);
  return NOTIFICATION_PROMPTS[randomIndex];
}

/**
 * Schedule daily notification based on settings
 */
export async function scheduleDailyNotification(settings: NotificationSettings): Promise<void> {
  if (Platform.OS === 'web') {
    // Web notifications not supported
    return;
  }

  // Cancel all existing notifications first
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!settings.isEnabled) {
    return;
  }

  // Parse time string (HH:MM)
  const timeToUse = settings.weekdayTime; // For now, using single time
  const [hours, minutes] = timeToUse.split(':').map(Number);

  // Schedule for weekdays (Monday-Friday)
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
      // Note: expo-notifications doesn't support weekday-specific triggers directly
      // The notification will fire daily. For weekday-specific logic, we'd need
      // to check in the notification handler or use a different approach
    },
  });

  if (__DEV__) {
    console.log(`Scheduled daily notification for ${timeToUse}`);
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

  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}
