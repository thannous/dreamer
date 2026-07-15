import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useQuota } from '@/hooks/useQuota';
import { useSubscription } from '@/hooks/useSubscription';
import { useTranslation } from '@/hooks/useTranslation';
import { getExpoPublicEnvValue, isMockModeEnabled } from '@/lib/env';
import { router } from 'expo-router';
import { signInMock, signOut, updateUserTier } from '@/lib/auth';
import { buildPaywallHref } from '@/lib/paywallRoute';
import { sortPackages } from '@/lib/paywallUtils';
import { TID } from '@/lib/testIDs';
import type { SubscriptionStatus } from '@/lib/types';
import {
  getSubscriptionStoreMode,
  initializeSubscription,
  loadSubscriptionPackages,
} from '@/services/subscriptionService';
import {
  applyMockScenario,
  type MockSubscriptionScenario,
} from '@/services/mocks/subscriptionServiceMock';

type ProfileScenario = 'guest' | 'new' | 'existing' | 'plus';

type ActionState = {
  label: string;
  detail?: string;
  kind: 'idle' | 'success' | 'warning' | 'error';
};

const PROFILE_SCENARIOS: { id: ProfileScenario; label: string; hint: string }[] = [
  { id: 'guest', label: 'Guest', hint: 'No account' },
  { id: 'new', label: 'New free', hint: 'Fresh signup' },
  { id: 'existing', label: 'Existing free', hint: 'Dream history' },
  { id: 'plus', label: 'Plus user', hint: 'Active access' },
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

function actionStatusDetail(status: SubscriptionStatus, appUserId?: string | null): string {
  const renews = status.willRenew === undefined ? 'unknown' : status.willRenew ? 'yes' : 'no';
  const userEvidence = appUserId ? ` | appUserId ${appUserId}` : '';
  return `${statusLabel(status)} | product ${status.productId ?? 'none'} | renews ${renews}${userEvidence}`;
}

type SubscriptionQALabProps = {
  presentation?: 'card' | 'embedded';
};

export function SubscriptionQALab({ presentation = 'card' }: SubscriptionQALabProps) {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
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
  const [isExpanded, setIsExpanded] = useState(presentation === 'card');

  const isMockMode = isMockModeEnabled();
  const androidKey = getExpoPublicEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY');
  const qaLabEnabled = getExpoPublicEnvValue('EXPO_PUBLIC_SUBSCRIPTION_QA_LAB') === 'true';
  const sortedPackages = useMemo(() => sortPackages(packages), [packages]);
  const monthlyPackage = sortedPackages.find((pkg) => pkg.interval === 'monthly');
  const annualPackage = sortedPackages.find((pkg) => pkg.interval === 'annual');
  const isBusy = loading || processing || refreshing || quotaLoading;
  const isEmbedded = presentation === 'embedded';
  const showsContent = !isEmbedded || isExpanded;

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
  const profileFromMetadata = user?.user_metadata?.profile;
  const selectedProfile: ProfileScenario | undefined = !user
    ? 'guest'
    : profileFromMetadata === 'new' || profileFromMetadata === 'existing' || profileFromMetadata === 'plus'
      ? profileFromMetadata
      : tier === 'plus'
        ? 'plus'
        : undefined;
  const selectedMockScenario: MockSubscriptionScenario | undefined = useMemo(() => {
    if (!status) return undefined;
    if (status.isActive && status.willRenew === false) return 'cancelled';
    if (!status.isActive && status.productId && status.willRenew === false) return 'expired';
    if (status.isActive && status.productId === 'mock_annual') return 'annual';
    if (status.isActive && status.productId === 'mock_monthly') return 'monthly';
    if (!status.isActive && !status.productId) return 'free';
    return undefined;
  }, [status]);
  const qaTitle = `${t('settings.section.subscription')} · QA`;

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
      const nextStatus = await applyMockScenario(profile === 'plus' ? 'annual' : 'free');
      await syncLocalStatus(nextStatus);
      setAction({
        label: `${profile} profile loaded`,
        detail: actionStatusDetail(nextStatus, user?.id),
        kind: 'success',
      });
    } catch (err) {
      setAction({
        label: 'Profile switch failed',
        detail: (err as Error).message,
        kind: 'error',
      });
    }
  }, [isMockMode, syncLocalStatus, user]);

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
        detail: actionStatusDetail(nextStatus, user?.id),
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
        detail: actionStatusDetail(nextStatus, user?.id),
        kind: 'success',
      });
    } catch (err) {
      setAction({
        label: `${interval} purchase failed`,
        detail: (err as Error).message,
        kind: 'error',
      });
    }
  }, [annualPackage, monthlyPackage, purchase, user]);

  const handleRestore = useCallback(async () => {
    try {
      const nextStatus = await restore();
      setAction({
        label: 'Restore completed',
        detail: actionStatusDetail(nextStatus, user?.id),
        kind: 'success',
      });
    } catch (err) {
      setAction({
        label: 'Restore failed',
        detail: (err as Error).message,
        kind: 'error',
      });
    }
  }, [restore, user]);

  const handleRefresh = useCallback(async () => {
    try {
      const nextStatus = await refreshSubscription();
      await refetchQuota();
      setAction({
        label: 'Refresh completed',
        detail: actionStatusDetail(nextStatus, user?.id),
        kind: 'success',
      });
    } catch (err) {
      setAction({
        label: 'Refresh failed',
        detail: (err as Error).message,
        kind: 'error',
      });
    }
  }, [refreshSubscription, refetchQuota, user]);

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
        detail: `packages ${nextPackages.length} | ids ${packageIds} | ${actionStatusDetail(nextStatus, user?.id)}`,
        kind: nextPackages.length > 0 ? 'success' : 'warning',
      });
    } catch (err) {
      setAction({
        label: 'SDK probe failed',
        detail: (err as Error).message,
        kind: 'error',
      });
    }
  }, [isMockMode, user]);

  const handleOpenPaywall = useCallback(() => {
    router.push(buildPaywallHref('settings'));
  }, []);

  const actionColor =
    action.kind === 'error'
      ? noctalia.status.danger.text
      : action.kind === 'warning'
        ? noctalia.status.warning.text
        : noctalia.accent.base;

  return (
    <View
      style={[
        styles.card,
        presentation === 'embedded'
          ? styles.embedded
          : { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
      ]}
      testID={TID.Screen.SubscriptionQALab}
    >
      <Pressable
        accessible={isEmbedded}
        accessibilityRole={isEmbedded ? 'button' : undefined}
        accessibilityLabel={isEmbedded ? qaTitle : undefined}
        accessibilityState={isEmbedded ? { expanded: isExpanded } : undefined}
        disabled={!isEmbedded}
        onPress={isEmbedded ? () => setIsExpanded((current) => !current) : undefined}
        style={({ pressed }) => [
          styles.headerRow,
          isEmbedded && styles.embeddedHeader,
          pressed && isEmbedded && styles.headerPressed,
        ]}
        testID={isEmbedded ? `${TID.Screen.SubscriptionQALab}.toggle` : undefined}
      >
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, { color: noctalia.accent.base }]}>RevenueCat QA</Text>
          <Text style={[styles.title, { color: noctalia.text.primary }]}>{qaTitle}</Text>
          {showsContent ? (
            <Text style={[styles.subtitle, { color: noctalia.text.secondary }]}>
              Visualize identity, package loading, RevenueCat state and quota convergence in one place.
            </Text>
          ) : null}
        </View>
        {isBusy ? <ActivityIndicator color={noctalia.accent.base} /> : null}
        {isEmbedded && !isBusy ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <IconSymbol
              color={noctalia.text.secondary}
              name={isExpanded ? 'chevron.up' : 'chevron.down'}
              size={24}
            />
          </View>
        ) : null}
      </Pressable>

      {showsContent ? (
        <>

      <View style={styles.statusGrid} testID={qaStateId} collapsable={false}>
        <StatusCell
          label="Mode"
          value={getSubscriptionStoreMode()}
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
        <View
          style={[
            styles.notice,
            {
              backgroundColor: noctalia.status.danger.background,
              borderColor: noctalia.status.danger.border,
            },
          ]}
        >
          <Text style={[styles.noticeText, { color: noctalia.status.danger.text }]}>
            {error.message}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.notice,
          { backgroundColor: noctalia.surface.soft, borderColor: noctalia.surface.border },
        ]}
      >
        <Text
          style={[styles.noticeTitle, { color: actionColor }]}
          testID={TID.Text.SubscriptionQaActionLabel}
        >
          {action.label}
        </Text>
        {action.detail ? (
          <Text
            style={[styles.noticeText, { color: noctalia.text.secondary }]}
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
              label={
                item.id === 'guest'
                  ? t('settings.quota.tier.guest')
                  : t(`settings.account.mock.profile.${item.id}`)
              }
              hint={
                item.id === 'guest'
                  ? item.hint
                  : t(`settings.account.mock.profile.${item.id}_hint`)
              }
              disabled={isBusy}
              selected={selectedProfile === item.id}
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
              selected={selectedMockScenario === item.id}
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

      <View
        style={[
          styles.notice,
          { backgroundColor: noctalia.surface.soft, borderColor: noctalia.surface.border },
        ]}
      >
        <Text style={[styles.noticeTitle, { color: noctalia.accent.base }]}>Snapshot</Text>
        <Text style={[styles.noticeText, { color: noctalia.text.secondary }]}>{snapshotValue}</Text>
      </View>
        </>
      ) : null}
    </View>
  );
}

