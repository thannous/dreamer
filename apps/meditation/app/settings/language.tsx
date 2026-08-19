import React from 'react';
import { ScrollView, View } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import { SelectableCard } from '@/components/onboarding/SelectableCard';
import { BackLink, Rule, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import type { TranslationKey } from '@/lib/i18n';
import { SHIPPED_LANGUAGES, type AppLanguage } from '@/lib/types';

/** The four locales that have no catalogue yet — shown, but not selectable. */
const PENDING: AppLanguage[] = ['es', 'de', 'it', 'pt'];

const PENDING_NAMES: Record<string, string> = {
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
};

export default function LanguageScreen() {
  const { t, language, setLanguage } = useTranslation();

  return (
    <Screen variant="subtle" edges={['top']}>
      <BackLink label={t('common.back')} className="px-gutter pt-2" />

      <ScrollView
        contentContainerClassName="px-gutter pb-16 pt-2 gap-6"
        showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          <Text variant="h1">{t('language.title')}</Text>
          <Rule className="self-start" />
          <Text variant="bodySm">{t('language.subtitle')}</Text>
        </View>

        <View className="gap-3">
          {SHIPPED_LANGUAGES.map((code) => (
            <SelectableCard
              key={code}
              mode="single"
              label={t(`language.${code}` as TranslationKey)}
              selected={language === code}
              onPress={() => setLanguage(code)}
            />
          ))}
        </View>

        <View className="gap-3 opacity-40">
          {PENDING.map((code) => (
            <View
              key={code}
              className="flex-row items-center justify-between rounded-xl border border-hairline bg-ink-card p-gutter">
              <Text variant="h3">{PENDING_NAMES[code]}</Text>
              <Text variant="caption">{t('language.soon')}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
