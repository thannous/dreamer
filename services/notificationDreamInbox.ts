import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { generateUUID } from '@/lib/dreamUtils';
import { logger } from '@/lib/logger';
import {
  addNotificationDreamCapture,
  claimNotificationDreamCaptures,
  isDreamCaptureResponse,
  parseDreamCaptureResponse,
  parseNotificationDreamInbox,
  removeNotificationDreamCaptures,
  type DreamCaptureResponseLike,
  type NotificationDreamCapture,
  type NotificationDreamInbox,
} from '@/lib/notificationDreamCapture';
import { presentDreamCapturedNotification } from '@/services/notificationService';

const INBOX_KEY = 'noctalia_notification_dream_inbox_v1';
/** The journal last open on this device; a reply made while the app is closed belongs to it. */
const SCOPE_KEY = 'noctalia_notification_dream_scope_v1';

type InboxListener = () => void;
const listeners = new Set<InboxListener>();

// Serializes read-modify-write cycles within one JS runtime.
let inboxWrite: Promise<unknown> = Promise.resolve();

function updateInbox<T>(
  update: (inbox: NotificationDreamInbox) => { inbox: NotificationDreamInbox; result: T }
): Promise<T> {
  const next = inboxWrite.then(async () => {
    const current = parseNotificationDreamInbox(await AsyncStorage.getItem(INBOX_KEY));
    const { inbox, result } = update(current);
    if (inbox !== current) {
      await AsyncStorage.setItem(INBOX_KEY, JSON.stringify(inbox));
    }
    return result;
  });
  inboxWrite = next.catch(() => undefined);
  return next;
}

export async function readNotificationDreamInbox(): Promise<NotificationDreamCapture[]> {
  await inboxWrite;
  return parseNotificationDreamInbox(await AsyncStorage.getItem(INBOX_KEY)).captures;
}

export async function removeImportedNotificationDreams(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await updateInbox((inbox) => ({ inbox: removeNotificationDreamCaptures(inbox, ids), result: undefined }));
}

export async function rememberNotificationDreamScope(scope: string): Promise<void> {
  await AsyncStorage.setItem(SCOPE_KEY, scope);
}

export async function claimNotificationDreams(ids: readonly string[], scope: string): Promise<void> {
  if (ids.length === 0) return;
  await updateInbox((inbox) => ({ inbox: claimNotificationDreamCaptures(inbox, ids, scope), result: undefined }));
}

/** Lets the mounted journal import a reply that arrived while the app was alive. */
export function subscribeNotificationDreamInbox(listener: InboxListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Handles a reminder reply wherever it arrives: the foreground listener, the
 * last response read at launch, or the Android headless task. Returns true when
 * the response was a dream reply, so callers skip the usual "open capture"
 * navigation: the user answered from the watch and expects nothing to open.
 */
export async function captureDreamFromNotificationResponse(
  response: DreamCaptureResponseLike | null | undefined
): Promise<boolean> {
  if (!isDreamCaptureResponse(response)) return false;

  const parsed = parseDreamCaptureResponse(response, {
    now: Date.now(),
    createClientRequestId: generateUUID,
  });
  // Owned from the start by the journal open when the reminder was answered,
  // so an expired session or another sign-in later cannot take it.
  const ownerScope = parsed ? await AsyncStorage.getItem(SCOPE_KEY).catch(() => null) : null;
  const capture = parsed && ownerScope ? { ...parsed, ownerScope } : parsed;

  // Keep the words first. Everything after this is feedback.
  const added = capture
    ? await updateInbox((inbox) => {
        const outcome = addNotificationDreamCapture(inbox, capture);
        return { inbox: outcome.inbox, result: outcome.added };
      })
    : false;
  if (added) listeners.forEach((listener) => listener());

  const rawIdentifier = response?.notification?.request?.identifier;
  const identifier = typeof rawIdentifier === 'string' && rawIdentifier ? rawIdentifier : undefined;

  let replaced = false;
  if (added) {
    // On Android the notice replaces the replied reminder, which also ends its
    // reply spinner and removes its reply button.
    replaced = await presentDreamCapturedNotification(identifier).then(
      () => Platform.OS === 'android',
      (error) => {
        logger.warn('[NotificationDreamInbox] Unable to confirm the dictated dream', error);
        return false;
      }
    );
  }

  // A duplicate delivery (Android hands a background reply to both the
  // listener and the task) must not dismiss the notice the first one posted
  // under the same identifier.
  const duplicate = Boolean(capture) && !added;
  if (identifier && !replaced && !(Platform.OS === 'android' && duplicate)) {
    // Android 15+ ignores this for a replied notification; older versions and
    // iOS still remove it.
    await Notifications.dismissNotificationAsync(identifier).catch(() => undefined);
  }

  return true;
}
