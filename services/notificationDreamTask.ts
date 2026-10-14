import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { DREAM_CAPTURE_BACKGROUND_TASK } from '@/lib/notificationDreamCapture';
import { captureDreamFromNotificationResponse } from '@/services/notificationDreamInbox';

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
      await captureDreamFromNotificationResponse(data);
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
