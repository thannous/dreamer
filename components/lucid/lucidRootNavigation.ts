import type { Href } from 'expo-router';
import { LUCID_HEALTH_IMPORT_ENABLED } from '@/lib/lucid/healthKitSleep';
import { LUCID_PLUS_SALES_ENABLED } from '@/lib/lucid/plusEntitlements';
import { isLucidAppPath } from '@/lib/lucid/routes';

// Routes the Lucid stack guards off in this release; a cold-start link to one must not wait on it.
const releaseHiddenPaths: readonly string[] = [
  ...(LUCID_PLUS_SALES_ENABLED ? [] : ['/lucid/subscription']),
  ...(LUCID_HEALTH_IMPORT_ENABLED ? [] : ['/lucid/sleep-integration']),
];

const isSharedAuthPath = (path: string) =>
  ['/auth/callback', '/auth/callback/success', '/auth/reset-password'].includes(path);

export function normalizedLucidDestination(href: Href | string | null | undefined): string {
  const path = typeof href === 'string' ? href : String(href?.pathname ?? '');
  return path.split(/[?#]/)[0].replace('/(tabs)', '').replace(/\/+$/, '') || '/';
}

/** Preserve only this product's links, including the shared authentication return routes. */
export function lucidStartupDestination(url: string | null, observed: string, web: boolean): Href {
  if (url) {
    try {
      const parsed = new URL(url);
      const custom = parsed.protocol === 'noctalia-lucid:';
      const trusted = custom || (parsed.protocol === 'https:' && parsed.hostname === 'lucid.noctalia.app');
      const path = custom && parsed.hostname ? `/${parsed.hostname}${parsed.pathname}` : parsed.pathname;
      const allowed = isLucidAppPath(path) && !releaseHiddenPaths.includes(normalizedLucidDestination(path));
      if ((trusted || web) && (allowed || isSharedAuthPath(path))) {
        return `${path}${parsed.search}${parsed.hash}` as Href;
      }
    } catch { /* Malformed links fall back to the local entry. */ }
  }
  if (isSharedAuthPath(normalizedLucidDestination(observed))) return observed as Href;
  return '/lucid';
}
