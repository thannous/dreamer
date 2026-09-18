import type { QuotaStatus, SubscriptionTier } from '@/lib/types';

export type SavedAnalysisAction = 'analyze' | 'upgrade' | 'signup' | 'login' | 'checking' | 'check';

/** Permission is authoritative; remaining counts may be stale, negative or degraded. */
export function getSavedAnalysisAction(input: {
  tier: SubscriptionTier;
  loading: boolean;
  error?: Error | null;
  status?: QuotaStatus | null;
}): SavedAnalysisAction {
  if (input.loading) return 'checking';
  const status = input.status;
  if (input.error || !status || status.guestBootstrapStatus === 'degraded'
    || status.guestBootstrapStatus === 'disabled') return 'check';
  if (status.canAnalyze) return 'analyze';
  if (input.tier === 'plus') return 'check';
  if (input.tier === 'guest') return status.isUpgraded ? 'login' : 'signup';
  return 'upgrade';
}
