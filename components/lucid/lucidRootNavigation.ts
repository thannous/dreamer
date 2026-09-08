import type { Href } from 'expo-router';
import { isLucidAppPath } from '@/lib/lucid/routes';

const isSharedAuthPath = (path: string) =>
  ['/auth/callback', '/auth/callback/success', '/auth/reset-password'].includes(path);

export function normalizedLucidDestination(href: Href | null | undefined): string {
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
      if ((trusted || web) && (isLucidAppPath(path) || isSharedAuthPath(path))) {
        return `${path}${parsed.search}${parsed.hash}` as Href;
      }
    } catch { /* Malformed links fall back to the local entry. */ }
  }
  if (isSharedAuthPath(normalizedLucidDestination(observed))) return observed as Href;
  return '/lucid';
}
