import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useDreams } from '@/context/DreamsContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useQuota } from '@/hooks/useQuota';
import { TID } from '@/lib/testIDs';
import { getGuestDreamRecordingLimit } from '@/lib/guestLimits';
import { buildPaywallHref } from '@/lib/paywallRoute';
import { router } from 'expo-router';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { QUOTAS } from '@/constants/limits';
import {
  getLocalDreamRecordingCount,
  subscribeGuestDreamRecordingCount,
} from '@/services/quota/GuestDreamCounter';
import { getMonthlyQuotaPeriod } from '@/lib/quotaReset';

type UsageEntry = {
  used: number;
  limit: number | null;
  remaining: number | null;
};

type Props = {
  onUpgradePress?: () => void;
  presentation?: 'card' | 'embedded';
};

const formatUsage = (usage?: UsageEntry, unlimitedLabel?: string) => {
  if (!usage) return '—';
  if (usage.limit === null) {
    return unlimitedLabel ?? 'Unlimited';
  }
  const used = usage.used ?? 0;
  return `${Math.max(used, 0)} / ${usage.limit}`;
};

const getProgress = (usage?: UsageEntry) => {
  if (!usage || usage.limit === null || usage.limit === 0) {
    return 0;
  }
  return Math.min(100, (usage.used / usage.limit) * 100);
};

const getProgressAccessibilityValue = (usage: UsageEntry, text: string) => ({
  min: 0,
  max: usage.limit ?? 0,
  now: Math.min(Math.max(usage.used, 0), usage.limit ?? 0),
  text,
});

const QUOTA_REASON_KEYS: Record<string, string> = {
  'Guest analysis is temporarily unavailable. You can still record dreams locally.':
    'settings.quota.reason.guest_unavailable',
  'Guest access expired. Please try again in a moment.':
    'settings.quota.reason.guest_expired',
  'Guest analysis is not available on this platform right now. You can still record dreams locally.':
    'settings.quota.reason.guest_platform_unsupported',
  'Guest quota is temporarily unavailable. You can still record dreams locally.':
    'settings.quota.reason.guest_quota_unavailable',
};

