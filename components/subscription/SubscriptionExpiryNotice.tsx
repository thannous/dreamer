import React from 'react';
import { Text, View } from 'react-native';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useTranslation } from '@/hooks/useTranslation';
import { isEntitlementExpired } from '@/lib/revenuecat';
import type { SubscriptionStatus } from '@/lib/types';

/** Inform without confusing a cancelled renewal or a new free account with expiry. */
export function SubscriptionExpiryNotice({ status, loading = false }: {
  status?: SubscriptionStatus | null;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const { formatDate } = useLocaleFormatting();
  if (loading || !status || status.isActive || !isEntitlementExpired(status.expiryDate ?? null)) return null;
  const date = formatDate(new Date(status.expiryDate!), {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  return (
    <View className="my-3 rounded-md border border-line bg-ink-soft px-4 py-3" testID="subscription-expired-notice">
      <Text accessibilityRole="alert" className="font-sans text-[14px] leading-6 text-ivory-muted">
        {t('subscription.expired.notice', { date })}
      </Text>
    </View>
  );
}
