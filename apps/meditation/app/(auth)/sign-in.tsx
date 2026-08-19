import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import { Button, Rule, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';

/**
 * Providers are wired in a later batch, behind `authService`. The guest path is
 * the one that works today, and it is deliberately not the small print: an
 * account is never required to meditate.
 */
export default function SignInScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Screen variant="subtle">
      <View className="flex-1 justify-between px-gutter pb-4 pt-12">
        <View className="gap-3">
          <Text variant="h1">{t('auth.title')}</Text>
          <Rule className="self-start" />
          <Text variant="bodySm">{t('auth.subtitle')}</Text>
        </View>

        <View className="gap-3 pb-6">
          <Button label={t('auth.apple')} />
          <Button label={t('auth.google')} variant="secondary" />
          <Button
            label={t('auth.email')}
            variant="secondary"
            onPress={() => router.push('/email')}
          />
          <Button label={t('auth.guest')} variant="ghost" onPress={() => router.replace('/')} />
        </View>
      </View>
    </Screen>
  );
}
