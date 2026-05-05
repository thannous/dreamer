import type { Href } from 'expo-router';

import type { PaywallTrigger } from '@/lib/analytics';

export function buildPaywallHref(trigger: PaywallTrigger): Href {
  return {
    pathname: '/paywall',
    params: { trigger },
  } as Href;
}
