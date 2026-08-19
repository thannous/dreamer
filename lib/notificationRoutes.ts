/**
 * In-app routes that a Noctalia (non-Lucid) notification may open. Kept as an
 * allowlist so a malformed or spoofed payload can never navigate anywhere else.
 * `/recording` is handled separately because it persists a pending intent.
 */
export const SAFE_APP_NOTIFICATION_ROUTES = new Set<string>(['/weekly-recap']);

export type AppNotificationRoute = '/weekly-recap';

export function isSafeAppNotificationRoute(value: unknown): value is AppNotificationRoute {
  return typeof value === 'string' && SAFE_APP_NOTIFICATION_ROUTES.has(value);
}
