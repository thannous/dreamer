import { Host } from '@expo/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useCallback, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  type ViewStyle,
  View,
} from 'react-native';

import { EmailAuthCard } from '@/components/auth/EmailAuthCard';
import { GuestRecordingQaReset } from '@/components/dev/GuestRecordingQaReset';
import { GuestProdQALab } from '@/components/guest/GuestProdQALab';
import { NoctaliaScreenHeader } from '@/components/NoctaliaScreenHeader';
import { QuotaStatusCard } from '@/components/quota/QuotaStatusCard';
import { SubscriptionQALab } from '@/components/subscription/SubscriptionQALab';
import { LegalSection } from '@/components/settings/LegalSection';
import { SettingsSignOutAction } from '@/components/settings/SettingsSignOutAction';
import { SettingsFieldGroup } from '@/components/settings/SettingsFieldGroup';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useContentWindow } from '@/context/ContentWindowContext';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useTranslation } from '@/hooks/useTranslation';
import { getAppVersionString } from '@/lib/appVersion';
import { getExpoPublicEnvValue, isMockModeEnabled } from '@/lib/env';
import { buildPaywallHref } from '@/lib/paywallRoute';
import { canOpenStoreReviewPage, openStoreReviewPage } from '@/lib/storeReview';

/**
 * `Host` is an @expo/ui component, so it takes no `className` and keeps a plain
 * style object.
 */
const HOST_STYLE = { flex: 1, width: '100%' } as const;

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
  const directAccountForm = section === 'account' && (auth === 'signin' || auth === 'signup');
  const { colors, mode } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { width, height } = useContentWindow();
  const appVersion = getAppVersionString();
  const storeKey = getExpoPublicEnvValue(Platform.OS === 'android'
    ? 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY'
    : Platform.OS === 'ios' ? 'EXPO_PUBLIC_REVENUECAT_IOS_KEY' : 'EXPO_PUBLIC_REVENUECAT_WEB_KEY');
  const showSubscriptionQaLab = isMockModeEnabled() || (
    getExpoPublicEnvValue('EXPO_PUBLIC_SUBSCRIPTION_QA_LAB') === 'true' && storeKey?.startsWith('test_')
  );
  useClearWebFocus();

  const isCompactLayout = width <= 375;
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
      <EmailAuthCard isCompact={isCompactLayout} presentation="embedded" showSignOut={false} initialAccountSheetOpen={auth === 'signin'} />
      <GuestRecordingQaReset />
      <GuestProdQALab />
    </View>
  );

  const quota = (
    <View className={RN_SLOT_CLASS} testID="settings-quota-rn-content">
      <QuotaStatusCard onUpgradePress={handleOpenPaywall} presentation="embedded" showTitle={section === 'account'} showFreeUpgrade={section === 'account'} />
      {showSubscriptionQaLab ? <SubscriptionQALab presentation="embedded" /> : null}
    </View>
  );

  const legal = (
    <View className={RN_SLOT_CLASS} testID="settings-legal-rn-content">
      <LegalSection />
    </View>
  );

  // Account links include their subscription; general preferences stay in settings.
  if (section === 'account') {
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
            <EmailAuthCard key={auth} isCompact={isCompactLayout} presentation={directAccountForm ? 'card' : 'embedded'} initialMode={directAccountForm ? auth as 'signin' | 'signup' : undefined} />
            {directAccountForm ? null : <View className="mt-8">{quota}</View>}
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
      {/* A reading width wherever the window is wider, so a row's name and its value stay
          close: the open iPhone Duo on its side, a tablet, a browser. */}
      <View className="w-full max-w-[760px] self-center">
      <NoctaliaScreenHeader
        scene="journal"
        titleKey="settings.title"
        actions={[{
          icon: 'chevron.left',
          accessibilityLabel: t('navigation.back'),
          testID: 'settings.back',
          onPress: () => router.canGoBack() ? router.back() : router.replace('/'),
        }]}
      />
      </View>

      {/* 760px is inline: Tailwind extracts class names statically, so it cannot
          come from a constant. */}
      <View
        className="w-full max-w-[760px] flex-1 self-center"
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
            footer={user ? <View testID="settings-signout-footer"><SettingsSignOutAction /></View> : undefined}
            onOpenSubscription={handleOpenPaywall}
            onReplayOnboarding={() => router.push({ pathname: '/onboarding', params: { replay: '1' } })}
            onRateApp={!canOpenStoreReviewPage() ? undefined : () => void openStoreReviewPage()}
            quota={quota}
            subscriptionSubtitle={t('settings.plus.subtitle')}
            subscriptionTitle={t('subscription.settings.title.plus')}
          />
        </SettingsHost>
      </View>
    </KeyboardAvoidingView>
  );
}
