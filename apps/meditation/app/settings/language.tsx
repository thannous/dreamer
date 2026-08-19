import React from 'react';
import { ScrollView, View } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import { SelectableCard } from '@/components/onboarding/SelectableCard';
import { BackLink, Rule, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import type { TranslationKey } from '@/lib/i18n';
import { SHIPPED_LANGUAGES } from '@/lib/types';

/**
 * Each language is named in itself — a German reader looks for "Deutsch", not
 * for whatever the current interface calls German.
 */
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
      </ScrollView>
    </Screen>
  );
}
