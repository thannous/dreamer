import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmailAuthCard } from '@/components/auth/EmailAuthCard';
import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { GradientText } from '@/components/inspiration/GradientText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import LanguageSettingsCard from '@/components/LanguageSettingsCard';
import NotificationSettingsCard from '@/components/NotificationSettingsCard';
import { QuotaStatusCard } from '@/components/quota/QuotaStatusCard';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SubscriptionCard } from '@/components/subscription/SubscriptionCard';
import ThemeSettingsCard from '@/components/ThemeSettingsCard';
import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts, getGlassCardBackground, GLASS_CARD_BORDER_WIDTH } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useSubscription } from '@/hooks/useSubscription';
import { useTranslation } from '@/hooks/useTranslation';
import { getAppVersionString } from '@/lib/appVersion';
import { MotiView } from '@/lib/moti';
import { TID } from '@/lib/testIDs';

export default function SettingsScreen() {
  const { colors, mode } = useTheme();
  const { returningGuestBlocked } = useAuth();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const appVersion = getAppVersionString();
  useClearWebFocus();

  const cardBg = getGlassCardBackground(colors.backgroundCard, mode);

  const headerGradientColors = useMemo(
    () =>
      mode === 'dark'
        ? ([colors.accentLight, colors.accent] as const)
        : ([colors.textPrimary, colors.accentDark] as const),
    [colors.accent, colors.accentDark, colors.accentLight, colors.textPrimary, mode],
  );

  const [showAnimations, setShowAnimations] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setShowAnimations(true);
      return () => setShowAnimations(false);
    }, []),
  );

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
      if (Number.isNaN(date.getTime())) return null;
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
  const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : undefined;

  const handleOpenPaywall = useCallback(() => {
    router.push('/paywall');
  }, []);

  // When returning guest is blocked, show only the auth hub
  if (returningGuestBlocked) {
    return (
      <KeyboardAvoidingView
        behavior={keyboardBehavior}
        style={[styles.container, { backgroundColor: colors.backgroundDark }]}
      >
        <AtmosphericBackground />
        <ScreenContainer>
          <View
            style={[
              styles.header,
              { paddingTop: insets.top + ThemeLayout.spacing.sm },
            ]}
          >
            <MotiView
              key={`header-${showAnimations}`}
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 700 }}
            >
              <GradientText colors={headerGradientColors} style={styles.headerTitle}>
                {t('auth.returning_guest.title')}
              </GradientText>
            </MotiView>
            <MotiView
              key={`header-rule-${showAnimations}`}
              from={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ type: 'timing', duration: 600, delay: 350 }}
            >
              <View style={[styles.headerRule, { backgroundColor: colors.accent }]} />
            </MotiView>
          </View>
        </ScreenContainer>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: tabBarHeight + ThemeLayout.spacing.lg },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ScreenContainer>
            {/* Welcome back banner */}
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 500, delay: 100 }}
            >
              <View style={[styles.returningGuestBanner, { backgroundColor: cardBg, borderColor: colors.divider, borderWidth: GLASS_CARD_BORDER_WIDTH }]}>
                <IconSymbol name="person.crop.circle.badge.exclamationmark" size={48} color={colors.accent} />
                <Text style={[styles.returningGuestTitle, { color: colors.textPrimary }]}>
                  {t('auth.returning_guest.banner_title')}
                </Text>
                <Text style={[styles.returningGuestMessage, { color: colors.textSecondary }]}>
                  {t('auth.returning_guest.message')}
                </Text>
              </View>
            </MotiView>

            {/* Auth card */}
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 500, delay: 200 }}
            >
              <View style={styles.sectionSpacing}>
                <EmailAuthCard isCompact={isCompactLayout} />
              </View>
            </MotiView>

            {/* Language settings */}
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 500, delay: 300 }}
            >
              <View style={styles.sectionSpacing}>
                <LanguageSettingsCard />
              </View>
            </MotiView>
          </ScreenContainer>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={keyboardBehavior}
      style={[styles.container, { backgroundColor: colors.backgroundDark }]}
    >
      <AtmosphericBackground />
      <ScreenContainer>
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + ThemeLayout.spacing.sm },
          ]}
        >
          <MotiView
            key={`header-${showAnimations}`}
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 700 }}
          >
            <GradientText colors={headerGradientColors} style={styles.headerTitle}>
              {t('settings.title')}
            </GradientText>
          </MotiView>
          <MotiView
            key={`header-rule-${showAnimations}`}
            from={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ type: 'timing', duration: 600, delay: 350 }}
          >
            <View style={[styles.headerRule, { backgroundColor: colors.accent }]} />
          </MotiView>
        </View>
      </ScreenContainer>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBarHeight + ThemeLayout.spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenContainer>
          <View style={[styles.sectionsContainer, isDesktopLayout && styles.sectionsContainerDesktop]}>
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 500, delay: 100 }}
            >
              <View style={isDesktopLayout ? styles.sectionItemDesktop : undefined}>
                <EmailAuthCard isCompact={isCompactLayout} />
              </View>
            </MotiView>
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 500, delay: 200 }}
            >
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
            </MotiView>
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 500, delay: 300 }}
            >
              <View style={[styles.sectionSpacing, isDesktopLayout && styles.sectionItemDesktop]}>
                <QuotaStatusCard />
              </View>
            </MotiView>
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 500, delay: 400 }}
            >
              <View style={[styles.sectionSpacing, isDesktopLayout && styles.sectionItemDesktop]}>
                <ThemeSettingsCard />
              </View>
            </MotiView>
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 500, delay: 500 }}
            >
              <View style={[styles.sectionSpacing, isDesktopLayout && styles.sectionItemDesktop]}>
                <LanguageSettingsCard />
              </View>
            </MotiView>
            {Platform.OS !== 'web' && (
              <MotiView
                from={{ opacity: 0, translateY: 16 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 500, delay: 600 }}
              >
                <View style={[styles.sectionSpacing, isDesktopLayout && styles.sectionItemDesktop]}>
                  <NotificationSettingsCard />
                </View>
              </MotiView>
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
    </KeyboardAvoidingView>
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
    fontSize: 20,
    fontFamily: Fonts.fraunces.semiBold,
    letterSpacing: 0.5,
  },
  headerRule: {
    width: 36,
    height: 2.5,
    borderRadius: 1.5,
    marginTop: 10,
    opacity: 0.7,
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
