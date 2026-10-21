import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
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
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { locale } = useLocaleFormatting();

  const message = nudge.remaining === 0
    ? t('quota.free_nudge.empty', { date: formatQuotaResetDate(locale) })
    : nudge.remaining === 1
      ? t('quota.free_nudge.remaining_one')
      : t('quota.free_nudge.remaining', { remaining: nudge.remaining });
  const cta = t('quota.free_nudge.cta');

  return (
    <Pressable
      onPress={() => router.push(buildPaywallHref(nudge.trigger))}
      accessibilityRole="button"
      accessibilityLabel={`${message}. ${cta}`}
      testID={TID.Button.FreeAnalysesNudge}
      className={`min-h-[60px] flex-row items-center gap-3 border-t border-line py-4 active:opacity-70 ${className ?? ''}`}
    >
      <View className="w-10 items-center">
        <IconSymbol name="sparkles" size={22} color={noctalia.accent.text} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-sans text-body leading-[22px] text-ivory">{message}</Text>
        <Text className="font-sans-medium text-body-sm leading-[18px] text-champagne-on">{cta}</Text>
      </View>
      <IconSymbol name="chevron.right" size={18} color={noctalia.text.tertiary} />
    </Pressable>
  );
}
