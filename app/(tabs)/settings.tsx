import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmailAuthCard } from '@/components/auth/EmailAuthCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import LanguageSettingsCard from '@/components/LanguageSettingsCard';
import NotificationSettingsCard from '@/components/NotificationSettingsCard';
import { QuotaStatusCard } from '@/components/quota/QuotaStatusCard';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SubscriptionCard } from '@/components/subscription/SubscriptionCard';
import ThemeSettingsCard from '@/components/ThemeSettingsCard';
import { ThemeLayout } from '@/constants/journalTheme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useSubscription } from '@/hooks/useSubscription';
import { useTranslation } from '@/hooks/useTranslation';
import { getAppVersionString } from '@/lib/appVersion';
import { TID } from '@/lib/testIDs';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { returningGuestBlocked } = useAuth();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const appVersion = getAppVersionString();
  useClearWebFocus();

  const {
    isActive,
    loading: subscriptionLoading,
    status: subscriptionStatus,
  } = useSubscription();

  const subscriptionCopy = useMemo(() => {
    if (isActive) {
      const activeTierKey = 'plus';
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
  }, [isActive, t]);

  const formattedExpiryDate = useMemo(() => {
    const expiryDate = subscriptionStatus?.expiryDate;
    if (!expiryDate) return null;
    try {
      const date = new Date(expiryDate);
      const dateStr = date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const timeStr = date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `${dateStr} à ${timeStr}`;
    } catch {
      return null;
    }
  }, [subscriptionStatus?.expiryDate]);

  const subscriptionExpiryLabel = useMemo(() => {
    if (!isActive || !formattedExpiryDate) return undefined;
    return t('subscription.paywall.expiry_date', { date: formattedExpiryDate });
  }, [formattedExpiryDate, isActive, t]);

  const subscriptionFeatures = useMemo(
    () => [
      t('subscription.paywall.card.feature.unlimited_analyses'),
      t('subscription.paywall.card.feature.unlimited_explorations'),
      t('subscription.paywall.card.feature.recorded_dreams'),
    ],
    [t],
  );

  const isCompactLayout = width <= 375;
  const isDesktopLayout = Platform.OS === 'web' && width >= 1024;

  const handleOpenPaywall = useCallback(() => {
    router.push('/paywall');
  }, []);

  // When returning guest is blocked, show only the auth hub
  if (returningGuestBlocked) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundDark }]}>
        <ScreenContainer>
          <View
            style={[
              styles.header,
              { paddingTop: insets.top + ThemeLayout.spacing.sm },
            ]}
          >
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {t('auth.returning_guest.title')}
            </Text>
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
            {/* Welcome back banner */}
            <View style={[styles.returningGuestBanner, { backgroundColor: colors.backgroundCard }]}>
              <IconSymbol name="person.crop.circle.badge.exclamationmark" size={48} color={colors.accent} />
              <Text style={[styles.returningGuestTitle, { color: colors.textPrimary }]}>
                {t('auth.returning_guest.banner_title')}
              </Text>
              <Text style={[styles.returningGuestMessage, { color: colors.textSecondary }]}>
                {t('auth.returning_guest.message')}
              </Text>
            </View>

            {/* Auth card */}
            <View style={styles.sectionSpacing}>
              <EmailAuthCard isCompact={isCompactLayout} />
            </View>

            {/* Language settings */}
            <View style={styles.sectionSpacing}>
              <LanguageSettingsCard />
            </View>
          </ScreenContainer>
        </ScrollView>
      </View>
    );
  }

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
                expiryLabel={subscriptionExpiryLabel}
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
          {appVersion ? (
            <View style={styles.versionContainer}>
              <Text style={[styles.versionText, { color: colors.textSecondary }]}>
                {t('settings.app_version', { version: appVersion })}
              </Text>
            </View>
          ) : null}
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
  versionContainer: {
    marginTop: ThemeLayout.spacing.lg,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    letterSpacing: 0.2,
  },
  returningGuestBanner: {
    alignItems: 'center',
    padding: ThemeLayout.spacing.lg,
    borderRadius: ThemeLayout.borderRadius.lg,
    gap: ThemeLayout.spacing.sm,
  },
  returningGuestTitle: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    textAlign: 'center',
    marginTop: ThemeLayout.spacing.sm,
  },
  returningGuestMessage: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
});
