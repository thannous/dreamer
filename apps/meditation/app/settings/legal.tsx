import React from 'react';
import { Linking, ScrollView, View } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import { SettingsGroup, SettingsRow } from '@/components/settings/SettingsRow';
import { BackLink, Card, Rule, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';

const PRIVACY_URL = 'https://noctalia.app/privacy';
const TERMS_URL = 'https://noctalia.app/terms';

export default function LegalScreen() {
  const { t } = useTranslation();

  const open = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <Screen variant="subtle" edges={['top']}>
      <BackLink label={t('common.back')} className="px-gutter pt-2" />

      <ScrollView
        contentContainerClassName="pb-16 pt-2 gap-6"
        showsVerticalScrollIndicator={false}>
        <View className="gap-3 px-gutter">
          <Text variant="h1">{t('legal.title')}</Text>
          <Rule className="self-start" />
        </View>

        <View className="px-gutter">
          <Card featured>
            <Text variant="h3">{t('legal.data.title')}</Text>
            <Text variant="bodySm" className="mt-2">
              {t('legal.data.body')}
            </Text>
          </Card>
        </View>

        <SettingsGroup title={t('legal.title')}>
          <SettingsRow label={t('legal.privacy')} onPress={() => open(PRIVACY_URL)} />
          <SettingsRow label={t('legal.terms')} onPress={() => open(TERMS_URL)} />
          <SettingsRow label={t('legal.licenses')} disabled />
        </SettingsGroup>
      </ScrollView>
    </Screen>
  );
}
