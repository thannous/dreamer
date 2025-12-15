import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useDreams } from '@/context/DreamsContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useQuota } from '@/hooks/useQuota';
import { TID } from '@/lib/testIDs';
import { getGuestDreamRecordingLimit } from '@/lib/guestLimits';
import { router } from 'expo-router';
import { Fonts } from '@/constants/theme';
import { QUOTAS } from '@/constants/limits';
import { getLocalDreamRecordingCount } from '@/services/quota/GuestDreamCounter';

type UsageEntry = {
  used: number;
  limit: number | null;
  remaining: number | null;
};

type Props = {
  onUpgradePress?: () => void;
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

export const QuotaStatusCard: React.FC<Props> = ({ onUpgradePress }) => {
  const { user } = useAuth();
  const { dreams } = useDreams();
  const { colors, shadows } = useTheme();
  const { t } = useTranslation();
  const { quotaStatus, loading, error, refetch, tier } = useQuota();
  const [guestRecordedTotal, setGuestRecordedTotal] = useState(0);

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
  }, [user, dreams.length]);

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

  const isPaidTier = tier === 'plus' || tier === 'premium';
  const showCta = Boolean(quotaStatus) && !isPaidTier;
  const ctaLabel = tier === 'guest'
    ? t('settings.quota.cta_guest')
    : t('settings.quota.cta_upgrade');
  const tierLabel = t(`settings.quota.tier.${tier}` as const);
  const isGuest = tier === 'guest';
  const guestRecordingLimit = recordingUsage.limit ?? getGuestDreamRecordingLimit();

  const handleUpgrade = () => {
    if (onUpgradePress) {
      onUpgradePress();
      return;
    }
    if (isGuest) {
      router.push('/(tabs)/settings?section=account');
      return;
    }
    router.push('/paywall' as any);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.backgroundCard }, shadows.md]}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('settings.quota.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('settings.quota.subtitle', { tier: tierLabel })}
          </Text>
        </View>
        {loading && <ActivityIndicator color={colors.accent} />}
      </View>

      {error && (
        <Pressable accessibilityRole="button" onPress={refetch} style={styles.errorBanner}>
          <Text style={[styles.errorText, { color: colors.textPrimary }]}>
            {t('settings.quota.error')}
          </Text>
        </Pressable>
      )}

      {isGuest && (
        <View style={[styles.notice, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
            {t('settings.quota.guest_message', {
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
              <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
                {row.label}
              </Text>
              <Text
                style={[styles.rowValue, { color: colors.textPrimary }]}
                testID={row.testID}
                accessibilityLabel={`${row.label}: ${formattedValue}`}
              >
                {formattedValue}
              </Text>
            </View>
            {row.usage && row.usage.limit !== null && (
              <View style={[styles.progressTrack, { backgroundColor: colors.backgroundSecondary }] }>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.accent,
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
        <View style={[styles.notice, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.noticeText, { color: colors.textPrimary }]}>
            {t('settings.quota.plus_message')}
          </Text>
        </View>
      )}

      {tier === 'premium' && (
        <View style={[styles.notice, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.noticeText, { color: colors.textPrimary }]}>
            {t('settings.quota.premium_message')}
          </Text>
        </View>
      )}

      {showCta && (
        <Pressable
          style={[styles.ctaButton, { backgroundColor: colors.accent }, shadows.sm]}
          accessibilityRole="button"
          onPress={handleUpgrade}
        >
          <Text style={[styles.ctaText, { color: colors.textPrimary }]}>{ctaLabel}</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    gap: 16,
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
    backgroundColor: '#EF444422',
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
    letterSpacing: 0.6,
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
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  ctaText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    letterSpacing: 0.5,
  },
});
