import type { User } from '@supabase/supabase-js';

import type { SubscriptionTier } from './types';

export function normalizeSubscriptionTier(
  value: unknown,
  fallback: SubscriptionTier = 'free'
): SubscriptionTier {
  if (value === 'guest' || value === 'free' || value === 'plus') return value;
  if (value === 'premium') return 'plus';
  return fallback;
}

export function deriveUserTier(user: User | null): SubscriptionTier {
  if (!user) return 'guest';
  // ✅ CRITICAL FIX: Read from app_metadata (admin-only) instead of user_metadata (client-modifiable)
  return normalizeSubscriptionTier(user.app_metadata?.tier, 'free');
}
