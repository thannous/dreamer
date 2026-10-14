/**
 * Dream capture from a notification reply.
 *
 * The morning reminder carries a text-input action. On a paired watch (Apple
 * Watch mirrors iPhone notifications, Wear OS bridges Android ones) or on the
 * lock screen, the user dictates the dream and sends it without opening the
 * app. The reply lands in a small durable inbox first, because the app may be
 * running headless or about to be suspended; the journal imports it the next
 * time it is mounted.
 *
 * No React, Expo, or platform imports - this module is the part tests pin down.
 */

// Expo warns that `:` and `-` in a category identifier can break the category.
export const DREAM_CAPTURE_CATEGORY_ID = 'dreamerDreamCapture';
export const DICTATE_DREAM_ACTION_ID = 'dictateDream';

/** Headless task that receives Android action replies while the app is not in the foreground. */
export const DREAM_CAPTURE_BACKGROUND_TASK = 'dreamer-dream-capture-response';

/** Generous cap: a long dictated dream, never an accidental paste of a book. */
export const MAX_NOTIFICATION_DREAM_LENGTH = 20_000;
/** How many imported reply ids are remembered to ignore late redeliveries. */
export const MAX_NOTIFICATION_DREAM_INBOX_SIZE = 50;

export type NotificationDreamCapture = {
  /** Stable per reply: the same response delivered twice maps to one capture. */
  id: string;
  text: string;
  capturedAt: number;
  /** Reused as the dream's idempotency key, so a retried import never duplicates. */
  clientRequestId: string;
  /**
   * The journal the reply belongs to (`guest` or `user:<id>`), set by the
   * first journal that tries to import it, so it never lands in another account.
   */
  ownerScope?: string;
};

/** The subset of an expo-notifications response this feature reads. */
export type DreamCaptureResponseLike = {
  actionIdentifier?: unknown;
  userText?: unknown;
  notification?: {
    date?: unknown;
    request?: { identifier?: unknown };
  } | null;
};

export function isDreamCaptureResponse(response: DreamCaptureResponseLike | null | undefined): boolean {
  return response?.actionIdentifier === DICTATE_DREAM_ACTION_ID;
}

/**
 * Turns a notification reply into a capture, or null when it is not a dream
 * reply or carries no words. `capturedAt` is the moment the reply was handled;
 * the notification's own date only makes the id stable across redeliveries.
 */
export function parseDreamCaptureResponse(
  response: DreamCaptureResponseLike | null | undefined,
  options: { now: number; createClientRequestId: () => string }
): NotificationDreamCapture | null {
  if (!response || !isDreamCaptureResponse(response)) return null;
  if (typeof response.userText !== 'string') return null;

  const text = response.userText.trim().slice(0, MAX_NOTIFICATION_DREAM_LENGTH);
  if (!text) return null;

  const identifier = response.notification?.request?.identifier;
  const date = response.notification?.date;
  const requestId = typeof identifier === 'string' && identifier ? identifier : 'unknown';
  const deliveredAt = typeof date === 'number' && Number.isFinite(date) ? Math.round(date) : options.now;

  return {
    // The text is part of the id: a redelivered reply keeps its id, while a
    // second, different reply to the same notification is a new dream.
    id: `${requestId}:${deliveredAt}:${hashText(text)}`,
    text,
    capturedAt: options.now,
    clientRequestId: options.createClientRequestId(),
  };
}

/** Small stable string hash (djb2), enough to tell two replies apart. */
function hashText(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function isCapture(value: unknown): value is NotificationDreamCapture {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    entry.id.length > 0 &&
    typeof entry.text === 'string' &&
    entry.text.trim().length > 0 &&
    typeof entry.capturedAt === 'number' &&
    Number.isFinite(entry.capturedAt) &&
    typeof entry.clientRequestId === 'string' &&
    entry.clientRequestId.length > 0 &&
    (entry.ownerScope === undefined || typeof entry.ownerScope === 'string')
  );
}

