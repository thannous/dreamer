import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import { Button, Rule, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';

/** A stale or mistyped link lands here instead of the router's developer page. */
export default function NotFoundScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Screen variant="subtle">
      <View testID="screen.notFound" className="flex-1 justify-center gap-4 px-gutter">
        <Text variant="h1">{t('notFound.title')}</Text>
        <Rule className="self-start" />
        <Text variant="bodySm">{t('notFound.body')}</Text>
        <Button label={t('complete.home')} onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}
