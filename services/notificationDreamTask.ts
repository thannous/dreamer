import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { DREAM_CAPTURE_BACKGROUND_TASK } from '@/lib/notificationDreamCapture';
import { captureDreamFromNotificationResponse } from '@/services/notificationDreamInbox';

const CAPTURE_ATTEMPTS = 3;

/**
 * Android runs a reminder reply in a headless JS instance when the app is in
 * the background or closed, so the task must be defined while the bundle is
 * evaluated (see `index.ts`). iOS wakes the app itself and delivers the reply
 * to the regular response listener instead.
 */
if (Platform.OS === 'android') {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(
    DREAM_CAPTURE_BACKGROUND_TASK,
    async ({ data }) => {
      if (!data || !('actionIdentifier' in data)) return;
      // Nothing replays a reply once this headless run ends, so a storage
      // hiccup gets a few more tries before the words are given up.
      for (let attempt = 1; ; attempt += 1) {
        try {
          await captureDreamFromNotificationResponse(data);
          return;
        } catch (error) {
          if (attempt >= CAPTURE_ATTEMPTS) throw error;
          await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
        }
      }
    }
  );
}

let registered = false;

/** Safe to call on every return to the app: a failed registration is retried. */
export async function registerDreamCaptureBackgroundTask(): Promise<void> {
  if (Platform.OS !== 'android' || registered) return;
  try {
    await Notifications.registerTaskAsync(DREAM_CAPTURE_BACKGROUND_TASK);
    registered = true;
  } catch (error) {
    if (__DEV__) {
      console.warn('[NotificationDreamTask] Unable to register the reply task', error);
    }
  }
}
