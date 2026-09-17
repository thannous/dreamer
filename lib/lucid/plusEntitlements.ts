import type { SubscriptionStatus } from '@/lib/types';

export const LUCID_PLUS_FEATURE_IDS = [
  'journal_text',
  'programs_mild_ssild_wbtb',
  'mindful_pauses',
  'morning_review',
  'safety',
  'night_stop',
  'local_storage',
  'export',
  'delete',
  'basic_stats',
  'weekly_recommendation',
  'accessibility',
  'dream_atlas',
  'dream_atlas_grouping',
  'dream_atlas_sources',
  'dream_atlas_delete',
  'first_immersive_rehearsal',
  'additional_immersive_rehearsal',
  'expanded_trends_comparisons',
  'premium_interpretation',
  'shared_account_entitlement',
] as const;

export type LucidPlusFeatureId = (typeof LUCID_PLUS_FEATURE_IDS)[number];

export type LucidPlusFeatureAccess = 'always_free' | 'plus_only';

export const LUCID_PLUS_CURRENT_BENEFIT_IDS = [
  'additional_immersive_rehearsal',
  'expanded_trends_comparisons',
  'premium_interpretation',
  'shared_account_entitlement',
] as const;

export type LucidPlusBenefitId = (typeof LUCID_PLUS_CURRENT_BENEFIT_IDS)[number];

export const LUCID_PLUS_PAYWALL_FREE_FEATURE_IDS = [
  'journal_text',
  'programs_mild_ssild_wbtb',
  'mindful_pauses',
  'morning_review',
  'safety',
  'night_stop',
  'local_storage',
  'export',
  'delete',
  'basic_stats',
  'weekly_recommendation',
  'accessibility',
  'dream_atlas',
  'first_immersive_rehearsal',
] as const;

export type LucidPlusPaywallFreeFeatureId =
  (typeof LUCID_PLUS_PAYWALL_FREE_FEATURE_IDS)[number];

export const LUCID_PLUS_FEATURE_MATRIX: Record<
  LucidPlusFeatureId,
  LucidPlusFeatureAccess
> = {
  journal_text: 'always_free',
  programs_mild_ssild_wbtb: 'always_free',
  mindful_pauses: 'always_free',
  morning_review: 'always_free',
  safety: 'always_free',
  night_stop: 'always_free',
  local_storage: 'always_free',
  export: 'always_free',
  delete: 'always_free',
  basic_stats: 'always_free',
  weekly_recommendation: 'always_free',
  accessibility: 'always_free',
  dream_atlas: 'always_free',
  dream_atlas_grouping: 'always_free',
  dream_atlas_sources: 'always_free',
  dream_atlas_delete: 'always_free',
  first_immersive_rehearsal: 'always_free',
  additional_immersive_rehearsal: 'plus_only',
  expanded_trends_comparisons: 'plus_only',
  premium_interpretation: 'plus_only',
  shared_account_entitlement: 'plus_only',
};

export type LucidPlusRehearsalSessionStatus =
  | 'active'
  | 'paused'
  | 'interrupted'
  | 'completed';

export type LucidPlusRehearsalAccess =
  | { status: 'allowed'; reason: 'preview' | 'plus' | 'resume' }
  | { status: 'checking' }
  | { status: 'upgrade_required' };

export type LucidPlusRehearsalAccessInput = {
  subscriptionStatus: Pick<SubscriptionStatus, 'tier' | 'isActive'> | null;
  loading: boolean;
  requiresAuth: boolean;
  completionCount: number;
  currentSession: { status: LucidPlusRehearsalSessionStatus } | null;
};

const IN_PROGRESS_STATUSES: ReadonlySet<LucidPlusRehearsalSessionStatus> = new Set([
  'active',
  'paused',
  'interrupted',
]);

export function getLucidPlusFeatureAccess(
  featureId: LucidPlusFeatureId
): LucidPlusFeatureAccess {
  return LUCID_PLUS_FEATURE_MATRIX[featureId];
}

export function isLucidPlusFeatureAlwaysFree(
  featureId: LucidPlusFeatureId
): boolean {
  return LUCID_PLUS_FEATURE_MATRIX[featureId] === 'always_free';
}

export function listLucidPlusPaywallItems<T extends string, V>(
  ids: readonly T[],
  copy: Record<T, V>
): readonly { id: T; label: V }[] {
  return ids.map((id) => ({ id, label: copy[id] }));
}

function isConfirmedPlus(
  status: Pick<SubscriptionStatus, 'tier' | 'isActive'> | null,
  loading: boolean
): boolean {
  if (loading || !status) return false;
  return status.tier === 'plus' && status.isActive === true;
}

export function resolveLucidAdditionalDreamRehearsalAccess(
  input: LucidPlusRehearsalAccessInput
): LucidPlusRehearsalAccess {
  const completionCount = Number.isFinite(input.completionCount)
    ? Math.max(0, Math.floor(input.completionCount))
    : 0;
  const sessionStatus = input.currentSession?.status ?? null;

  if (sessionStatus && IN_PROGRESS_STATUSES.has(sessionStatus)) {
    return { status: 'allowed', reason: 'resume' };
  }

  if (completionCount < 1) {
    return { status: 'allowed', reason: 'preview' };
  }

  if (!input.requiresAuth && isConfirmedPlus(input.subscriptionStatus, input.loading)) {
    return { status: 'allowed', reason: 'plus' };
  }

  if (!input.requiresAuth && (input.loading || input.subscriptionStatus == null)) {
    return { status: 'checking' };
  }

  return { status: 'upgrade_required' };
}

export function canStartLucidDreamRehearsal(
  access: LucidPlusRehearsalAccess
): boolean {
  return access.status === 'allowed';
}
