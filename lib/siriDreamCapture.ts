/**
 * Dream capture from Siri ("Note a dream", `app-intents/NoteDreamIntent.swift`).
 *
 * Siri hands the dictated words to a native queue and tells the user the dream
 * is kept. The journal then moves each one into the same device inbox as a
 * reminder reply, so ownership, guest limits and import work the same way.
 *
 * No React, Expo, or platform imports.
 */

import { MAX_NOTIFICATION_DREAM_LENGTH, type NotificationDreamCapture } from '@/lib/notificationDreamCapture';

/** The dispatch name `NoteDreamIntent` uses. Changing it strands dreams queued by an older build. */
export const NOTE_DREAM_INTENT = 'noteDream';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The subset of an expo-app-intents invocation this feature reads. */
export type SiriDreamInvocationLike = {
  id: string;
  name: string;
  params: Record<string, unknown>;
  createdAt: number;
};

const SIRI_CAPTURE_PREFIX = 'siri:';

/** Whether an inbox capture was told to Siri, so its words came from recognized speech. */
export function isSiriDreamCapture(capture: Pick<NotificationDreamCapture, 'id'>): boolean {
  return capture.id.startsWith(SIRI_CAPTURE_PREFIX);
}

/**
 * Turns a Siri invocation into a capture, or null when it carries no words.
 * The id comes from the invocation, so a redelivered one maps to the same capture.
 */
export function parseSiriDreamInvocation(
  invocation: SiriDreamInvocationLike,
  options: { now: number; createClientRequestId: () => string }
): NotificationDreamCapture | null {
  if (invocation.name !== NOTE_DREAM_INTENT || !invocation.id) return null;
  const rawText = invocation.params.text;
  if (typeof rawText !== 'string') return null;

  const text = rawText.trim().slice(0, MAX_NOTIFICATION_DREAM_LENGTH);
  if (!text) return null;

  return {
    id: `${SIRI_CAPTURE_PREFIX}${invocation.id}`,
    text,
    // The moment it was told to Siri, which can be hours before the app runs.
    capturedAt: Number.isFinite(invocation.createdAt) ? Math.round(invocation.createdAt) : options.now,
    // The native id is a UUID: reused as the dream's idempotency key, a replay
    // of an imported dream is refused by the journal itself, not only the inbox.
    clientRequestId: UUID_PATTERN.test(invocation.id)
      ? invocation.id.toLowerCase()
      : options.createClientRequestId(),
  };
}
