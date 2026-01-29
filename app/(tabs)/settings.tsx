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
import { EmailAuthCard } from '@/components/auth/EmailAuthCard';
import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { GlassCard } from '@/components/inspiration/GlassCard';
import { PageHeader } from '@/components/inspiration/PageHeader';
import { SectionHeading } from '@/components/inspiration/SectionHeading';
import { IconSymbol } from '@/components/ui/icon-symbol';
import LanguageSettingsCard from '@/components/LanguageSettingsCard';
import NotificationSettingsCard from '@/components/NotificationSettingsCard';
import { QuotaStatusCard } from '@/components/quota/QuotaStatusCard';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SubscriptionCard } from '@/components/subscription/SubscriptionCard';
import ThemeSettingsCard from '@/components/ThemeSettingsCard';
import { DecoLines, ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useSubscription } from '@/hooks/useSubscription';
import { useTranslation } from '@/hooks/useTranslation';
import { getAppVersionString } from '@/lib/appVersion';
import { MotiView } from '@/lib/moti';
import { TID } from '@/lib/testIDs';

// ─── Section Divider ──────────────────────────────────────────────────────────

function SectionDivider({
  color,
  delay = 0,
}: {
  color: string;
  delay?: number;
}) {
  return (
    <MotiView
      from={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ type: 'timing', duration: 500, delay }}
    >
      <View style={[styles.sectionDivider, { backgroundColor: color }]} />
    </MotiView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { returningGuestBlocked } = useAuth();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const appVersion = getAppVersionString();
  useClearWebFocus();

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
        <PageHeader titleKey="auth.returning_guest.title" showAnimations={showAnimations} />

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
            <GlassCard
              intensity="moderate"
              disableShadow
              enableAnimation
              animationDelay={100}
              style={styles.returningGuestGlassCard}
            >
              <View style={[styles.returningGuestAccentStripe, { backgroundColor: colors.accent }]} />
              <View style={styles.returningGuestInner}>
                <IconSymbol name="person.crop.circle.badge.exclamationmark" size={48} color={colors.accent} />
                <Text style={[styles.returningGuestTitle, { color: colors.textPrimary }]}>
                  {t('auth.returning_guest.banner_title')}
                </Text>
                <Text style={[styles.returningGuestMessage, { color: colors.textSecondary }]}>
                  {t('auth.returning_guest.message')}
                </Text>
              </View>
            </GlassCard>

            {/* Auth card */}
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 500, delay: 200 }}
            >
              <View style={styles.settingsSectionCards}>
                <EmailAuthCard isCompact={isCompactLayout} />
              </View>
            </MotiView>

            {/* Language settings */}
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 500, delay: 300 }}
            >
              <View style={styles.settingsSectionCards}>
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
      <PageHeader titleKey="settings.title" showAnimations={showAnimations} />

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

            {/* ─── Account Section ─── */}
            <View style={styles.settingsSection}>
              <MotiView
                from={{ opacity: 0, translateY: 16 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 500, delay: 100 }}
              >
                <SectionHeading
                  title={t('settings.section.account')}
                  icon="person.fill"
                  colors={colors}
                />
              </MotiView>
              <MotiView
                from={{ opacity: 0, translateY: 16 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 500, delay: 200 }}
              >
                <View style={isDesktopLayout ? styles.sectionItemDesktop : undefined}>
                  <EmailAuthCard isCompact={isCompactLayout} />
                </View>
              </MotiView>
            </View>

            <SectionDivider color={colors.accent} delay={250} />

            {/* ─── Subscription Section ─── */}
            <View style={styles.settingsSection}>
              <MotiView
                from={{ opacity: 0, translateY: 16 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 500, delay: 300 }}
              >
                <SectionHeading
                  title={t('settings.section.subscription')}
                  icon="crown.fill"
                  colors={colors}
                />
              </MotiView>
              <View style={styles.settingsSectionCards}>
                <MotiView
                  from={{ opacity: 0, translateY: 16 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 500, delay: 400 }}
                >
                  <View style={isDesktopLayout ? styles.sectionItemDesktop : undefined}>
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
                  transition={{ type: 'timing', duration: 500, delay: 500 }}
                >
                  <View style={isDesktopLayout ? styles.sectionItemDesktop : undefined}>
                    <QuotaStatusCard />
                  </View>
                </MotiView>
              </View>
            </View>

            <SectionDivider color={colors.accent} delay={550} />

            {/* ─── Preferences Section ─── */}
            <View style={styles.settingsSection}>
              <MotiView
                from={{ opacity: 0, translateY: 16 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 500, delay: 600 }}
              >
                <SectionHeading
                  title={t('settings.section.preferences')}
                  icon="slider.horizontal.3"
                  colors={colors}
                />
              </MotiView>
              <View style={styles.settingsSectionCards}>
                <MotiView
                  from={{ opacity: 0, translateY: 16 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 500, delay: 700 }}
                >
                  <View style={isDesktopLayout ? styles.sectionItemDesktop : undefined}>
                    <ThemeSettingsCard />
                  </View>
                </MotiView>
                <MotiView
                  from={{ opacity: 0, translateY: 16 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 500, delay: 800 }}
                >
                  <View style={isDesktopLayout ? styles.sectionItemDesktop : undefined}>
                    <LanguageSettingsCard />
                  </View>
                </MotiView>
              </View>
            </View>

            {/* ─── Notifications Section (native only) ─── */}
            {Platform.OS !== 'web' && (
              <>
                <SectionDivider color={colors.accent} delay={850} />
                <View style={styles.settingsSection}>
                  <MotiView
                    from={{ opacity: 0, translateY: 16 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 500, delay: 900 }}
                  >
                    <SectionHeading
                      title={t('settings.section.notifications')}
                      icon="bell.fill"
                      colors={colors}
                    />
                  </MotiView>
                  <MotiView
                    from={{ opacity: 0, translateY: 16 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 500, delay: 1000 }}
                  >
                    <View style={isDesktopLayout ? styles.sectionItemDesktop : undefined}>
                      <NotificationSettingsCard />
                    </View>
                  </MotiView>
                </View>
              </>
            )}
          </View>

          {/* ─── Version Footer ─── */}
          {appVersion ? (
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 600, delay: 1100 }}
            >
              <View style={styles.versionContainer}>
                <View style={[styles.versionDecoLine, { backgroundColor: `${colors.accent}40` }]} />
                <Text style={[styles.versionText, { color: colors.textSecondary }]}>
                  {t('settings.app_version', { version: appVersion })}
                </Text>
              </View>
            </MotiView>
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

  // Settings sections
  settingsSection: {
    marginBottom: 36,
  },
  settingsSectionCards: {
    gap: 12,
  },

  // Section divider
  sectionDivider: {
    ...DecoLines.rule,
    opacity: 0.3,
    marginBottom: 28,
  },

  // Returning guest
  returningGuestGlassCard: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 0,
    marginBottom: ThemeLayout.spacing.md,
  },
  returningGuestAccentStripe: {
    height: 3,
    width: '100%',
    opacity: 0.85,
  },
  returningGuestInner: {
    alignItems: 'center',
    padding: ThemeLayout.spacing.lg,
    gap: ThemeLayout.spacing.sm,
  },
  returningGuestTitle: {
    fontSize: 20,
    fontFamily: Fonts.fraunces.semiBold,
    textAlign: 'center',
    marginTop: ThemeLayout.spacing.sm,
  },
  returningGuestMessage: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Version footer
  versionContainer: {
    marginTop: 48,
    alignItems: 'center',
    gap: 12,
  },
  versionDecoLine: {
    width: 36,
    height: 2,
    borderRadius: 1,
  },
  versionText: {
    fontSize: 11,
    fontFamily: Fonts.spaceGrotesk.medium,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    opacity: 0.5,
  },
});
