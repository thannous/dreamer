import { Host } from '@expo/ui';
import { router } from 'expo-router';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import React, { useCallback, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  type ViewStyle,
  useWindowDimensions,
  View,
} from 'react-native';

import { EmailAuthCard } from '@/components/auth/EmailAuthCard';
import { GuestProdQALab } from '@/components/guest/GuestProdQALab';
import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { StaticFlatGlassCard } from '@/components/inspiration/GlassCard';
import { PageHeader } from '@/components/inspiration/PageHeader';
import { NoctaliaScreenHeader } from '@/components/NoctaliaScreenHeader';
import { QuotaStatusCard } from '@/components/quota/QuotaStatusCard';
import { SettingsFieldGroup } from '@/components/settings/SettingsFieldGroup';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useTranslation } from '@/hooks/useTranslation';
import { getAppVersionString } from '@/lib/appVersion';
import { buildPaywallHref } from '@/lib/paywallRoute';

const SETTINGS_DESKTOP_MAX_WIDTH = 760;

export default function SettingsScreen() {
  const { colors, mode } = useTheme();
  const { returningGuestBlocked } = useAuth();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const { t } = useTranslation();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { width } = useWindowDimensions();
  const appVersion = getAppVersionString();
  useClearWebFocus();

  const isCompactLayout = width <= 375;
  const isDesktopLayout = Platform.OS === 'web' && width >= 1024;
  const bottomPadding = isDesktopLayout || returningGuestBlocked
    ? ThemeLayout.spacing.xl
    : bottomTabBarHeight + ThemeLayout.spacing.md;
  const hostStyle = Platform.OS === 'web'
    ? [
        styles.host,
        {
          '--expo-ui-background': noctalia.surface.base,
          '--expo-ui-foreground': noctalia.text.primary,
          '--expo-ui-gray-50': noctalia.screen.background,
          '--expo-ui-gray-100': noctalia.surface.border,
          '--expo-ui-gray-150': noctalia.surface.borderStrong,
          '--expo-ui-gray-200': noctalia.surface.soft,
          '--expo-ui-gray-300': noctalia.surface.borderStrong,
          '--expo-ui-gray-400': noctalia.text.tertiary,
          '--expo-ui-gray-500': noctalia.text.tertiary,
          '--expo-ui-gray-600': noctalia.text.secondary,
          '--expo-ui-gray-700': noctalia.text.secondary,
          '--expo-ui-gray-800': noctalia.text.primary,
          '--expo-ui-gray-900': noctalia.text.primary,
        // React Native Web forwards CSS custom properties to the Host element.
        } as unknown as ViewStyle,
      ]
    : styles.host;

  const handleOpenPaywall = useCallback(() => {
    router.push(buildPaywallHref('settings'));
  }, []);

  const account = (
    <View
      style={[
        styles.rnSlot,
        Platform.OS === 'android' && styles.accountRnSlot,
      ]}
      testID="settings-account-rn-content"
    >
      {returningGuestBlocked ? (
        <StaticFlatGlassCard
          intensity="moderate"
          animationDelay={100}
          style={styles.returningGuestGlassCard}
        >
          <View
            style={[
              styles.returningGuestAccentStripe,
              { backgroundColor: noctalia.accent.base },
            ]}
          />
          <View style={styles.returningGuestInner}>
            <IconSymbol
              name="person.crop.circle.badge.exclamationmark"
              size={48}
              color={noctalia.accent.base}
            />
            <Text style={[styles.returningGuestTitle, { color: noctalia.text.primary }]}>
              {t('auth.returning_guest.banner_title')}
            </Text>
            <Text style={[styles.returningGuestMessage, { color: noctalia.text.secondary }]}>
              {t('auth.returning_guest.message')}
            </Text>
          </View>
        </StaticFlatGlassCard>
      ) : null}
      <EmailAuthCard isCompact={isCompactLayout} presentation="embedded" />
      <GuestProdQALab />
    </View>
  );

  const quota = (
    <View style={styles.rnSlot} testID="settings-quota-rn-content">
      <QuotaStatusCard onUpgradePress={handleOpenPaywall} presentation="embedded" />
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: noctalia.screen.background }]}
      testID="screen.settings"
    >
      <AtmosphericBackground variant="subtle" />
      {isDesktopLayout ? (
        <PageHeader
          titleKey={returningGuestBlocked ? 'auth.returning_guest.title' : 'settings.title'}
          animationSeed={0}
        />
      ) : (
        <NoctaliaScreenHeader
          titleKey={returningGuestBlocked ? 'auth.returning_guest.title' : 'settings.title'}
        />
      )}

      <View style={[styles.fieldGroupFrame, isDesktopLayout && styles.fieldGroupFrameDesktop]}>
        <Host
          colorScheme={mode}
          ignoreSafeArea="all"
          seedColor={noctalia.accent.base}
          style={hostStyle}
        >
          <SettingsFieldGroup
            account={account}
            appVersionLabel={appVersion
              ? t('settings.app_version', { version: appVersion })
              : undefined}
            bottomPadding={bottomPadding}
            onOpenSubscription={handleOpenPaywall}
            quota={quota}
            returningGuestBlocked={returningGuestBlocked}
            subscriptionSubtitle={t('settings.plus.subtitle')}
            subscriptionTitle={t('subscription.settings.title.plus')}
          />
        </Host>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fieldGroupFrame: {
    flex: 1,
    width: '100%',
  },
  fieldGroupFrameDesktop: {
    alignSelf: 'center',
    maxWidth: SETTINGS_DESKTOP_MAX_WIDTH,
  },
  host: {
    flex: 1,
    width: '100%',
  },
  rnSlot: {
    alignSelf: 'center',
    width: '100%',
  },
  accountRnSlot: {
    // Compose's matchContents measurement otherwise clips the last auth row.
    paddingBottom: ThemeLayout.spacing.lg,
  },
  returningGuestGlassCard: {
    borderRadius: 24,
    marginBottom: ThemeLayout.spacing.md,
    overflow: 'hidden',
    padding: 0,
  },
  returningGuestAccentStripe: {
    height: 3,
    opacity: 0.85,
    width: '100%',
  },
  returningGuestInner: {
    alignItems: 'center',
    gap: ThemeLayout.spacing.sm,
    padding: ThemeLayout.spacing.lg,
  },
  returningGuestTitle: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 20,
    marginTop: ThemeLayout.spacing.sm,
    textAlign: 'center',
  },
  returningGuestMessage: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