export type NotificationDreamInbox = {
  /** Replies kept on the device, waiting for the journal to import them. */
  captures: NotificationDreamCapture[];
  /**
   * Recent reply ids, kept after import. The same response can come back from
   * the live listener, the last response read at launch and the Android task.
   */
  seenIds: string[];
};

/** Reads a stored inbox, dropping anything malformed instead of failing the whole queue. */
export function parseNotificationDreamInbox(serialized: string | null | undefined): NotificationDreamInbox {
  if (!serialized) return { captures: [], seenIds: [] };
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!parsed || typeof parsed !== 'object') return { captures: [], seenIds: [] };
    const raw = parsed as { captures?: unknown; seenIds?: unknown };
    return {
      captures: Array.isArray(raw.captures) ? raw.captures.filter(isCapture) : [],
      seenIds: Array.isArray(raw.seenIds)
        ? raw.seenIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
        : [],
    };
  } catch {
    return { captures: [], seenIds: [] };
  }
}

/** Adds a reply once. A redelivered reply, even after its import, is ignored. */
export function addNotificationDreamCapture(
  inbox: NotificationDreamInbox,
  capture: NotificationDreamCapture
): { inbox: NotificationDreamInbox; added: boolean } {
  if (inbox.seenIds.includes(capture.id) || inbox.captures.some((entry) => entry.id === capture.id)) {
    return { inbox, added: false };
  }
  return {
    inbox: {
      // Pending replies are never evicted: each one was already confirmed to the user.
      captures: [...inbox.captures, capture],
      seenIds: inbox.seenIds,
    },
    added: true,
  };
}

/** Drops imported replies while remembering their ids. */
export function removeNotificationDreamCaptures(
  inbox: NotificationDreamInbox,
  ids: readonly string[]
): NotificationDreamInbox {
  const removed = new Set(ids);
  // Remembered at import, so waiting replies never push an imported id out of the history.
  const imported = inbox.captures.filter((entry) => removed.has(entry.id)).map((entry) => entry.id);
  return {
    captures: inbox.captures.filter((entry) => !removed.has(entry.id)),
    seenIds: [...inbox.seenIds.filter((id) => !removed.has(id)), ...imported].slice(
      -MAX_NOTIFICATION_DREAM_INBOX_SIZE
    ),
  };
}

export const GUEST_DREAM_SCOPE = 'guest';

export function notificationDreamScope(userId: string | null | undefined): string {
  return userId ? `user:${userId}` : GUEST_DREAM_SCOPE;
}

/**
 * A waiting reply goes only to the journal it was meant for. Like the guest
 * journal itself, a guest's reply moves to the account that signs in here.
 */
export function canImportNotificationDream(capture: NotificationDreamCapture, scope: string): boolean {
  if (!capture.ownerScope || capture.ownerScope === scope) return true;
  return capture.ownerScope === GUEST_DREAM_SCOPE && scope !== GUEST_DREAM_SCOPE;
}

/**
 * Ties replies to the journal about to import them. An unowned reply, or a
 * guest's reply taken over by the account that signs in, now belongs to that
 * journal; any other owner is kept.
 */
export function claimNotificationDreamCaptures(
  inbox: NotificationDreamInbox,
  ids: readonly string[],
  scope: string
): NotificationDreamInbox {
  const claimed = new Set(ids);
  const takes = (entry: NotificationDreamCapture) =>
    claimed.has(entry.id) &&
    entry.ownerScope !== scope &&
    (!entry.ownerScope || (entry.ownerScope === GUEST_DREAM_SCOPE && scope !== GUEST_DREAM_SCOPE));
  if (!inbox.captures.some(takes)) return inbox;
  return {
    ...inbox,
    captures: inbox.captures.map((entry) => (takes(entry) ? { ...entry, ownerScope: scope } : entry)),
  };
}
