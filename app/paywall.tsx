import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/ScreenContainer';
import { PricingOption } from '@/components/subscription/PricingOption';
import { SubscriptionCard } from '@/components/subscription/SubscriptionCard';
import { ThemeLayout } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';
import { useSubscription } from '@/hooks/useSubscription';
import { TID } from '@/lib/testIDs';
import type { PurchasePackage } from '@/lib/types';

function sortPackages(packages: PurchasePackage[]): PurchasePackage[] {
  return [...packages].sort((a, b) => {
    if (a.interval === b.interval) return 0;
    if (a.interval === 'monthly') return -1;
    return 1;
  });
}

export default function PaywallScreen() {
  const { colors } = useTheme();
  const { isActive, loading, processing, error, packages, purchase, restore } = useSubscription();
  const sortedPackages = useMemo(() => sortPackages(packages), [packages]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const effectiveSelectedId = selectedId ?? (sortedPackages[0]?.id ?? null);
  const canPurchase = Boolean(effectiveSelectedId) && !processing && !loading && !isActive;

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/settings');
    }
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  const handlePurchase = async () => {
    if (!effectiveSelectedId || !canPurchase) return;
    try {
      await purchase(effectiveSelectedId);
    } catch {
    }
  };

  const handleRestore = async () => {
    try {
      await restore();
    } catch {
    }
  };

  const headerTitle = isActive ? 'You are Premium' : 'Unlock Dreamer Premium';
  const headerSubtitle = isActive
    ? 'Thank you for supporting Dreamer. Enjoy unlimited analyses and explorations.'
    : 'Get more from your dreams with unlimited analyses, explorations and richer insights.';

  return (
    <View style={[styles.root, { backgroundColor: colors.backgroundDark }]} testID={TID.Screen.Paywall}>
      <ScreenContainer style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{headerTitle}</Text>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            accessibilityRole="button"
            testID={TID.Button.PaywallClose}
          >
            <Text style={[styles.closeLabel, { color: colors.textSecondary }]}>Close</Text>
          </Pressable>
        </View>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{headerSubtitle}</Text>
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.loadingLabel, { color: colors.textSecondary }]}>Loading options…</Text>
          </View>
        )}
        {error && (
          <Text style={[styles.errorText, { color: '#EF4444' }]}>{error.message}</Text>
        )}
      </ScreenContainer>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <ScreenContainer>
          <SubscriptionCard
            title="Premium dream analysis"
            subtitle="Unlimited AI analyses, explorations and deeper insights into your night stories."
            badge={isActive ? 'Active' : 'Most popular'}
            features={[
              'Unlimited AI dream analyses',
              'Unlimited explorations and chat sessions',
              'Higher priority processing when demand is high',
            ]}
            loading={processing}
          />

          {sortedPackages.map((pkg) => (
            <PricingOption
              key={pkg.id}
              id={pkg.id}
              title={pkg.title || (pkg.interval === 'monthly' ? 'Monthly' : 'Annual')}
              subtitle={pkg.description}
              price={pkg.priceFormatted}
              intervalLabel={pkg.interval === 'monthly' ? 'per month' : 'per year'}
              badge={pkg.interval === 'annual' ? 'Best value' : undefined}
              selected={effectiveSelectedId === pkg.id}
              disabled={processing || loading || isActive}
              onPress={handleSelect}
              testID={pkg.interval === 'monthly' ? TID.Button.PaywallSelectMonthly : TID.Button.PaywallSelectAnnual}
            />
          ))}

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: canPurchase ? colors.accent : colors.backgroundSecondary },
                pressed && canPurchase && styles.primaryButtonPressed,
              ]}
              disabled={!canPurchase}
              onPress={handlePurchase}
              testID={TID.Button.PaywallPurchase}
            >
              {processing ? (
                <ActivityIndicator color={colors.textOnAccentSurface} />
              ) : (
                <Text
                  style={[
                    styles.primaryLabel,
                    { color: canPurchase ? colors.textOnAccentSurface : colors.textSecondary },
                  ]}
                >
                  {isActive ? 'Already active' : 'Continue'}
                </Text>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
              onPress={handleRestore}
              disabled={processing}
              testID={TID.Button.PaywallRestore}
            >
              <Text style={[styles.secondaryLabel, { color: colors.textSecondary }]}>Restore purchases</Text>
            </Pressable>
          </View>
        </ScreenContainer>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerContainer: {
    paddingTop: ThemeLayout.spacing.lg,
    paddingHorizontal: ThemeLayout.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    marginBottom: 8,
  },
  closeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  closeLabel: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  loadingLabel: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  errorText: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingTop: ThemeLayout.spacing.md,
    paddingBottom: ThemeLayout.spacing.lg,
  },
  actions: {
    marginTop: ThemeLayout.spacing.lg,
    gap: ThemeLayout.spacing.sm,
  },
  primaryButton: {
    borderRadius: ThemeLayout.borderRadius.full,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryLabel: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonPressed: {
    opacity: 0.8,
  },
  secondaryLabel: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
});
