import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts, GlassCardTokens } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useQuota } from '@/hooks/useQuota';
import { useSubscription } from '@/hooks/useSubscription';
import { getExpoPublicEnvValue, isMockModeEnabled } from '@/lib/env';
import { router } from 'expo-router';
import { signInMock, signOut, updateUserTier } from '@/lib/auth';
import { buildPaywallHref } from '@/lib/paywallRoute';
import { sortPackages } from '@/lib/paywallUtils';
import { TID } from '@/lib/testIDs';
import type { SubscriptionStatus } from '@/lib/types';
import {
  initializeSubscription,
  loadSubscriptionPackages,
} from '@/services/subscriptionService';
import {
  applyMockScenario,
  type MockSubscriptionScenario,
} from '@/services/mocks/subscriptionServiceMock';

type ProfileScenario = 'guest' | 'new' | 'existing' | 'premium';

type ActionState = {
  label: string;
  detail?: string;
  kind: 'idle' | 'success' | 'warning' | 'error';
};

const PROFILE_SCENARIOS: { id: ProfileScenario; label: string; hint: string }[] = [
  { id: 'guest', label: 'Guest', hint: 'No account' },
  { id: 'new', label: 'New free', hint: 'Fresh signup' },
  { id: 'existing', label: 'Existing free', hint: 'Dream history' },
  { id: 'premium', label: 'Plus user', hint: 'Active access' },
];

const MOCK_SCENARIOS: { id: MockSubscriptionScenario; label: string; hint: string }[] = [
  { id: 'free', label: 'Free', hint: 'No entitlement' },
  { id: 'monthly', label: 'Monthly', hint: 'Active renewal' },
  { id: 'annual', label: 'Annual', hint: 'Active renewal' },
  { id: 'cancelled', label: 'Cancelled', hint: 'Active until expiry' },
  { id: 'expired', label: 'Expired', hint: 'Back to free' },
];

function maskKey(value?: string): string {
  if (!value) return 'missing';
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function resolveStoreMode(androidKey?: string): string {
  if (!androidKey) return 'No Android key';
  if (androidKey.startsWith('test_')) return 'RevenueCat Test Store';
  if (androidKey.startsWith('goog_')) return 'Google Play';
  if (androidKey.startsWith('mock_')) return 'Mock store';
  return 'Custom key';
}

function formatDate(value?: string | null): string {
  if (!value) return 'none';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: SubscriptionStatus | null): string {
  if (!status) return 'not loaded';
  return `${status.tier} / ${status.isActive ? 'active' : 'inactive'}`;
}

function stateSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'none';
}

function actionStatusDetail(status: SubscriptionStatus): string {
  const renews = status.willRenew === undefined ? 'unknown' : status.willRenew ? 'yes' : 'no';
  return `${statusLabel(status)} | product ${status.productId ?? 'none'} | renews ${renews}`;
}

