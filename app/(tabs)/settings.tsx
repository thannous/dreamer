import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmailAuthCard } from '@/components/auth/EmailAuthCard';
import LanguageSettingsCard from '@/components/LanguageSettingsCard';
import NotificationSettingsCard from '@/components/NotificationSettingsCard';
import { QuotaStatusCard } from '@/components/quota/QuotaStatusCard';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SubscriptionCard } from '@/components/subscription/SubscriptionCard';
import ThemeSettingsCard from '@/components/ThemeSettingsCard';
import { ThemeLayout } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useSubscription } from '@/hooks/useSubscription';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  useClearWebFocus();

  const { status: subscriptionStatus, isActive, loading: subscriptionLoading } = useSubscription();

  const subscriptionCopy = useMemo(() => {
    if (isActive) {
      const activeTierKey = subscriptionStatus?.tier === 'premium' ? 'premium' : 'plus';
      return {
        title: t(`subscription.settings.title.${activeTierKey}` as const),
        subtitle: t(`subscription.settings.subtitle.${activeTierKey}` as const),
        badge: t(`subscription.paywall.card.badge.${activeTierKey}` as const),
        cta: t(`subscription.settings.cta.${activeTierKey}` as const),
      };
    }
    return {
      title: t('subscription.settings.title.free'),
      subtitle: t('subscription.settings.subtitle.free'),
      badge: undefined,
      cta: t('subscription.settings.cta.free'),
    };
  }, [isActive, subscriptionStatus?.tier, t]);

  const subscriptionFeatures = useMemo(
    () => [
      t('subscription.paywall.card.feature.unlimited_analyses'),
      t('subscription.paywall.card.feature.unlimited_explorations'),
    ],
    [t],
  );

  const isCompactLayout = width <= 375;
  const isDesktopLayout = Platform.OS === 'web' && width >= 1024;

  const handleOpenPaywall = useCallback(() => {
    router.push('/paywall');
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDark }]}>
      <ScreenContainer>
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + ThemeLayout.spacing.sm },
          ]}
        >
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('settings.title')}</Text>
        </View>
      </ScreenContainer>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBarHeight + ThemeLayout.spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenContainer>
          <View style={[styles.sectionsContainer, isDesktopLayout && styles.sectionsContainerDesktop]}>
            <View style={isDesktopLayout ? styles.sectionItemDesktop : undefined}>
              <EmailAuthCard isCompact={isCompactLayout} />
            </View>
            <View style={[styles.sectionSpacing, isDesktopLayout && styles.sectionItemDesktop]}>
              <SubscriptionCard
                title={subscriptionCopy.title}
                subtitle={subscriptionCopy.subtitle}
                badge={subscriptionCopy.badge}
                features={subscriptionFeatures}
                loading={subscriptionLoading}
                ctaLabel={subscriptionCopy.cta}
                onPress={handleOpenPaywall}
                disabled={subscriptionLoading}
                ctaTestID={TID.Button.SubscriptionSettingsCta}
              />
            </View>
            <View style={[styles.sectionSpacing, isDesktopLayout && styles.sectionItemDesktop]}>
              <QuotaStatusCard />
            </View>
            <View style={[styles.sectionSpacing, isDesktopLayout && styles.sectionItemDesktop]}>
              <ThemeSettingsCard />
            </View>
            <View style={[styles.sectionSpacing, isDesktopLayout && styles.sectionItemDesktop]}>
              <LanguageSettingsCard />
            </View>
            {Platform.OS !== 'web' && (
              <View style={[styles.sectionSpacing, isDesktopLayout && styles.sectionItemDesktop]}>
                <NotificationSettingsCard />
              </View>
            )}
          </View>
        </ScreenContainer>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: ThemeLayout.spacing.sm,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: ThemeLayout.spacing.md,
  },
  sectionsContainer: {
    flexDirection: 'column',
  },
  sectionsContainerDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -ThemeLayout.spacing.sm,
  },
  sectionItemDesktop: {
    width: '50%',
    minWidth: 320,
    paddingHorizontal: ThemeLayout.spacing.sm,
  },
  sectionSpacing: {
    marginTop: ThemeLayout.spacing.md,
  },
});
