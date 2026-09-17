import { Host } from '@expo/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useCallback, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Text,
  type ViewStyle,
  useWindowDimensions,
  View,
} from 'react-native';

import { EmailAuthCard } from '@/components/auth/EmailAuthCard';
import { VoiceLiveSpikeDebugEntry } from '@/components/dev/VoiceLiveSpikeDebugEntry';
import { GuestProdQALab } from '@/components/guest/GuestProdQALab';
import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { StaticFlatGlassCard } from '@/components/inspiration/GlassCard';
import { NoctaliaScreenHeader } from '@/components/NoctaliaScreenHeader';
import { QuotaStatusCard } from '@/components/quota/QuotaStatusCard';
import { LegalSection } from '@/components/settings/LegalSection';
import { SettingsFieldGroup } from '@/components/settings/SettingsFieldGroup';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useTranslation } from '@/hooks/useTranslation';
import { getAppVersionString } from '@/lib/appVersion';
import { buildPaywallHref } from '@/lib/paywallRoute';

/**
 * `Host` is an @expo/ui component and the returning-guest card is a `GlassCard`, so
 * neither takes a `className`. Both keep plain style objects.
 */
const HOST_STYLE = { flex: 1, width: '100%' } as const;
const RETURNING_GUEST_CARD_STYLE = {
  borderRadius: 24,
  marginBottom: ThemeLayout.spacing.md,
  overflow: 'hidden',
  padding: 0,
} as const;

/** The three slots that host React Native content inside the native settings shell. */
const RN_SLOT_CLASS = 'w-full self-center';
/** Compose's matchContents measurement otherwise clips the last auth row. */
const ACCOUNT_SLOT_ANDROID_CLASS = `${RN_SLOT_CLASS} pb-6`;

type SettingsHostProps = {
  children: React.ReactElement;
  colorScheme: 'light' | 'dark';
  hostKey?: string;
  seedColor: string;
  style: React.ComponentProps<typeof View>['style'];
};

/**
 * Android (Compose) and web render the settings inside the @expo/ui `Host` so
 * `RNHostView`/native pickers get their environment. On iOS the settings
 * content is plain React Native and the SwiftUI `Host` + `RNHostView` pair
 * loses touch handling when the RN subtree mounts after SwiftUI's `onAppear`
 * (@expo/ui 57): every row rendered but nothing responded. iOS therefore
 * renders the content directly; the iOS-only bottom sheets it uses work
 * without a surrounding `Host`.
 */
function SettingsHost({ children, colorScheme, hostKey, seedColor, style }: SettingsHostProps) {
  if (Platform.OS === 'ios') {
    return <View style={style}>{children}</View>;
  }
  return (
    <Host colorScheme={colorScheme} ignoreSafeArea="all" key={hostKey} seedColor={seedColor} style={style}>
      {children}
    </Host>
  );
}

export default function SettingsScreen() {
  const { auth, section } = useLocalSearchParams<{ auth?: string; section?: string }>();
  const { colors, mode } = useTheme();
  const { returningGuestBlocked } = useAuth();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { width, height } = useWindowDimensions();
  const appVersion = getAppVersionString();
  useClearWebFocus();

  const isCompactLayout = width <= 375;
  const isDesktopLayout = Platform.OS === 'web' && width >= 1024;
  const nativeHostKey = Platform.OS === 'android'
    ? `${Math.round(width)}x${Math.round(height)}`
    : undefined;
  const bottomPadding = insets.bottom + ThemeLayout.spacing.xl;
  const hostStyle = Platform.OS === 'web'
    ? [
        HOST_STYLE,
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
    : HOST_STYLE;

  const handleOpenPaywall = useCallback(() => {
    router.push(buildPaywallHref('settings'));
  }, []);

  const account = (
    <View
      className={Platform.OS === 'android' ? ACCOUNT_SLOT_ANDROID_CLASS : RN_SLOT_CLASS}
      testID="settings-account-rn-content"
    >
      {returningGuestBlocked ? (
        <StaticFlatGlassCard
          intensity="moderate"
          animationDelay={100}
          style={RETURNING_GUEST_CARD_STYLE}
        >
          <View className="h-[3px] w-full bg-champagne opacity-[0.85]" />
          <View className="items-center gap-2 p-6">
            <IconSymbol
              name="person.crop.circle.badge.exclamationmark"
              size={48}
              color={noctalia.accent.text}
            />
            <Text className="mt-2 text-center font-display-semibold text-[20px] text-ivory">
              {t('auth.returning_guest.banner_title')}
            </Text>
            <Text className="text-center font-sans text-body-sm text-ivory-muted">
              {t('auth.returning_guest.message')}
            </Text>
          </View>
        </StaticFlatGlassCard>
      ) : null}
      <EmailAuthCard isCompact={isCompactLayout} presentation="embedded" initialAccountSheetOpen={auth === 'signin'} />
      <GuestProdQALab />
      <VoiceLiveSpikeDebugEntry />
    </View>
  );

  const quota = (
    <View className={RN_SLOT_CLASS} testID="settings-quota-rn-content">
      <QuotaStatusCard onUpgradePress={handleOpenPaywall} presentation="embedded" />
    </View>
  );

  const legal = (
    <View className={RN_SLOT_CLASS} testID="settings-legal-rn-content">
      <LegalSection />
    </View>
  );

  // Account links include their subscription; general preferences stay in settings.
  if (section === 'account' && !returningGuestBlocked) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-ink" testID="screen.account">
        <NoctaliaScreenHeader titleKey="settings.account.title" actions={[{
          icon: 'chevron.left',
          accessibilityLabel: t('navigation.back'),
          testID: 'settings.back',
          onPress: () => router.canGoBack() ? router.back() : router.replace('/'),
        }]} />
        <ScrollView className="flex-1" testID="settings-account-only"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: ThemeLayout.spacing.lg, paddingBottom: bottomPadding }}>
          <View className="w-full max-w-[760px] self-center">
            <EmailAuthCard isCompact={isCompactLayout} presentation="embedded" initialAccountSheetOpen={auth === 'signin'} />
            <View className="mt-8">{quota}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-ink"
      testID="screen.settings"
    >
      <AtmosphericBackground variant="subtle" />
      <NoctaliaScreenHeader
        titleKey={returningGuestBlocked ? 'auth.returning_guest.title' : 'settings.title'}
        actions={returningGuestBlocked ? [] : [{
          icon: 'chevron.left',
          accessibilityLabel: t('navigation.back'),
          testID: 'settings.back',
          onPress: () => router.canGoBack() ? router.back() : router.replace('/'),
        }]}
      />

      {/* 760px is inline: Tailwind extracts class names statically, so it cannot
          come from a constant. */}
      <View
        className={`w-full flex-1${isDesktopLayout ? ' max-w-[760px] self-center' : ''}`}
      >
        <SettingsHost
          colorScheme={mode}
          hostKey={nativeHostKey}
          seedColor={noctalia.accent.base}
          style={hostStyle}
        >
          <SettingsFieldGroup
            account={account}
            appVersionLabel={appVersion
              ? t('settings.app_version', { version: appVersion })
              : undefined}
            bottomPadding={bottomPadding}
            legal={legal}
            onOpenSubscription={handleOpenPaywall}
            quota={quota}
            returningGuestBlocked={returningGuestBlocked}
            subscriptionSubtitle={t('settings.plus.subtitle')}
            subscriptionTitle={t('subscription.settings.title.plus')}
          />
        </SettingsHost>
      </View>
    </KeyboardAvoidingView>
  );
}