export function SubscriptionQALab() {
  const { colors, mode } = useTheme();
  const { user, setUserTierLocally, refreshUser } = useAuth();
  const {
    status,
    packages,
    loading,
    processing,
    refreshing,
    requiresAuth,
    purchase,
    restore,
    refreshSubscription,
    error,
  } = useSubscription({ loadPackages: true });
  const { tier, quotaStatus, loading: quotaLoading, refetch: refetchQuota } = useQuota();
  const [action, setAction] = useState<ActionState>({
    label: 'Ready',
    kind: 'idle',
  });

  const isMockMode = isMockModeEnabled();
  const androidKey = getExpoPublicEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY');
  const qaLabEnabled = getExpoPublicEnvValue('EXPO_PUBLIC_SUBSCRIPTION_QA_LAB') === 'true';
  const cardBg = GlassCardTokens.getBackground(colors.backgroundCard, mode);
  const sortedPackages = useMemo(() => sortPackages(packages), [packages]);
  const monthlyPackage = sortedPackages.find((pkg) => pkg.interval === 'monthly');
  const annualPackage = sortedPackages.find((pkg) => pkg.interval === 'annual');
  const isBusy = loading || processing || refreshing || quotaLoading;

  const productValue = status?.productId ?? 'none';
  const expiryValue = formatDate(status?.expiryDate);
  const renewalValue = status?.willRenew === undefined ? 'unknown' : status.willRenew ? 'yes' : 'no';
  const activeValue = status?.isActive ? 'active' : 'inactive';
  const snapshotValue = `${statusLabel(status)} | product ${productValue} | renews ${renewalValue}`;
  const userValue = user?.email ?? user?.id ?? 'guest';
  const qaStateId = TID.Text.SubscriptionQaState(
    [userValue, tier, activeValue, productValue, renewalValue].map(stateSlug).join('.')
  );
  const versionValue = user?.app_metadata?.subscription_version ?? 'none';
  const quotaValue = quotaStatus
    ? `${quotaStatus.usage.analysis.limit === null ? 'unlimited' : quotaStatus.usage.analysis.remaining} analysis left`
    : 'not loaded';

  const syncLocalStatus = useCallback(async (nextStatus: SubscriptionStatus) => {
    await updateUserTier(nextStatus.tier);
    setUserTierLocally({
      tier: nextStatus.tier,
      isActive: nextStatus.isActive,
      productId: nextStatus.productId ?? null,
      source: 'subscription_qa_lab',
      sourceUpdatedAt: new Date().toISOString(),
    });
    await refreshUser({ skipJwtRefresh: true });
    await refetchQuota();
  }, [refreshUser, refetchQuota, setUserTierLocally]);

  const handleProfile = useCallback(async (profile: ProfileScenario) => {
    if (!isMockMode) {
      setAction({
        label: 'Real mode',
        detail: 'Profile switching is available only in mock mode.',
        kind: 'warning',
      });
      return;
    }

    try {
      if (profile === 'guest') {
        await signOut();
        setAction({ label: 'Guest profile loaded', kind: 'success' });
        return;
      }

      await signInMock(profile);
      const nextStatus = await applyMockScenario(profile === 'premium' ? 'annual' : 'free');
      await syncLocalStatus(nextStatus);
      setAction({
        label: `${profile} profile loaded`,
        detail: actionStatusDetail(nextStatus),
        kind: 'success',
      });
    } catch (err) {
      setAction({
        label: 'Profile switch failed',
        detail: (err as Error).message,
        kind: 'error',
      });
    }
  }, [isMockMode, syncLocalStatus]);

  const handleMockScenario = useCallback(async (scenario: MockSubscriptionScenario) => {
    if (!isMockMode) {
      setAction({
        label: 'Manual external scenario',
        detail: 'Trigger cancellation or expiration from RevenueCat/Test Store, then refresh here.',
        kind: 'warning',
      });
      return;
    }
    if (!user) {
      setAction({
        label: 'Auth required',
        detail: 'Load a mock account before applying subscription states.',
        kind: 'warning',
      });
      return;
    }

    try {
      const nextStatus = await applyMockScenario(scenario);
      await syncLocalStatus(nextStatus);
      setAction({
        label: `Mock scenario: ${scenario}`,
        detail: actionStatusDetail(nextStatus),
        kind: 'success',
      });
    } catch (err) {
      setAction({
        label: 'Mock scenario failed',
        detail: (err as Error).message,
        kind: 'error',
      });
    }
  }, [isMockMode, syncLocalStatus, user]);

  const handleRealPurchase = useCallback(async (interval: 'monthly' | 'annual') => {
    const pkg = interval === 'monthly' ? monthlyPackage : annualPackage;
    if (!pkg) {
      setAction({
        label: 'Package missing',
        detail: `No ${interval} package loaded from the current offering.`,
        kind: 'error',
      });
      return;
    }

    try {
      const nextStatus = await purchase(pkg.id);
      setAction({
        label: `${interval} purchase completed`,
        detail: actionStatusDetail(nextStatus),
        kind: 'success',
      });
    } catch (err) {
      setAction({
        label: `${interval} purchase failed`,
        detail: (err as Error).message,
        kind: 'error',
      });
    }
  }, [annualPackage, monthlyPackage, purchase]);

  const handleRestore = useCallback(async () => {
    try {
      const nextStatus = await restore();
      setAction({
        label: 'Restore completed',
        detail: actionStatusDetail(nextStatus),
        kind: 'success',
      });
    } catch (err) {
      setAction({
        label: 'Restore failed',
        detail: (err as Error).message,
        kind: 'error',
      });
    }
  }, [restore]);

  const handleRefresh = useCallback(async () => {
    try {
      const nextStatus = await refreshSubscription();
      await refetchQuota();
      setAction({
        label: 'Refresh completed',
        detail: actionStatusDetail(nextStatus),
        kind: 'success',
      });
    } catch (err) {
      setAction({
        label: 'Refresh failed',
        detail: (err as Error).message,
        kind: 'error',
      });
    }
  }, [refreshSubscription, refetchQuota]);

  const handleProbeSdk = useCallback(async () => {
    if (isMockMode) {
      setAction({
        label: 'Mock mode',
        detail: 'SDK probing is useful only with Test Store or Google Play keys.',
        kind: 'warning',
      });
      return;
    }

    try {
      const nextStatus = await initializeSubscription(user?.id ?? null);
      const nextPackages = await loadSubscriptionPackages();
      const packageIds = nextPackages.map((pkg) => pkg.id).join(', ') || 'none';
      setAction({
        label: 'SDK probe completed',
        detail: `packages ${nextPackages.length} | ids ${packageIds} | ${actionStatusDetail(nextStatus)}`,
        kind: nextPackages.length > 0 ? 'success' : 'warning',
      });
    } catch (err) {
      setAction({
        label: 'SDK probe failed',
        detail: (err as Error).message,
        kind: 'error',
      });
    }
  }, [isMockMode, user?.id]);

  const handleOpenPaywall = useCallback(() => {
    router.push(buildPaywallHref('settings'));
  }, []);

  const actionColor =
    action.kind === 'error'
      ? colors.accentLight
      : action.kind === 'warning'
        ? colors.accentDark
        : colors.accent;

  return (
    <View
      style={[styles.card, { backgroundColor: cardBg, borderColor: colors.divider }]}
      testID={TID.Screen.SubscriptionQALab}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>RevenueCat QA</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Subscription QA Lab</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Visualize identity, package loading, RevenueCat state and quota convergence in one place.
          </Text>
        </View>
        {isBusy ? <ActivityIndicator color={colors.accent} /> : null}
      </View>

      <View style={styles.statusGrid} testID={qaStateId} collapsable={false}>
        <StatusCell
          label="Mode"
          value={isMockMode ? 'Mock services' : resolveStoreMode(androidKey)}
          testID={TID.Text.SubscriptionQaMode}
        />
        <StatusCell label="QA flag" value={qaLabEnabled ? 'enabled' : __DEV__ ? 'dev' : 'off'} />
        <StatusCell label="SDK key" value={maskKey(androidKey)} />
        <StatusCell
          label="Packages"
          value={`${packages.length}`}
          testID={TID.Text.SubscriptionQaPackages}
        />
        <StatusCell label="User" value={userValue} testID={TID.Text.SubscriptionQaUser} />
        <StatusCell label="Tier" value={`${tier} (${statusLabel(status)})`} testID={TID.Text.SubscriptionQaStatus} />
        <StatusCell label="Product" value={productValue} testID={TID.Text.SubscriptionQaProduct} />
        <StatusCell label="Expiry" value={expiryValue} />
        <StatusCell label="Renews" value={renewalValue} />
        <StatusCell label="Server version" value={`${versionValue}`} />
        <StatusCell label="Quota" value={quotaValue} />
        <StatusCell
          label="Auth"
          value={requiresAuth ? 'required' : 'ready'}
          testID={TID.Text.SubscriptionQaAuth}
        />
      </View>

      {error ? (
        <View style={[styles.notice, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.noticeText, { color: colors.accentLight }]}>{error.message}</Text>
        </View>
      ) : null}

      <View style={[styles.notice, { backgroundColor: colors.backgroundSecondary }]}>
        <Text
          style={[styles.noticeTitle, { color: actionColor }]}
          testID={TID.Text.SubscriptionQaActionLabel}
        >
          {action.label}
        </Text>
        {action.detail ? (
          <Text
            style={[styles.noticeText, { color: colors.textSecondary }]}
            testID={TID.Text.SubscriptionQaAction}
          >
            {action.detail}
          </Text>
        ) : null}
      </View>

      {isMockMode ? (
        <ActionGroup title="Profiles">
          {PROFILE_SCENARIOS.map((item) => (
            <QaButton
              key={item.id}
              label={item.label}
              hint={item.hint}
              disabled={isBusy}
              onPress={() => void handleProfile(item.id)}
              testID={TID.Button.SubscriptionQaProfile(item.id)}
            />
          ))}
        </ActionGroup>
      ) : null}

      <ActionGroup title={isMockMode ? 'Mock states' : 'Store actions'}>
        {isMockMode ? (
          MOCK_SCENARIOS.map((item) => (
            <QaButton
              key={item.id}
              label={item.label}
              hint={item.hint}
              disabled={isBusy || !user}
              onPress={() => void handleMockScenario(item.id)}
              testID={TID.Button.SubscriptionQaScenario(item.id)}
            />
          ))
        ) : (
          <>
            <QaButton
              label="Buy monthly"
              hint={monthlyPackage?.priceFormatted ?? 'load offering'}
              disabled={isBusy || !monthlyPackage || requiresAuth}
              onPress={() => void handleRealPurchase('monthly')}
              testID={TID.Button.SubscriptionQaScenario('monthly')}
            />
            <QaButton
              label="Buy annual"
              hint={annualPackage?.priceFormatted ?? 'load offering'}
              disabled={isBusy || !annualPackage || requiresAuth}
              onPress={() => void handleRealPurchase('annual')}
              testID={TID.Button.SubscriptionQaScenario('annual')}
            />
            <QaButton
              label="Restore"
              hint="same account"
              disabled={isBusy || requiresAuth}
              onPress={() => void handleRestore()}
              testID={TID.Button.SubscriptionQaScenario('restore')}
            />
            <QaButton
              label="External state"
              hint="cancel/expire in RC"
              disabled={isBusy}
              onPress={() => void handleMockScenario('cancelled')}
              testID={TID.Button.SubscriptionQaScenario('external')}
            />
          </>
        )}
      </ActionGroup>

      <ActionGroup title="Verification">
        {!isMockMode ? (
          <QaButton
            label="Probe SDK"
            hint="offering only"
            disabled={isBusy}
            onPress={() => void handleProbeSdk()}
            testID={TID.Button.SubscriptionQaProbe}
          />
        ) : null}
        <QaButton
          label="Refresh"
          hint="SDK + server + quota"
          disabled={isBusy || requiresAuth}
          onPress={() => void handleRefresh()}
          testID={TID.Button.SubscriptionQaRefresh}
        />
        <QaButton
          label="Open paywall"
          hint="full UI"
          disabled={isBusy}
          onPress={handleOpenPaywall}
          testID={TID.Button.SubscriptionQaOpenPaywall}
        />
      </ActionGroup>

      <View style={[styles.notice, { backgroundColor: colors.backgroundSecondary }]}>
        <Text style={[styles.noticeTitle, { color: colors.accent }]}>Snapshot</Text>
        <Text style={[styles.noticeText, { color: colors.textSecondary }]}>{snapshotValue}</Text>
      </View>
    </View>
  );
}

