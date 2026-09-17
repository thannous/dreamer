import { isJournalNotificationUrl, WEEKLY_RECAP_NOTIFICATION_URL } from './dreamerNotifications';

/**
 * In-app routes that a Noctalia (non-Lucid) notification may open. Kept as an
 * allowlist so a malformed or spoofed payload can never navigate anywhere else.
 * `/recording` is handled separately because it persists a pending intent.
 * `/weekly-recap` is also a static native cold-start route; keep this URL
 * identical to the onboarding allowlist so a recap launch cannot fall back
 * to `/recording`.
 */

export const SAFE_APP_NOTIFICATION_ROUTES = new Set<string>([WEEKLY_RECAP_NOTIFICATION_URL]);

export type AppNotificationRoute = typeof WEEKLY_RECAP_NOTIFICATION_URL | `/journal/${number}`;

export function isSafeAppNotificationRoute(value: unknown): value is AppNotificationRoute {
  return (
    (typeof value === 'string' && SAFE_APP_NOTIFICATION_ROUTES.has(value)) ||
    isJournalNotificationUrl(value)
  );
}
