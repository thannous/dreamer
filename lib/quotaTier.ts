import type { User } from '@supabase/supabase-js';

import type { SubscriptionTier } from './types';

export function deriveUserTier(user: User | null): SubscriptionTier {
  if (!user) return 'guest';
  const tier = user.user_metadata?.tier as SubscriptionTier | undefined;
  return tier ?? 'free';
}