function StatusCell({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statusCell, { backgroundColor: colors.backgroundSecondary }]}>
      <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.statusValue, { color: colors.textPrimary }]} testID={testID} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function ActionGroup({ title, children }: React.PropsWithChildren<{ title: string }>) {
  const { colors } = useTheme();
  return (
    <View style={styles.actionGroup}>
      <Text style={[styles.actionGroupTitle, { color: colors.textSecondary }]}>{title}</Text>
      <View style={styles.actionGrid}>{children}</View>
    </View>
  );
}

function QaButton({
  label,
  hint,
  disabled,
  onPress,
  testID,
}: {
  label: string;
  hint?: string;
  disabled?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.qaButton,
        { backgroundColor: colors.backgroundSecondary, borderColor: colors.divider },
        pressed && !disabled && styles.qaButtonPressed,
        disabled && styles.qaButtonDisabled,
      ]}
    >
      <Text style={[styles.qaButtonLabel, { color: colors.textPrimary }]}>{label}</Text>
      {hint ? <Text style={[styles.qaButtonHint, { color: colors.textSecondary }]}>{hint}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: ThemeLayout.borderRadius.xl,
    borderWidth: GlassCardTokens.borderWidth,
    gap: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.md,
    padding: ThemeLayout.spacing.md,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: ThemeLayout.spacing.sm,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 18,
    marginTop: 2,
  },
  subtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusCell: {
    borderRadius: ThemeLayout.borderRadius.md,
    minHeight: 58,
    minWidth: 132,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '48%',
  },
  statusLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  statusValue: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 13,
    marginTop: 4,
  },
  notice: {
    borderRadius: ThemeLayout.borderRadius.md,
    gap: 2,
    padding: ThemeLayout.spacing.sm,
  },
  noticeTitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 13,
  },
  noticeText: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  actionGroup: {
    gap: 8,
  },
  actionGroupTitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  qaButton: {
    borderRadius: ThemeLayout.borderRadius.md,
    borderWidth: 1,
    minHeight: 54,
    minWidth: 112,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  qaButtonPressed: {
    opacity: 0.75,
  },
  qaButtonDisabled: {
    opacity: 0.45,
  },
  qaButtonLabel: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 13,
  },
  qaButtonHint: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 11,
    marginTop: 2,
  },
});

export default SubscriptionQALab;
