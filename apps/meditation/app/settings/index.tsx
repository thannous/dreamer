import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/atmosphere/Screen';
import { SettingsGroup, SettingsRow } from '@/components/settings/SettingsRow';
import { BackLink, Rule, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { TID } from '@/lib/testIDs';
import { useSettings } from '@/context/SettingsContext';
import { useTheme } from '@/context/ThemeContext';
import type { TranslationKey } from '@/lib/i18n';
import { formatHour } from '@/lib/reminders';

export default function SettingsScreen() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const { preference, setPreference } = useTheme();
  const { reminders, videoBackgrounds, setVideoBackgrounds } = useSettings();
  const { subscriptionsEnabled = true } = useSubscription();
  const insets = useSafeAreaInsets();

  const version = Constants.expoConfig?.version ?? '—';

  // Tapping the theme row cycles it: three values do not deserve a screen.
  const cycleTheme = () => {
    const order = ['auto', 'light', 'dark'] as const;
    const next = order[(order.indexOf(preference) + 1) % order.length];
    setPreference(next);
  };

  return (
    <Screen variant="subtle" edges={['top']}>
      <BackLink label={t('common.back')} className="px-gutter pt-2" />

      <ScrollView
        testID={TID.Screen.Settings}
        contentContainerClassName="pt-2 gap-6"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 48 }}
        showsVerticalScrollIndicator={false}>
        <View className="gap-3 px-gutter">
          <Text variant="h1">{t('settings.title')}</Text>
          <Rule className="self-start" />
        </View>

        <SettingsGroup title={t('settings.group.practice')}>
          <SettingsRow
            label={t('settings.reminders')}
            value={
              reminders.enabled
                ? formatHour(reminders.hour, reminders.minute)
                : t('settings.reminders.off')
            }
            onPress={() => router.push('/settings/reminders')}
          />
          <SettingsRow
            label={t('settings.account')}
            onPress={() => router.push('/settings/account')}
          />
          {subscriptionsEnabled ? (
            <SettingsRow
              testID="btn.settings.restore"
              label={t('paywall.restore')}
              value={t('paywall.title')}
              onPress={() => router.push('/paywall')}
            />
          ) : null}
        </SettingsGroup>

        <SettingsGroup title={t('settings.group.app')}>
          <SettingsRow
            testID={TID.Button.SettingsTheme}
            label={t('settings.theme')}
            value={t(`settings.theme.${preference}` as TranslationKey)}
            inline
            onPress={cycleTheme}
          />
          <SettingsRow
            label={t('settings.video')}
            value={videoBackgrounds ? t('settings.video.on') : t('settings.video.off')}
            inline
            onPress={() => setVideoBackgrounds(!videoBackgrounds)}
          />
          <SettingsRow
            testID="settings.motion"
            label={t('settings.motion')}
            value={t('settings.motion.system')}
          />
          <SettingsRow
            testID={TID.Button.SettingsLanguage}
            label={t('settings.language')}
            value={t(`language.${language}` as TranslationKey)}
            onPress={() => router.push('/settings/language')}
          />
        </SettingsGroup>

        <SettingsGroup title={t('settings.group.about')}>
          <SettingsRow label={t('settings.help')} onPress={() => router.push('/settings/help')} />
          <SettingsRow label={t('settings.legal')} onPress={() => router.push('/settings/legal')} />
          <SettingsRow label={t('settings.version')} value={version} />
        </SettingsGroup>
      </ScrollView>
    </Screen>
  );
}
