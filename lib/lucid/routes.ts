import type { Href } from 'expo-router';

export const LUCID_HOME_HREF = '/lucid' as const;
export const LUCID_ONBOARDING_HREF = '/lucid/onboarding' as const;

export type LucidOnboardingGateHref =
  | typeof LUCID_HOME_HREF
  | typeof LUCID_ONBOARDING_HREF;

export type LucidNotificationRoute =
  | '/lucid'
  | '/lucid/morning'
  | '/lucid/reality-check'
  | '/lucid/weekly'
  | '/lucid/program/mild'
  | '/lucid/program/ssild'
  | '/lucid/program/wbtb'
  | '/lucid/(tabs)'
  | '/lucid/(tabs)/night'
  | '/lucid/(tabs)/progress'
  | '/lucid/(tabs)/programs'
  | '/lucid/(tabs)/settings';

const SAFE_LUCID_NOTIFICATION_ROUTES: ReadonlySet<string> = new Set<LucidNotificationRoute>([
  '/lucid',
  '/lucid/morning',
  '/lucid/reality-check',
  '/lucid/weekly',
  '/lucid/program/mild',
  '/lucid/program/ssild',
  '/lucid/program/wbtb',
  '/lucid/(tabs)',
  '/lucid/(tabs)/night',
  '/lucid/(tabs)/progress',
  '/lucid/(tabs)/programs',
  '/lucid/(tabs)/settings',
]);

export function isSafeLucidNotificationRoute(
  value: unknown
): value is LucidNotificationRoute {
  return typeof value === 'string' && SAFE_LUCID_NOTIFICATION_ROUTES.has(value);
}

export type LucidBackNavigation = {
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: Href) => void;
};

export function closeLucidRoute(
  navigation: LucidBackNavigation,
  fallback: Href
): void {
  if (navigation.canGoBack()) {
    navigation.back();
    return;
  }
  navigation.replace(fallback);
}

export function normalizeLucidPathname(pathname: string | null | undefined): string {
  if (!pathname) return '';
  const trimmed = pathname.trim();
  if (trimmed.length > 1 && trimmed.endsWith('/')) {
    return trimmed.replace(/\/+$/, '') || '/';
  }
  return trimmed;
}

export function isLucidOnboardingPath(pathname: string | null | undefined): boolean {
  return normalizeLucidPathname(pathname) === LUCID_ONBOARDING_HREF;
}

export function isLucidHomePath(pathname: string | null | undefined): boolean {
  const path = normalizeLucidPathname(pathname);
  return path === LUCID_HOME_HREF || path === '/lucid/(tabs)';
}

/**
 * Decide whether the Lucid shell must leave onboarding or return to it.
 * Returns null when the current path is already the right place, so callers
 * can avoid replace loops on web where `/lucid/(tabs)` and `/lucid` collide.
 */
export function resolveLucidOnboardingGate(input: {
  pathname: string | null | undefined;
  onboardingStatus: 'not_started' | 'in_progress' | 'completed' | undefined;
  loading?: boolean;
}): LucidOnboardingGateHref | null {
  if (input.loading || !input.onboardingStatus) return null;
  const complete = input.onboardingStatus === 'completed';
  const inOnboarding = isLucidOnboardingPath(input.pathname);
  if (!complete && !inOnboarding) return LUCID_ONBOARDING_HREF;
  if (complete && inOnboarding) return LUCID_HOME_HREF;
  return null;
}
