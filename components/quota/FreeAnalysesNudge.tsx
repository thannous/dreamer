import { router } from 'expo-router';
import React from 'react';

import { NudgeRow } from '@/components/ui/NudgeRow';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useTranslation } from '@/hooks/useTranslation';
import type { PaywallTrigger } from '@/lib/analytics';
import { buildPaywallHref } from '@/lib/paywallRoute';
import { formatQuotaResetDate } from '@/lib/quotaReset';
import { TID } from '@/lib/testIDs';
import type { QuotaUsage, SubscriptionTier } from '@/lib/types';

export type FreeAnalysesNudgeState = {
  remaining: number;
  trigger: PaywallTrigger;
};

/**
 * A signed-in free account sees how many included analyses are left this month,
 * with a path to Plus. Guests, Plus and unknown quotas get nothing. A failed
 * refresh keeps the previous usage, so an error hides the row until it succeeds.
 */
export function getFreeAnalysesNudge({
  tier,
  signedIn,
  loading,
  error,
  usage,
  maxRemaining,
}: {
  tier: SubscriptionTier;
  signedIn: boolean;
  loading: boolean;
  error?: Error | null;
  usage?: QuotaUsage | null;
  maxRemaining?: number;
}): FreeAnalysesNudgeState | null {
  if (!signedIn || tier !== 'free' || loading || error) return null;
  const metric = usage?.analysis;
  if (typeof metric?.limit !== 'number' || typeof metric.remaining !== 'number') return null;
  const remaining = Math.max(0, metric.remaining);
  if (maxRemaining !== undefined && remaining > maxRemaining) return null;
  return { remaining, trigger: remaining > 0 ? 'settings_quota' : 'analysis_limit' };
}

type Props = {
  nudge: FreeAnalysesNudgeState;
  className?: string;
};

export function FreeAnalysesNudge({ nudge, className }: Props) {
  const { t } = useTranslation();
  const { locale } = useLocaleFormatting();

  const message = nudge.remaining === 0
    ? t('quota.free_nudge.empty', { date: formatQuotaResetDate(locale) })
    : nudge.remaining === 1
      ? t('quota.free_nudge.remaining_one')
      : t('quota.free_nudge.remaining', { remaining: nudge.remaining });
  return (
    <NudgeRow
      icon="sparkles"
      message={message}
      cta={t('quota.free_nudge.cta')}
      onPress={() => router.push(buildPaywallHref(nudge.trigger))}
      testID={TID.Button.FreeAnalysesNudge}
      className={className}
    />
  );
}