export const QuotaStatusCard: React.FC<Props> = ({
  onUpgradePress,
  presentation = 'card',
}) => {
  const { user } = useAuth();
  const { dreams } = useDreams();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const cardBg = noctalia.surface.raised;
  const { t } = useTranslation();
  const { quotaStatus, loading, error, refetch, tier } = useQuota();
  const [guestRecordedTotal, setGuestRecordedTotal] = useState(0);
  const [guestRecordingRefreshKey, setGuestRecordingRefreshKey] = useState(0);
  const isUpgradedGuest = !user && Boolean(quotaStatus?.isUpgraded);
  const isDegradedGuest = !user && quotaStatus?.guestBootstrapStatus === 'degraded';

  useEffect(() => subscribeGuestDreamRecordingCount?.(() => {
    setGuestRecordingRefreshKey((current) => current + 1);
  }), []);

  useEffect(() => {
    if (user) {
      setGuestRecordedTotal(0);
      return;
    }
    let cancelled = false;
    getLocalDreamRecordingCount()
      .then((count) => {
        if (!cancelled) setGuestRecordedTotal(count);
      })
      .catch(() => {
        // Best-effort, keep UI responsive
      });
    return () => {
      cancelled = true;
    };
  }, [user, dreams.length, guestRecordingRefreshKey]);

  const recordingUsage: UsageEntry = useMemo(() => {
    const guestRecordingLimit = getGuestDreamRecordingLimit();
    const hasAccount = Boolean(user);

    return {
      used: hasAccount ? dreams.length : Math.max(dreams.length, guestRecordedTotal),
      limit: hasAccount ? null : guestRecordingLimit,
      remaining: hasAccount ? null : Math.max(guestRecordingLimit - Math.max(dreams.length, guestRecordedTotal), 0),
    };
  }, [dreams.length, guestRecordedTotal, user]);

  const recordingLabel = useMemo(() => {
    return user ? t('settings.quota.recording_label') : t('settings.quota.recording_label_total');
  }, [t, user]);

  const rows = useMemo(() => ([
    {
      key: 'recordings',
      label: recordingLabel,
      usage: recordingUsage,
      testID: TID.Quota.RecordingsValue,
    },
    {
      key: 'analysis',
      label: t('settings.quota.analysis_label'),
      usage: quotaStatus?.usage.analysis,
      testID: TID.Quota.AnalysisValue,
    },
    {
      key: 'exploration',
      label: t('settings.quota.exploration_label'),
      usage: quotaStatus?.usage.exploration,
      testID: TID.Quota.ExplorationValue,
    },
  ]), [quotaStatus?.usage.analysis, quotaStatus?.usage.exploration, recordingLabel, recordingUsage, t]);

  const isPaidTier = tier === 'plus';
  const showCta = Boolean(quotaStatus) && !isPaidTier;
  const ctaLabel = tier === 'guest'
    ? (isUpgradedGuest ? t('settings.quota.cta_login') : t('settings.quota.cta_guest'))
    : t('settings.quota.cta_upgrade');
  const tierLabel = t(`settings.quota.tier.${tier}` as const);
  const isGuest = tier === 'guest';
  const guestRecordingLimit = recordingUsage.limit ?? getGuestDreamRecordingLimit();
  const firstQuotaReason = quotaStatus?.reasons?.[0];
  const localizedQuotaReason = firstQuotaReason
    ? t(QUOTA_REASON_KEYS[firstQuotaReason] ?? firstQuotaReason)
    : null;
  const freeResetMessage = useMemo(() => {
    if (tier !== 'free') return null;
    try {
      const { periodEnd } = getMonthlyQuotaPeriod();
      const dateStr = periodEnd.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      return t('settings.quota.free_reset_message', { date: dateStr });
    } catch {
      return null;
    }
  }, [t, tier]);

  const handleUpgrade = () => {
    if (onUpgradePress) {
      onUpgradePress();
      return;
    }
    if (isGuest) {
      router.push('/(tabs)/settings?section=account');
      return;
    }
    router.push(buildPaywallHref('settings_quota'));
  };

  return (
    <View
      style={[
        styles.card,
        presentation === 'embedded'
          ? styles.embedded
          : { backgroundColor: cardBg, borderColor: noctalia.surface.border },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.title, { color: noctalia.text.primary }]}>
            {t('settings.quota.title')}
          </Text>
          <Text style={[styles.subtitle, { color: noctalia.text.secondary }]}>
            {t('settings.quota.subtitle', { tier: tierLabel })}
          </Text>
        </View>
        {loading && <ActivityIndicator color={noctalia.accent.base} />}
      </View>

      {error && (
        <Pressable
          accessibilityRole="button"
          onPress={refetch}
          style={[
            styles.errorBanner,
            {
              backgroundColor: noctalia.status.danger.background,
              borderColor: noctalia.status.danger.border,
            },
          ]}
        >
          <Text style={[styles.errorText, { color: noctalia.status.danger.text }]}>
            {t('settings.quota.error')}
          </Text>
        </Pressable>
      )}

      {isGuest && isUpgradedGuest && (
        <View style={[styles.notice, { backgroundColor: noctalia.surface.soft }]}>
          <Text style={[styles.noticeText, { color: noctalia.text.secondary }]}>
            {localizedQuotaReason
              ? localizedQuotaReason
              : t('settings.quota.upgraded_message')}
          </Text>
        </View>
      )}

      {isGuest && !isUpgradedGuest && (
        <View style={[styles.notice, { backgroundColor: noctalia.surface.soft }]}>
          <Text style={[styles.noticeText, { color: noctalia.text.secondary }]}>
            {isDegradedGuest && localizedQuotaReason
              ? localizedQuotaReason
              : t('settings.quota.guest_message', {
                recordLimit: guestRecordingLimit,
                analysisLimit: QUOTAS.guest.analysis ?? 0,
                explorationLimit: QUOTAS.guest.exploration ?? 0,
              })}
          </Text>
        </View>
      )}

      {rows.map((row) => {
        const formattedValue = formatUsage(row.usage, t('recording.quota.unlimited'));
        return (
          <View key={row.key} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={[styles.rowLabel, { color: noctalia.text.secondary }]}>
                {row.label}
              </Text>
              <Text
                style={[styles.rowValue, { color: noctalia.text.primary }]}
                testID={row.testID}
                accessibilityLabel={`${row.label}: ${formattedValue}`}
              >
                {formattedValue}
              </Text>
            </View>
            {row.usage && row.usage.limit !== null && (
              <View
                style={[styles.progressTrack, { backgroundColor: noctalia.surface.soft }]}
                accessibilityRole="progressbar"
                accessibilityLabel={row.label}
                accessibilityValue={getProgressAccessibilityValue(row.usage, formattedValue)}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: noctalia.accent.base,
                      width: `${getProgress(row.usage)}%`,
                    },
                  ]}
                />
              </View>
            )}
          </View>
        );
      })}

      {tier === 'plus' && (
        <View style={[styles.notice, { backgroundColor: noctalia.surface.soft }]}>
          <Text style={[styles.noticeText, { color: noctalia.text.primary }]}>
            {t('settings.quota.plus_message')}
          </Text>
        </View>
      )}

      {tier === 'free' && freeResetMessage && (
        <View style={[styles.notice, { backgroundColor: noctalia.surface.soft }]}>
          <Text style={[styles.noticeText, { color: noctalia.text.secondary }]}>
            {freeResetMessage}
          </Text>
        </View>
      )}

      {showCta && (
        <Pressable
          style={[
            styles.ctaButton,
            {
              backgroundColor: noctalia.action.primary,
              borderColor: noctalia.action.primaryBorder,
            },
          ]}
          accessibilityRole="button"
          onPress={handleUpgrade}
        >
          <Text style={[styles.ctaText, { color: noctalia.action.primaryText }]}>{ctaLabel}</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: ThemeLayout.borderRadius.xl,
    padding: ThemeLayout.spacing.lg20,
    gap: 16,
  },
  embedded: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    marginBottom: 0,
    padding: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  headerTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  errorBanner: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: {
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  row: {
    gap: 8,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 13,
    textTransform: 'uppercase',
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  rowValue: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  notice: {
    borderRadius: 12,
    padding: 12,
  },
  noticeText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
  },
  ctaButton: {
    borderWidth: 1,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  ctaText: {
    fontFamily: Fonts.spaceGrotesk.bold,
  },
});
