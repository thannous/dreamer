import type { User } from '@supabase/supabase-js';

import type { SubscriptionTier } from './types';

export function deriveUserTier(user: User | null): SubscriptionTier {
  if (!user) return 'guest';
  // ✅ CRITICAL FIX: Read from app_metadata (admin-only) instead of user_metadata (client-modifiable)
  const tier = user.app_metadata?.tier as SubscriptionTier | undefined;
  return tier ?? 'free';
}

