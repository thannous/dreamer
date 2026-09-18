import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, Keyboard, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Drawer } from 'react-native-drawer-layout';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { QuickSettingsContext } from '@/context/QuickSettingsContext';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { buildPaywallHref } from '@/lib/paywallRoute';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import {
  useJournalLayoutSettingsPreference,
  useLanguageSettingsPreference,
  useThemeSettingsPreference,
  type SettingsPreferenceController,
} from './useSettingsPreferences';

type PreferenceGroup = 'theme' | 'journal' | 'language';
type IconName = React.ComponentProps<typeof IconSymbol>['name'];
const GROUP_ICONS: Record<PreferenceGroup, IconName> = { theme: 'paintpalette', journal: 'book', language: 'globe' };
const OPTION_ICONS: Record<string, IconName> = {
  dynamic: 'clock', auto: 'iphone', light: 'sun.max.fill', dark: 'moon.stars.fill',
  cards: 'rectangle.stack.fill', compact: 'list.bullet.rectangle.fill',
};

function PreferenceChoices<T extends string>({ preference, id, showTitle = true }: {
  preference: SettingsPreferenceController<T>; id: PreferenceGroup; showTitle?: boolean;
}) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const tokens = getNoctaliaDesignTokens(colors, mode);
  return (
    <View className="gap-3">
      {showTitle ? <View className="flex-row items-center gap-3">
        <IconSymbol name={GROUP_ICONS[id]} size={20} color={tokens.text.secondary} />
        <Text accessibilityRole="header" className="min-w-0 flex-1 font-sans-medium text-[16px] text-ivory">{preference.title}</Text>
      </View> : null}
      <View className="flex-row flex-wrap gap-2">
        {preference.options.map((option) => (
          <Pressable key={option.value} onPress={() => void preference.select(option.value)}
            disabled={preference.loading || preference.saving}
            accessibilityRole="radio" accessibilityLabel={option.label}
            accessibilityState={{ checked: option.current, disabled: preference.loading || preference.saving }}
            testID={`quick-settings.${id}.${option.value}`}
            className={`min-h-12 max-w-full flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3 ${option.current ? 'border-champagne-soft bg-champagne' : 'border-line bg-ink-soft'}`}>
            <IconSymbol name={id === 'language' ? 'globe' : OPTION_ICONS[option.value] ?? GROUP_ICONS[id]} size={18}
              color={option.current ? tokens.action.primaryText : tokens.text.secondary} />
            <Text className={`min-w-0 shrink font-sans-medium text-[14px] ${option.current ? 'text-on-champagne' : 'text-ivory'}`}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      {preference.error ? <Text accessibilityRole="alert" className="font-sans text-[14px] text-ivory">{t('error.unknown')}</Text> : null}
    </View>
  );
}

export function QuickSettingsContent({ onClose, onSettings, onAccount, onPlus }: {
  onClose: () => void;
  onSettings: () => void;
  onAccount: () => void;
  onPlus: () => void;
}) {
  const { t } = useTranslation();
  const theme = useThemeSettingsPreference();
  const language = useLanguageSettingsPreference();
  const journalLayout = useJournalLayoutSettingsPreference();
  const { colors, mode } = useTheme();
  const tokens = getNoctaliaDesignTokens(colors, mode);
  const insets = useSafeAreaInsets();
  const [showLanguage, setShowLanguage] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { isActive, loading: subscriptionLoading } = useSubscription();
  const metadata = user?.user_metadata;
  const profileName = [metadata?.full_name, metadata?.name, metadata?.display_name]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim()
    || user?.email?.split('@')[0]
    || t(user ? 'settings.quick.profile' : 'settings.account.status.guest');
  const initials = profileName.split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join('').toLocaleUpperCase();
  const plusActive = Boolean(user) && isActive;

  return (
    <ScrollView className="flex-1 bg-ink" testID="quick-settings.drawer" accessibilityViewIsModal
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, paddingHorizontal: 20, gap: 28 }}>
      <View className="flex-row items-center justify-between gap-3">
        <Text accessibilityRole="header" className="min-w-0 flex-1 font-display text-[24px] leading-[30px] text-ivory">{t('settings.quick.title')}</Text>
        <Pressable onPress={onClose} testID="quick-settings.close" accessibilityRole="button" accessibilityLabel={t('settings.quick.close')}
          className="h-12 w-12 items-center justify-center rounded-full bg-ink-soft">
          <IconSymbol name="xmark" size={20} color={tokens.text.primary} />
        </Pressable>
      </View>
      <View className="gap-4">
        <Pressable onPress={onAccount} disabled={authLoading} accessibilityRole="button"
          accessibilityState={{ disabled: authLoading }} testID="quick-settings.profile"
          className="min-h-16 flex-row items-center gap-3">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-ink-soft" accessible={false}>
            {user ? <Text className="font-sans-medium text-[20px] text-ivory">{initials}</Text>
              : <IconSymbol name="person.fill" size={24} color={tokens.text.secondary} />}
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <Text numberOfLines={2} className="font-sans-medium text-[18px] text-ivory">{authLoading ? t('settings.quick.loading') : profileName}</Text>
            <Text numberOfLines={2} className="font-sans text-[13px] text-ivory-muted">
              {user ? (user.email || t('settings.account.status.signed_in')) : t('settings.account.local_hint')}
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={18} color={tokens.text.secondary} />
        </Pressable>
        {!user ? (
          <Pressable onPress={onAccount} disabled={authLoading} accessibilityRole="button"
            accessibilityState={{ disabled: authLoading }} testID="quick-settings.signin"
            className="min-h-12 flex-row items-center justify-center gap-3 rounded-xl border border-line bg-ink-soft px-4 py-3">
            <IconSymbol name="person.fill" size={20} color={tokens.text.secondary} />
            <Text className="font-sans-medium text-[15px] text-ivory">{t('settings.account.button.sign_in')}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onPlus} disabled={authLoading || subscriptionLoading} accessibilityRole="button"
          accessibilityState={{ disabled: authLoading || subscriptionLoading }} testID="quick-settings.plus"
          className="min-h-16 flex-row items-center gap-3 rounded-2xl border border-champagne-soft bg-champagne px-4 py-4">
          <IconSymbol name="sparkles" size={24} color={tokens.action.primaryText} />
          <View className="min-w-0 flex-1 gap-1">
            <Text className="font-sans-medium text-[16px] text-on-champagne">
              {t(plusActive ? 'subscription.settings.title.plus' : 'settings.quick.upgrade')}
            </Text>
            <Text className="font-sans text-[13px] text-on-champagne">
              {t(plusActive ? 'settings.quick.subscription' : 'settings.quick.plus_details')}
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={18} color={tokens.action.primaryText} />
        </Pressable>
      </View>
      <View className="h-px bg-line" />
      <View className="gap-3">
        <Pressable onPress={() => setShowLanguage((current) => !current)} accessibilityRole="button"
          accessibilityState={{ expanded: showLanguage }} testID="quick-settings.language"
          className="min-h-12 flex-row items-center justify-between gap-3">
          <IconSymbol name="globe" size={20} color={tokens.text.secondary} />
          <View className="min-w-0 flex-1 gap-1">
            <Text className="font-sans-medium text-[16px] text-ivory">{language.title}</Text>
            <Text className="font-sans text-[14px] text-ivory-muted">{language.currentLabel}</Text>
          </View>
          <IconSymbol name={showLanguage ? 'chevron.up' : 'chevron.down'} size={18} color={tokens.text.secondary} />
        </Pressable>
        {showLanguage ? <PreferenceChoices id="language" preference={language} showTitle={false} /> : null}
      </View>
      <PreferenceChoices id="theme" preference={theme} />
      <PreferenceChoices id="journal" preference={journalLayout} />
      <View className="h-px bg-line" />
      <Pressable onPress={onSettings} testID="quick-settings.all" accessibilityRole="button"
        className="min-h-14 flex-row items-center justify-between gap-3 rounded-xl bg-ink-soft px-4 py-4">
        <IconSymbol name="gear" size={20} color={tokens.text.secondary} />
        <Text className="min-w-0 flex-1 font-sans-medium text-[16px] text-ivory">{t('settings.quick.all')}</Text>
        <IconSymbol name="chevron.right" size={18} color={tokens.text.primary} />
      </Pressable>
    </ScrollView>
  );
}

/** An overlay, not a second navigator: tab/search state stays mounted beneath it. */
export function QuickSettingsProvider({ children, disabled = false }: React.PropsWithChildren<{ disabled?: boolean }>) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState('');
  const pathname = usePathname();
  const { user } = useAuth();
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const tokens = getNoctaliaDesignTokens(colors, mode);
  const drawerWidth = Math.min(380, Math.max(280, width - 24));
  const visible = open && origin === pathname && !disabled;
  const close = useCallback(() => setOpen(false), []);
  const show = useCallback(() => {
    Keyboard.dismiss();
    setOrigin(pathname);
    setOpen(true);
  }, [pathname]);
  const showSettings = useCallback(() => {
    setOpen(false);
    router.push('/settings');
  }, []);

  const showAccount = useCallback(() => {
    setOpen(false);
    router.push(user ? '/settings?section=account' : '/settings?section=account&auth=signin');
  }, [user]);
  const showPlus = useCallback(() => {
    setOpen(false);
    router.push(buildPaywallHref('settings'));
  }, []);

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    if (Platform.OS === 'web') window.addEventListener('keydown', escape);
    return () => {
      subscription.remove();
      if (Platform.OS === 'web') window.removeEventListener('keydown', escape);
    };
  }, [visible, close]);

  const content = () => <QuickSettingsContent onClose={close} onSettings={showSettings} onAccount={showAccount} onPlus={showPlus} />;
  return (
    <QuickSettingsContext.Provider value={show}>
      <View className="flex-1">
        <View className="flex-1" pointerEvents={visible ? 'none' : 'auto'}
          accessibilityElementsHidden={visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>
          {children}
        </View>
        {!disabled ? (
          <View className="absolute inset-0" pointerEvents={visible ? 'auto' : 'none'}>
            {reducedMotion ? (visible ? (
              <View className="absolute inset-0 flex-row justify-end">
                <Pressable className="absolute inset-0 bg-black/40" onPress={close} accessibilityRole="button" accessibilityLabel={t('settings.quick.close')} />
                <View style={{ width: drawerWidth }} className="h-full">{content()}</View>
              </View>
            ) : null) : (
              <Drawer open={visible} onOpen={show} onClose={close} drawerPosition="right" drawerType="front"
                swipeEnabled={false} overlayAccessibilityLabel={t('settings.quick.close')}
                drawerStyle={{ width: drawerWidth, backgroundColor: tokens.screen.background }}
                renderDrawerContent={content}>
                <View className="flex-1" />
              </Drawer>
            )}
          </View>
        ) : null}
      </View>
    </QuickSettingsContext.Provider>
  );
}