function StatusCell({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  return (
    <View style={[styles.statusCell, { backgroundColor: noctalia.surface.soft }]}>
      <Text style={[styles.statusLabel, { color: noctalia.text.secondary }]}>{label}</Text>
      <Text style={[styles.statusValue, { color: noctalia.text.primary }]} testID={testID} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function ActionGroup({ title, children }: React.PropsWithChildren<{ title: string }>) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  return (
    <View style={styles.actionGroup}>
      <Text style={[styles.actionGroupTitle, { color: noctalia.text.secondary }]}>{title}</Text>
      <View style={styles.actionGrid}>{children}</View>
    </View>
  );
}

function QaButton({
  label,
  hint,
  disabled,
  selected,
  onPress,
  testID,
}: {
  label: string;
  hint?: string;
  disabled?: boolean;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(selected) }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.qaButton,
        { backgroundColor: noctalia.surface.soft, borderColor: noctalia.surface.border },
        selected && { backgroundColor: noctalia.surface.active, borderColor: noctalia.accent.base },
        pressed && !disabled && styles.qaButtonPressed,
        disabled && styles.qaButtonDisabled,
      ]}
    >
      <Text style={[styles.qaButtonLabel, { color: noctalia.text.primary }]}>{label}</Text>
      {hint ? <Text style={[styles.qaButtonHint, { color: noctalia.text.secondary }]}>{hint}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: ThemeLayout.borderRadius.xl,
    borderWidth: 1,
    gap: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.md,
    padding: ThemeLayout.spacing.md,
    width: '100%',
    maxWidth: '100%',
  },
  embedded: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    marginBottom: 0,
    padding: 0,
    gap: ThemeLayout.spacing.sm,
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
  embeddedHeader: {
    borderRadius: ThemeLayout.borderRadius.md,
    minHeight: 52,
    paddingHorizontal: ThemeLayout.spacing.sm,
    paddingVertical: 8,
  },
  headerPressed: {
    opacity: 0.75,
  },
  eyebrow: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 11,
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
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 58,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    borderWidth: 1,
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
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 54,
    minWidth: 0,
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
